'use strict';
import { createCharts } from './charts.js';
import {DEFAULT_ROI,roiBounds} from './roi-geometry.js';
import {decisionProgress} from './decision-progress.js';
import {createLiveDecision} from './dashboard-live.js';
import {createDecisionTrends} from './decision-trends.js';
const $ = id => document.getElementById(id);
const liveDecision=createLiveDecision({get:$,document,schedule:setTimeout,cancel:clearTimeout});
const trends=createDecisionTrends({get:$,document,request:(...args)=>fetch(...args),schedule:setTimeout,cancel:clearTimeout,onExplore:range=>{charts.focusRange(range);$('decisionTitle').scrollIntoView?.({block:'start',behavior:globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}});
const charts = createCharts({onDayChange:key=>trends.selectDay(key),onRefresh:()=>trends.refresh()});
const labels = ['Sin basura', 'Hay basura'];
const rows = labels.map(label => {
  const row = document.createElement('div'); row.className = 'classRow';
  const title = document.createElement('div'); title.className = 'classLabel';
  const name = document.createElement('span'); name.textContent = label;
  const value = document.createElement('strong'); value.textContent = '—';
  const bar = document.createElement('div'); bar.className = 'bar';
  const fill = document.createElement('div'); bar.append(fill); title.append(name, value); row.append(title, bar); $('classes').append(row);
  return { value, fill };
});
let timer, busy = false, last = null, staleMs = 90000;
let stream = null, streamConnected = false, queued = false, policyPending = false;
let policy = {profile:'demo',windowSize:3,minimumReadings:3,confirmationsRequired:2};
let historyEntries = [], historyCursor = null, historyBusy = false, historyLoaded = false;
let camera = { rotation: 180, version: '0' }, cameraKnown = false;
let activeThreshold = .8;
let apiError=false;
const percent = value => (100 * value).toFixed(1) + ' %';
function acceptCamera(next) {
  // Una respuesta atrasada de otra consulta no deshace el cambio recien guardado.
  if (cameraKnown && BigInt(next.version) < BigInt(camera.version)) return;
  camera = next; cameraKnown = true;
}
function render() {
  const pending = last && cameraKnown && (last.rotation ?? 0) !== camera.rotation;
  const fresh = last && !camera.paused && !pending && !policyPending && Date.now() - last.receivedAt <= staleMs;
  $('orientationStatus').textContent = cameraKnown ? (camera.rotation === 180 ? 'Orientación: girada 180°.' : 'Orientación: normal (0°).') +
    (pending ? ' Esperando una nueva captura para actualizar el análisis.' : ' El giro se aplica a la imagen y al análisis.') : 'Consultando orientación…';
  $('photo').classList.toggle('upsideDown', !!last && cameraKnown && camera.rotation !== (last.rotation ?? 0));
  const age = last ? Math.max(0, Math.floor((Date.now() - last.receivedAt) / 1000)) : null;
  $('connection').textContent = camera.paused ? 'Capturas y análisis pausados por el administrador' : pending ? 'Esperando captura con la nueva orientación' : (fresh ? 'Cámara enviando mediciones' : (last ? 'Sin mediciones recientes' : 'Esperando la primera captura'));
  $('dot').className = 'dot' + (fresh ? ' online' : '');
  const progress=decisionProgress({state:last,online:!!fresh,configurationPending:!!(pending||policyPending),policy});
  $('decisionProgress').setAttribute('data-phase',progress.phase);
  $('progressTitle').textContent=progress.title;$('progressHelp').textContent=progress.detail;
  $('captureCount').textContent=`${progress.samples} / ${progress.requiredSamples}`;
  $('confirmationCount').textContent=`${progress.confirmations} / ${progress.requiredConfirmations}`;
  $('captureProgress').max=progress.requiredSamples;$('captureProgress').value=progress.samples;
  $('confirmationProgress').max=progress.requiredConfirmations;$('confirmationProgress').value=progress.confirmations;
  if(camera.paused){$('progressTitle').textContent='Detección en pausa';$('progressHelp').textContent='La siguiente captura al reanudar iniciará un promedio nuevo.';}
  $('age').textContent = age === null ? '—' : 'Última captura hace ' + age + ' s';
  const conclusion = apiError ? 'Sin conexión con el servidor' : camera.paused ? 'Capturas y análisis pausados' : policyPending ? 'Esperando capturas con los nuevos ajustes' : pending ? 'Esperando nueva captura' : (fresh ? last.conclusion : (last ? 'Sin datos recientes' : 'Esperando datos'));
  $('conclusion').textContent = conclusion;
  $('result').className = 'card result' + (fresh && conclusion === 'Hay basura' ? ' trash' : (fresh && conclusion === 'Sin basura' ? ' clear' : ''));
  liveDecision.render({state:last,fresh:!!fresh,paused:!!camera.paused,pending:!!(pending||policyPending),error:apiError,realtime:streamConnected});
  $('detail').textContent=camera.paused ? 'El historial se conserva. El administrador puede reanudar la detección.' : progress.phase==='collecting' ? 'Todavía faltan capturas para empezar a evaluar.' : progress.phase==='confirming' ? 'El promedio apoya un resultado. Falta confirmarlo con las siguientes capturas.' : progress.phase==='uncertain' ? 'La evidencia es ambigua: aún no apoya una conclusión clara.' : progress.phase==='confirmed' ? 'La conclusión reúne las capturas y confirmaciones necesarias.' : progress.detail;
  if(apiError)$('detail').textContent='No se puede confirmar el estado actual hasta recuperar la conexión.';
  // La barra expresa confianza en la conclusion mostrada. La suma de basura
  // se mantiene separada: para "Sin basura" usamos su complemento.
  const confidence = fresh && conclusion === 'Hay basura' ? last.trashAverage :
    (fresh && conclusion === 'Sin basura' ? 1 - last.trashAverage : null);
  $('confidenceLabel').textContent = confidence === null ? 'Confianza estimada en la conclusión' :
    (conclusion === 'Hay basura' ? 'Confianza de que hay basura' : 'Confianza de que no hay basura');
  $('total').textContent = confidence === null ? '—' : percent(confidence);
  $('confidenceBar').hidden = confidence === null;
  $('totalFill').style.width = confidence === null ? '0%' : confidence * 100 + '%';
  $('confidenceHelp').textContent = confidence === null ? 'El porcentaje aparecerá cuando haya una conclusión confirmada.' :
    'Confianza estimada del modelo, calculada con el promedio de las últimas capturas.';
  $('trashAverage').textContent = fresh ? percent(last.trashAverage) : '—';
  $('averageLabel').textContent = fresh ? `Promedio de basura · ${last.readings} ${last.readings === 1 ? 'captura' : 'capturas'}` : 'Promedio de basura de las últimas capturas';
  const captureScores = fresh ? [last.scores[0], last.trashNow] : [0, 0];
  rows.forEach((row, i) => { row.value.textContent = fresh ? percent(captureScores[i]) : '—'; row.fill.style.width = captureScores[i] * 100 + '%'; });
  $('window').textContent = fresh ? `Promedio móvil de ${last.readings} capturas. Cada confirmación evalúa un promedio actualizado; no es un grupo independiente de capturas.` : 'La lectura anterior no se presenta como una medición actual.';
  $('threshold').textContent = `Sobre el promedio: Hay basura ≥ ${percent(activeThreshold)} · Sin basura ≤ ${percent(1 - activeThreshold)}. Entre ambos: No seguro.`;
  $('decisionRules').textContent = `${policy.profile === 'demo' ? 'Modo demo' : 'Modo estable'}: promedio de hasta ${policy.windowSize} capturas y ${policy.confirmationsRequired} evaluaciones consecutivas para confirmar.`;
  $('received').textContent = last ? new Date(last.receivedAt).toLocaleString('es-CL') : '—';
  $('analysis').textContent = last ? last.analysisMs + ' ms' : '—';
  if(last?.preview){
    const width=last.imageWidth || $('photo').naturalWidth || 800,height=last.imageHeight || $('photo').naturalHeight || 600;
    const region=(pending||policyPending) ? roiBounds(width,height,camera.roi ?? DEFAULT_ROI) : last.analysisRegion ?? roiBounds(width,height,last.roi ?? DEFAULT_ROI);
    $('photoFrame').style.aspectRatio=width+'/'+height;
    $('crop').style.left=region.x*100+'%';$('crop').style.top=region.y*100+'%';
    $('crop').style.width=region.width*100+'%';$('crop').style.height=region.height*100+'%';
  }
}
async function poll() {
  clearTimeout(timer);
  if (document.hidden) return;
  if (busy) { queued = true; return; }
  busy = true;
  try {
    const response = await fetch('/api/state', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo consultar el servidor.');
    const previousStamp=last?.receivedAt;apiError=false;
    acceptCamera(data.camera); last = data.state; staleMs = data.staleMs;
    activeThreshold = data.camera.threshold ?? last?.threshold ?? .8;
    policy = data.decision ?? {profile:'stable',windowSize:last?.windowSize ?? 5,minimumReadings:3,confirmationsRequired:last?.confirmationsRequired ?? 3};
    policyPending = !!data.policyPending; charts.setPolicy?.(policy);
    if (last?.preview) {
      const source = 'data:image/jpeg;base64,' + last.preview;
      if ($('photo').getAttribute('src') !== source) $('photo').src = source;
      $('photo').hidden = false; $('crop').hidden = false; $('photoEmpty').hidden = true;
    } else { $('photo').hidden = true; $('crop').hidden = true; $('photoEmpty').hidden = false; }
    $('notice').textContent = ''; render();
    if(last?.receivedAt!==previousStamp)trends.notify();
    if (!historyLoaded && !historyBusy) loadHistory(true);
  } catch (error) {
    apiError=true;last = null; render(); $('notice').textContent = error.message || 'No se pudo conectar. Intenta nuevamente.';
  } finally {
    busy = false;
    if (!document.hidden) {
      if (queued) { queued = false; timer = setTimeout(poll, 0); }
      else if (!streamConnected) timer = setTimeout(poll, 2000);
    }
  }
}
async function loadHistory(reset = false) {
  if (historyBusy) return;
  historyBusy = true;
  $('refreshHistory').disabled = true; $('moreHistory').disabled = true;
  $('historyStatus').textContent = 'Consultando historial…';
  try {
    const query = new URLSearchParams({ limit: '50' });
    if (!reset && historyCursor) query.set('before', historyCursor);
    const response = await fetch('/api/history?' + query, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No se pudo leer el historial.');
    if (reset) { historyEntries = []; $('historyRows').replaceChildren(); }
    const known = new Set(historyEntries.map(row => row.id));
    const newEntries = data.entries.filter(row => !known.has(row.id));
    historyEntries.push(...newEntries); historyCursor = data.nextCursor; historyLoaded = true;
    for (const row of newEntries) {
      const tr = document.createElement('tr');
      const values = [new Date(row.receivedAt).toLocaleString('es-CL'), row.conclusion, percent(row.trashNow), percent(row.trashAverage), ...row.scores.map(percent)];
      for (const value of values) { const td = document.createElement('td'); td.textContent = value; tr.append(td); }
      $('historyRows').append(tr);
    }
    $('historyStatus').textContent = historyEntries.length ? `${historyEntries.length} registros cargados · Consulta: ${new Date().toLocaleTimeString('es-CL')}` : 'Aún no hay mediciones guardadas. El historial comienza al recibir fotos con esta versión.';
    $('moreHistory').hidden = !historyCursor;
  } catch (error) {
    $('historyStatus').textContent = error.message || 'No se pudo consultar el historial.';
  } finally {
    historyBusy = false; $('refreshHistory').disabled = false; $('moreHistory').disabled = false;
  }
}
$('refreshHistory').onclick = () => loadHistory(true);
$('moreHistory').onclick = () => loadHistory(false);
$('photo').addEventListener('load',render);
function disconnectStream() {
  const old = stream; stream = null; old?.close(); streamConnected = false;
  charts.setRealtime?.(false);
}
function connectStream() {
  if (document.hidden || stream || typeof EventSource === 'undefined') return;
  const events = new EventSource('/api/events'); stream = events;
  const update = () => {
    if (stream !== events || document.hidden) return;
    streamConnected = true; clearTimeout(timer); charts.setRealtime?.(true);
    poll(); charts.notify?.();
  };
  events.addEventListener('ready', update);
  events.addEventListener('measurement', update);
  events.onerror = () => {
    if (stream !== events) return;
    streamConnected = false; charts.setRealtime?.(false);
    // EventSource reintenta solo; mientras tanto se consultan datos cada 2 s.
    if (!document.hidden) poll();
  };
}
document.addEventListener('visibilitychange', () => {
  clearTimeout(timer);
  if (document.hidden) disconnectStream(); else { connectStream(); poll(); }
});
setInterval(() => { if (!document.hidden) render(); }, 1000);
trends.start();charts.start();
connectStream();
poll();
