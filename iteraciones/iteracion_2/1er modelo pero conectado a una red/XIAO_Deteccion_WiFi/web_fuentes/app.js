'use strict';
const $ = id => document.getElementById(id);
const EXPECTED_LABELS = ['Sin basura', 'Botellas', 'Papeles y Cartones', 'Bolsas'];
const REQUIRED_READINGS = 3;
const MIN_MARGIN = 0.15;
const INTERVAL_MS = 900;
let model = null, modelLoading = false, playing = false, detectionEnabled = false;
let detectionBusy = false, detectionTimer = null, epoch = 0, activeController = null;
let candidate = -1, streak = 0, photoURL = null, videoRetry = null;
let visibilityPlaying = false;
const classRows = [];

for (const label of EXPECTED_LABELS) {
  const row = document.createElement('div'); row.className = 'class-row';
  const title = document.createElement('div'); title.className = 'class-title';
  const name = document.createElement('span'); name.textContent = label;
  const value = document.createElement('strong'); value.textContent = '—';
  const bar = document.createElement('div'); bar.className = 'bar';
  const fill = document.createElement('div'); fill.className = 'fill';
  title.append(name, value); bar.append(fill); row.append(title, bar); $('classes').append(row);
  classRows.push({value, fill});
}

function verdict(title, detail, kind = 'waiting') {
  $('verdict').className = 'verdict ' + kind;
  $('verdictTitle').textContent = title;
  $('verdictDetail').textContent = detail;
}
function resetDecision(clearBars = false) {
  candidate = -1; streak = 0;
  if (clearBars) for (const row of classRows) { row.value.textContent = '—'; row.fill.style.width = '0%'; }
}
function scoreDecision(scores, threshold) {
  if (scores.length !== 4 || scores.some(v => !Number.isFinite(v) || v < 0 || v > 1)) {
    throw new Error('El modelo devolvió valores no válidos.');
  }
  const ranking = scores.map((score, index) => ({score, index})).sort((a, b) => b.score - a.score);
  const top = ranking[0], margin = top.score - ranking[1].score;
  if (top.score < threshold || margin < MIN_MARGIN) return {index: -1, top};
  return {index: top.index, top};
}
function displayScores(predictions) {
  const scores = EXPECTED_LABELS.map(label => {
    const prediction = predictions.find(p => p.className === label);
    if (!prediction) throw new Error('Las clases del modelo no coinciden.');
    return prediction.probability;
  });
  scores.forEach((score, i) => {
    classRows[i].value.textContent = (score * 100).toFixed(1) + ' %';
    classRows[i].fill.style.width = (score * 100) + '%';
  });
  const decision = scoreDecision(scores, Number($('threshold').value) / 100);
  if (decision.index < 0) {
    resetDecision();
    verdict('No seguro', 'Prueba con una sola categoría y revisa la luz y el encuadre.');
    return;
  }
  if (candidate === decision.index) streak = Math.min(streak + 1, REQUIRED_READINGS);
  else { candidate = decision.index; streak = 1; }
  const label = EXPECTED_LABELS[decision.index], percent = (decision.top.score * 100).toFixed(1);
  if (streak < REQUIRED_READINGS) {
    verdict('No seguro', 'Confirmando ' + label + ' · ' + streak + '/' + REQUIRED_READINGS + ' lecturas.');
  } else if (decision.index === 0) {
    verdict('Sin basura', 'Caja vacía según el modelo · ' + percent + ' %', 'clear');
  } else {
    verdict('Hay basura', label + ' · ' + percent + ' %', 'trash');
  }
}

function playVideo() {
  clearTimeout(videoRetry); playing = true;
  $('live').hidden = false; $('livePlaceholder').hidden = true;
  $('live').src = 'http://' + location.hostname + ':81/stream?t=' + Date.now();
  $('videoToggle').textContent = 'Pausar video';
  $('cameraStatus').textContent = 'Video activo. Puedes tomar y descargar fotos.';
}
function pauseVideo() {
  clearTimeout(videoRetry); playing = false;
  $('live').removeAttribute('src'); $('live').hidden = true;
  $('livePlaceholder').hidden = false; $('livePlaceholder').textContent = 'Video pausado';
  $('videoToggle').textContent = 'Iniciar video';
  $('cameraStatus').textContent = 'Video pausado. Puedes seguir tomando fotos.';
}
$('videoToggle').onclick = () => playing ? pauseVideo() : playVideo();
$('live').onerror = () => {
  if (!playing) return;
  $('cameraStatus').textContent = 'Reconectando video… Revisa la conexión al Wi-Fi de tu router.';
  videoRetry = setTimeout(() => { if (playing && !document.hidden) playVideo(); }, 2500);
};

async function fetchCapture(signal) {
  const response = await fetch('/capture?t=' + Date.now(), {cache: 'no-store', signal});
  if (!response.ok) throw new Error('La cámara respondió con error ' + response.status + '.');
  const blob = await response.blob();
  if (!blob.size || !blob.type.startsWith('image/')) throw new Error('No llegó una imagen válida.');
  return blob;
}
async function decodePhoto(blob) {
  if (typeof createImageBitmap === 'function') return createImageBitmap(blob);
  const url = URL.createObjectURL(blob), image = new Image();
  try {
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url; });
    return image;
  } finally { URL.revokeObjectURL(url); }
}
function drawModelCrop(image) {
  // Mismo recorte central y redimensionado que cropTo de Teachable Machine.
  const canvas = $('crop'), size = 224;
  const width = image.width, height = image.height, scale = size / Math.min(width, height);
  const scaledW = Math.ceil(width * scale), scaledH = Math.ceil(height * scale);
  canvas.getContext('2d').drawImage(image, -Math.floor((scaledW - size) / 2),
    -Math.floor((scaledH - size) / 2), scaledW, scaledH);
  return canvas;
}
function queueDetection(delay = INTERVAL_MS) {
  clearTimeout(detectionTimer);
  if (model && detectionEnabled && !document.hidden) detectionTimer = setTimeout(detectOnce, delay);
}
async function detectOnce() {
  if (detectionBusy || !model || !detectionEnabled || document.hidden) return;
  detectionBusy = true;
  const thisEpoch = epoch, controller = new AbortController(); activeController = controller;
  const timeout = setTimeout(() => controller.abort(), 12000);
  let image = null;
  try {
    const blob = await fetchCapture(controller.signal); image = await decodePhoto(blob);
    if (thisEpoch !== epoch || !detectionEnabled || document.hidden) return;
    const started = performance.now();
    // La biblioteca oficial conserva la normalización de tu entrenamiento.
    const predictions = await model.predict(drawModelCrop(image), false);
    if (thisEpoch !== epoch || !detectionEnabled || document.hidden) return;
    displayScores(predictions);
    $('modelStatus').textContent = 'Modelo activo · Última lectura ' + new Date().toLocaleTimeString() +
      ' · Análisis ' + Math.round(performance.now() - started) + ' ms';
  } catch (error) {
    if (thisEpoch === epoch && detectionEnabled && !document.hidden) {
      resetDecision(true);
      verdict('No seguro', 'Sin lectura reciente de la cámara.');
      $('modelStatus').textContent = 'Reintentando… Revisa el Wi-Fi del router y cierra otras pestañas. ' +
        (error.name === 'AbortError' ? 'La captura tardó demasiado.' : error.message);
    }
  } finally {
    clearTimeout(timeout);
    if (image && typeof image.close === 'function') image.close();
    if (activeController === controller) activeController = null;
    detectionBusy = false; queueDetection();
  }
}
function stopDetection() {
  detectionEnabled = false; epoch++; clearTimeout(detectionTimer);
  if (activeController) activeController.abort();
  resetDecision(true); $('detectToggle').textContent = 'Iniciar detección';
  verdict('Detección pausada', 'Pulsa Iniciar detección para analizar nuevas capturas.');
  $('modelStatus').textContent = model ? 'Modelo cargado · Detección pausada.' : 'Modelo no disponible.';
}
function startDetection() {
  if (!model) return;
  detectionEnabled = true; epoch++; resetDecision(true);
  $('detectToggle').textContent = 'Pausar detección';
  verdict('No seguro', 'Esperando lecturas nuevas…'); queueDetection(100);
}
$('detectToggle').onclick = async () => {
  if (!model) { await loadModel(); if (model) startDetection(); }
  else if (detectionEnabled) stopDetection();
  else startDetection();
};
$('threshold').oninput = () => {
  $('thresholdValue').textContent = $('threshold').value + ' %';
  if (detectionEnabled) { epoch++; resetDecision(); verdict('No seguro', 'Confirmando con el nuevo umbral…'); }
};

$('snap').onclick = async () => {
  $('snap').disabled = true; $('cameraStatus').textContent = 'Tomando una foto nueva…';
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const blob = await fetchCapture(controller.signal);
    if (photoURL) URL.revokeObjectURL(photoURL);
    photoURL = URL.createObjectURL(blob); $('photo').src = photoURL;
    $('download').href = photoURL;
    $('download').download = 'XIAO_' + new Date().toISOString().replace(/[:.]/g, '-') + '.jpg';
    $('photoPanel').hidden = false;
    $('cameraStatus').textContent = 'Foto lista. Pulsa Descargar foto para guardarla.';
  } catch (error) {
    $('cameraStatus').textContent = 'No se pudo tomar la foto. Revisa la conexión al Wi-Fi del router.';
  } finally { clearTimeout(timeout); $('snap').disabled = false; }
};

async function loadModel() {
  if (modelLoading || model) return;
  modelLoading = true; $('detectToggle').disabled = true;
  verdict('Preparando modelo…', 'Cargando tu entrenamiento desde la XIAO. Puede tardar unos segundos.');
  $('modelStatus').textContent = 'Cargando las cuatro clases…';
  let loaded = null;
  try {
    if (typeof tf === 'undefined' || typeof tmImage === 'undefined') throw new Error('Recarga la página para cargar las bibliotecas.');
    await tf.ready();
    loaded = await tmImage.load('/model.json', '/metadata.json');
    const labels = loaded.getClassLabels();
    if (JSON.stringify(labels) !== JSON.stringify(EXPECTED_LABELS)) throw new Error('Las clases del modelo no coinciden con este proyecto.');
    model = loaded;
    $('modelStatus').textContent = 'Modelo cargado · Sin Internet.';
  } catch (error) {
    if (loaded && typeof loaded.dispose === 'function') loaded.dispose();
    resetDecision(true); verdict('Modelo no disponible', 'Revisa la conexión y pulsa Reintentar modelo.');
    $('modelStatus').textContent = 'No se pudo cargar: ' + error.message;
    $('detectToggle').textContent = 'Reintentar modelo';
  } finally { modelLoading = false; $('detectToggle').disabled = false; }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    visibilityPlaying = playing; if (playing) pauseVideo();
    epoch++; clearTimeout(detectionTimer); if (activeController) activeController.abort(); resetDecision(true);
    if (detectionEnabled) verdict('No seguro', 'Detección suspendida mientras la pestaña está oculta.');
  } else {
    if (visibilityPlaying) playVideo(); visibilityPlaying = false;
    if (detectionEnabled) { verdict('No seguro', 'Esperando capturas nuevas…'); queueDetection(100); }
  }
});
window.addEventListener('pagehide', () => {
  playing = false; detectionEnabled = false; epoch++;
  clearTimeout(videoRetry); clearTimeout(detectionTimer); if (activeController) activeController.abort();
  $('live').removeAttribute('src');
});
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
(async () => {
  await loadModel();
  $('snap').disabled = false; $('videoToggle').disabled = false;
  if (!document.hidden) playVideo(); else visibilityPlaying = true;
  if (model) startDetection();
})();
