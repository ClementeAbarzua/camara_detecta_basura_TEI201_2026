/**
 * DETECTOR DE BASURA EN EL NAVEGADOR
 * Se ejecuta en el PC o celular conectado al mismo router que la XIAO.
 * Flujo: captura JPEG -> recorte 224 x 224 -> modelo -> suma de clases
 * -> promedio temporal -> confirmacion binaria -> actualizacion de la web.
 * El video y las capturas para inferencia se solicitan por rutas separadas.
 */
'use strict';
const $ = id => document.getElementById(id);
// 1. PARAMETROS DEL MODELO Y DE LA DECISION
const EXPECTED_LABELS = ['Sin basura', 'Botellas', 'Papeles y Cartones', 'Bolsas'];
const REQUIRED_READINGS = 3; // Evaluaciones consecutivas del mismo resultado binario.
const AVERAGE_WINDOW = 5; // Maximo de capturas recientes para el promedio.
const MIN_AVERAGE_READINGS = 3; // Minimo de capturas antes de decidir.
const INTERVAL_MS = 900; // Espera entre ciclos; se suma al tiempo de captura e inferencia.
// 2. ESTADO DE EJECUCION
// model: clasificador cargado. detectionBusy: evita inferencias solapadas.
// epoch: version del ciclo; descarta resultados de peticiones anteriores.
// candidate: -1 sin candidato, 0 sin basura, 1 hay basura.
// streak: cantidad de confirmaciones consecutivas del candidato actual.
// activeController: permite cancelar la captura HTTP en curso.
// playing y detectionEnabled controlan video y deteccion por separado.
let model = null, modelLoading = false, playing = false, detectionEnabled = false;
let detectionBusy = false, detectionTimer = null, epoch = 0, activeController = null;
let candidate = -1, streak = 0, photoURL = null, videoRetry = null;
let visibilityPlaying = false;
const trashHistory = []; // Probabilidades conjuntas recientes de basura, entre 0 y 1.
const classRows = []; // Referencias DOM de las barras y porcentajes individuales.

// 3. CREACION DE LAS BARRAS INDIVIDUALES DE LA INTERFAZ
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

/** Actualiza el texto principal y el estilo visual de la conclusion. */
function verdict(title, detail, kind = 'waiting') {
  $('verdict').className = 'verdict ' + kind;
  $('verdictTitle').textContent = title;
  $('verdictDetail').textContent = detail;
}
/** Reinicia solo el candidato y su contador; conserva el promedio. */
function resetConfirmation() {
  candidate = -1; streak = 0;
}
/** Reinicia confirmacion y promedio. Con clearBars=true borra tambien las
 * barras individuales, por ejemplo al pausar o perder las capturas. */
function resetDecision(clearBars = false) {
  resetConfirmation(); trashHistory.length = 0;
  $('trashTotal').textContent = '—'; $('trashFill').style.width = '0%';
  $('trashNow').textContent = 'Suma actual: —';
  $('windowStatus').textContent = 'Esperando capturas nuevas.';
  if (clearBars) for (const row of classRows) { row.value.textContent = '—'; row.fill.style.width = '0%'; }
}
/** 4. AGRUPACION DE LAS SALIDAS DEL MODELO
 * Entrada: [sin basura, botellas, papeles/cartones, bolsas], entre 0 y 1.
 * Valida cuatro numeros y una suma cercana a 1, con tolerancia de 0.001.
 * Salida: trash = suma de las tres clases de basura; clear = clase sin basura.
 * No elige una categoria ganadora: interesa la presencia conjunta de basura.
 */
function aggregateScores(scores) {
  if (scores.length !== 4 || scores.some(v => !Number.isFinite(v) || v < 0 || v > 1)) {
    throw new Error('El modelo devolvió valores no válidos.');
  }
  const sum = scores.reduce((total, value) => total + value, 0);
  if (Math.abs(sum - 1) > 0.001) throw new Error('Los porcentajes del modelo no suman 100 %.');
  // Las salidas son softmax: las tres clases de basura forman un solo grupo.
  // No se exige una clase ganadora ni margen entre botellas, papeles y bolsas.
  return {trash: Math.min(1, scores.slice(1).reduce((total, value) => total + value, 0)), clear: scores[0]};
}
/** 5. DECISION BINARIA ESTABLE
 * Ordena las predicciones por nombre, mantiene las barras individuales y
 * agrega la suma de basura a una ventana deslizante de hasta cinco capturas.
 * Tras tres capturas, evalua el promedio contra el umbral de la interfaz.
 * Confirma tres evaluaciones consecutivas del mismo grupo, aunque cambie
 * la clase de basura predominante. Un resultado ambiguo conserva el historial.
 */
function displayScores(predictions) {
  const scores = EXPECTED_LABELS.map(label => {
    const prediction = predictions.find(p => p.className === label);
    if (!prediction) throw new Error('Las clases del modelo no coinciden.');
    return prediction.probability;
  });
  const grouped = aggregateScores(scores);
  scores.forEach((score, i) => {
    classRows[i].value.textContent = (score * 100).toFixed(1) + ' %';
    classRows[i].fill.style.width = (score * 100) + '%';
  });
  trashHistory.push(grouped.trash);
  if (trashHistory.length > AVERAGE_WINDOW) trashHistory.shift();
  const trash = trashHistory.reduce((total, value) => total + value, 0) / trashHistory.length;
  const clear = Math.max(0, 1 - trash);
  $('trashTotal').textContent = (trash * 100).toFixed(1) + ' %';
  $('trashFill').style.width = (trash * 100) + '%';
  $('trashNow').textContent = 'Suma actual: ' + (grouped.trash * 100).toFixed(1) + ' %';
  $('windowStatus').textContent = 'Promedio de ' + trashHistory.length + '/' + AVERAGE_WINDOW + ' capturas recientes.';
  if (trashHistory.length < MIN_AVERAGE_READINGS) {
    resetConfirmation();
    verdict('Analizando…', 'Reuniendo capturas para una conclusión estable.');
    return;
  }
  const threshold = Number($('threshold').value) / 100;
  const decision = trash + 1e-6 >= threshold ? 1 : clear + 1e-6 >= threshold ? 0 : -1;
  if (decision < 0) {
    // No borrar el historial: el promedio debe seguir avanzando en la transición.
    resetConfirmation();
    verdict('No seguro', 'Basura total: ' + (trash * 100).toFixed(1) +
      ' % · Sin basura: ' + (clear * 100).toFixed(1) + ' % en promedio.');
    return;
  }
  if (candidate === decision) streak = Math.min(streak + 1, REQUIRED_READINGS);
  else { candidate = decision; streak = 1; }
  const label = decision === 1 ? 'hay basura' : 'sin basura';
  if (streak < REQUIRED_READINGS) {
    verdict('Analizando…', 'Confirmando «' + label + '» · ' + streak + '/' + REQUIRED_READINGS + ' lecturas.');
  } else if (decision === 0) {
    verdict('Sin basura', 'Confianza conjunta: ' + (clear * 100).toFixed(1) + ' % en promedio.', 'clear');
  } else {
    verdict('Hay basura', 'Botellas + papeles/cartones + bolsas: ' + (trash * 100).toFixed(1) + ' % en promedio.', 'trash');
  }
}

/** 6. VIDEO: abre el flujo MJPEG del servidor del puerto 81. */
function playVideo() {
  clearTimeout(videoRetry); playing = true;
  $('live').hidden = false; $('livePlaceholder').hidden = true;
  $('live').src = 'http://' + location.hostname + ':81/stream?t=' + Date.now();
  $('videoToggle').textContent = 'Pausar video';
  $('cameraStatus').textContent = 'Video activo. Puedes tomar y descargar fotos.';
}
/** Cierra el visor de video sin cambiar el modo de deteccion. */
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

/** 7. ENTRADA DE IMAGENES
 * Solicita GET /capture sin cache y devuelve un Blob de imagen.
 * signal permite abortar la espera. Los errores HTTP se propagan al llamador.
 */
async function fetchCapture(signal) {
  const response = await fetch('/capture?t=' + Date.now(), {cache: 'no-store', signal});
  if (!response.ok) throw new Error('La cámara respondió con error ' + response.status + '.');
  const blob = await response.blob();
  if (!blob.size || !blob.type.startsWith('image/')) throw new Error('No llegó una imagen válida.');
  return blob;
}
/** Convierte el Blob JPEG en una imagen que se puede dibujar en canvas. */
async function decodePhoto(blob) {
  if (typeof createImageBitmap === 'function') return createImageBitmap(blob);
  const url = URL.createObjectURL(blob), image = new Image();
  try {
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url; });
    return image;
  } finally { URL.revokeObjectURL(url); }
}
/** Recorta el cuadrado central y lo escala a 224 x 224 px, siguiendo la
 * preparacion de Teachable Machine. La foto descargada conserva 800 x 600. */
function drawModelCrop(image) {
  // Mismo recorte central y redimensionado que cropTo de Teachable Machine.
  const canvas = $('crop'), size = 224;
  const width = image.width, height = image.height, scale = size / Math.min(width, height);
  const scaledW = Math.ceil(width * scale), scaledH = Math.ceil(height * scale);
  canvas.getContext('2d').drawImage(image, -Math.floor((scaledW - size) / 2),
    -Math.floor((scaledH - size) / 2), scaledW, scaledH);
  return canvas;
}
/** 8. PLANIFICACION: programa otro ciclo solo si el modelo esta activo y visible. */
function queueDetection(delay = INTERVAL_MS) {
  clearTimeout(detectionTimer);
  if (model && detectionEnabled && !document.hidden) detectionTimer = setTimeout(detectOnce, delay);
}
/** Ejecuta UN ciclo asincrono de captura e inferencia.
 * Usa una captura nueva, verifica epoch antes de publicar y evita solaparse.
 * Un fallo reinicia los datos anteriores; finally libera recursos y reprograma.
 */
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
/** 9. CONTROLES: pausa las capturas de inferencia y elimina resultados anteriores. */
function stopDetection() {
  detectionEnabled = false; epoch++; clearTimeout(detectionTimer);
  if (activeController) activeController.abort();
  resetDecision(true); $('detectToggle').textContent = 'Iniciar detección';
  verdict('Detección pausada', 'Pulsa Iniciar detección para analizar nuevas capturas.');
  $('modelStatus').textContent = model ? 'Modelo cargado · Detección pausada.' : 'Modelo no disponible.';
}
/** Activa la deteccion con historial nuevo y programa la primera captura. */
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
// Cambiar el umbral invalida resultados pendientes y exige capturas nuevas.
$('threshold').oninput = () => {
  $('thresholdValue').textContent = $('threshold').value + ' %';
  if (detectionEnabled) { epoch++; resetDecision(true); verdict('Analizando…', 'Confirmando con el nuevo umbral…'); }
};

// 11. FOTOGRAFIA MANUAL
// Obtiene otra captura original y crea una URL local para descargar el JPEG.
// Antes de reemplazar la foto anterior, libera su URL para no acumular memoria.
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

/** 10. CARGA DEL CLASIFICADOR
 * Carga /model.json, sus pesos y /metadata.json desde la propia XIAO.
 * Verifica que las etiquetas coincidan con EXPECTED_LABELS antes de inferir.
 * TensorFlow.js y Teachable Machine Image se ejecutan en este navegador.
 */
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
// 12. VISIBILIDAD Y CIERRE
// Una pestaña oculta detiene solicitudes y descarta resultados pendientes.
// Al volver se reconstruye la conclusion con nuevas capturas.
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
// 13. ARRANQUE DE LA PAGINA: cargar modelo, habilitar controles e iniciar captura.
(async () => {
  await loadModel();
  $('snap').disabled = false; $('videoToggle').disabled = false;
  if (!document.hidden) playVideo(); else visibilityPlaying = true;
  if (model) startDetection();
})();
