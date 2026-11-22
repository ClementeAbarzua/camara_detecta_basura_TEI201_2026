import { createDayOverview } from './chart-overview.js';
import { mergeChartEntries, lineSegments, conclusionSpans, nearestEntry, seriesPath, decisionStepSegments, decisionStepPath, windowAtOffset, localDayKey, localDayBounds, clampDayWindow } from './chart-data.js';

const NS = 'http://www.w3.org/2000/svg';
const pct = value => (100 * value).toFixed(1) + ' %';
const time = value => new Date(value).toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit', hour12:false });
const date = value => new Date(value).toLocaleString('es-CL');
function node(tag, attributes = {}, text) {
  const element = document.createElementNS(NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  if (text !== undefined) element.textContent = text;
  return element;
}

export function createCharts({ onUnauthorized = () => {}, onDayChange=()=>{}, onRefresh=()=>{} } = {}) {
  const $ = id => document.getElementById(id);
  let active = false, entries = [], cursor = null, duration = 5 * 60000, staleMs = 90000;
  let request = null, timer, resizeTimer, skew = 0, lastUpdated = null, limited = false, error = '';
  let selectedId = null, probability = null, spans = [], context = null;
  let live = true, viewEnd = null, earliest = null, navigationTimer, loaded = false;
  let selectedDay = localDayKey(Date.now()), fullDay = false, cache = null;
  let realtime = false, refreshQueued = false, policy = {windowSize:3,confirmationsRequired:2};
  let resizeSource = null;
  let sharedDay=null;
  const presetButtons = [...document.querySelectorAll('[data-chart-minutes]')];
  const scrollers = [...document.querySelectorAll('.historyScroller')];
  const positions = new WeakMap();
  const currentTime = () => Date.now() + skew;
  const domain = () => {
    if (live) selectedDay = localDayKey(currentTime());
    return localDayBounds(selectedDay);
  };
  function bounds() {
    const day = domain();
    return fullDay ? day : clampDayWindow(day, duration, live ? currentTime() : viewEnd ?? day.to);
  }
  function focusRecord(stamp) {
    if(!Number.isFinite(stamp))return;
    const day=domain(),span=fullDay?5*60000:Math.min(duration,60*60000);
    fullDay=false;
    navigate(clampDayWindow(day,span,stamp+span/2).to,span,true);
  }
  function fitRecords(first,last) {
    const day=domain(),span=Math.min(day.to-day.from,Math.max(60000,last-first+120000));
    fullDay=span===day.to-day.from;
    navigate(clampDayWindow(day,span,(first+last+span)/2).to,span,true);
  }
  function showLatest(stamp) {
    const day=localDayBounds(localDayKey(stamp));
    selectedDay=localDayKey(stamp);live=false;fullDay=false;$('chartDateError').hidden=true;
    navigate(clampDayWindow(day,5*60000,stamp+60000).to,5*60000,true);
  }
  const overview=createDayOverview({getDay:domain,getView:bounds,getNow:currentTime,onJump:focusRecord,onFit:fitRecords,onLastAvailable:showLatest,onResize:resizeVisibleWindow});
  function syncNavigation() {
    const extent = domain(), view = bounds(), span = extent.to - extent.from;
    if(sharedDay!==selectedDay){sharedDay=selectedDay;onDayChange(selectedDay);}
    const visible = view.to - view.from, travel = Math.max(0, span - visible);
    const fraction = travel ? Math.max(0, Math.min(1, (view.from - extent.from) / travel)) : 0;
    for (const bar of scrollers) {
      const width = bar.clientWidth || 800;
      bar.firstElementChild.style.width = Math.max(width, width * span / visible) + 'px';
      const offset = fraction * (bar.scrollWidth - bar.clientWidth);
      positions.set(bar, offset);
      if (Math.abs(bar.scrollLeft - offset) > .75) bar.scrollLeft = offset;
      bar.tabIndex = travel ? 0 : -1;
      bar.setAttribute('aria-disabled', String(!travel));
      bar.setAttribute('aria-label', `Recorrer el ${selectedDay}, de 00:00 a 24:00. ${travel ? 'Arrastra para cambiar de hora.' : 'Día completo visible. Elige un intervalo menor para desplazarte.'}`);
    }
    for (const label of document.querySelectorAll('.historyStart')) label.textContent = '00:00';
    for (const label of document.querySelectorAll('.historyEnd')) label.textContent = '24:00';
    $('chartDate').value = selectedDay;
    $('chartDate').max = localDayKey(currentTime());
    $('chartDate').min = earliest === null ? '' : localDayKey(earliest);
    $('previousChartDay').disabled = earliest !== null && selectedDay <= localDayKey(earliest);
    $('nextChartDay').disabled = selectedDay >= localDayKey(currentTime());
    for (const button of presetButtons) button.setAttribute('aria-pressed', String(
      Number(button.dataset.chartMinutes) === 1440 ? fullDay : !fullDay && duration === Number(button.dataset.chartMinutes) * 60000));
    $('chartMode').textContent = live ? '● En vivo · hoy' : 'Historial · ' + new Date(extent.from).toLocaleDateString('es-CL', {day:'numeric',month:'long',year:'numeric'});
    $('liveCharts').setAttribute('aria-pressed', String(live));
    const endLabel = view.to === extent.to ? '24:00' : time(view.to);
    const durationLabel = fullDay ? 'Día completo' + (span !== 86400000 ? ` (${span / 3600000} h por cambio de hora)` : '') : Math.round(visible / 60000 * 10) / 10 + ' min';
    $('chartRange').textContent = `Viendo ${time(view.from)} — ${endLabel} · ${durationLabel}`;
    $('zoomInCharts').disabled = visible <= 60000;
    $('zoomOutCharts').disabled = visible >= span;
    overview.render();
  }
  function frame(id, from, to, binary = false) {
    const svg = $(id), width = Math.max(300, svg.getBoundingClientRect().width || 800);
    const height = 280, left = binary ? (width < 450 ? 104 : 124) : 48, right = width - 16, top = 34, bottom = 224;
    const x = timestamp => left + (timestamp - from) / (to - from) * (right - left);
    const y = value => binary ? bottom - 24 - value * (bottom - top - 48) : bottom - value * (bottom - top);
    svg.replaceChildren(); svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.append(node('title', {}, svg.getAttribute('aria-label')));
    svg.append(node('text', { x:binary ? 8 : left, y:16, class:'chartAxisTitle' }, binary ? 'Conclusión' : 'Probabilidad de basura (%)'));
    const withDate = new Date(from).toDateString() !== new Date(to - 1).toDateString();
    const ticks = width < 450 ? (withDate ? 2 : 3) : 5;
    for (let i = 0; i < ticks; i++) {
      const stamp = from + (to - from) * i / (ticks - 1);
      const label = stamp === domain().to ? '24:00' : (withDate ? new Date(stamp).toLocaleDateString('es-CL', { day:'2-digit',month:'2-digit' }) + ' ' : '') + time(stamp);
      svg.append(node('text', { x:x(stamp), y:bottom + 22, 'text-anchor':i === 0 ? 'start' : i === ticks - 1 ? 'end' : 'middle', class:'chartAxis' }, label));
    }
    svg.append(node('text', { x:(left + right) / 2, y:height - 7, 'text-anchor':'middle', class:'chartAxisTitle' }, 'Hora de la medición'));
    return { svg, x, y, left, right, width, top, bottom, from, to };
  }
  function grid(ref, binary = false) {
    for (const value of binary ? [0, 1] : [0, .2, .4, .6, .8, 1]) {
      ref.svg.append(node('line', { x1:ref.left, x2:ref.right, y1:ref.y(value), y2:ref.y(value), class:'chartGrid' }));
      ref.svg.append(node('text', { x:ref.left - 10, y:ref.y(value) + 4, 'text-anchor':'end', class:binary ? 'decisionAxis ' + (value ? 'hasTrash' : 'noTrash') : 'chartAxis' }, binary ? (value ? 'Hay basura' : 'Sin basura') : Math.round(value * 100) + '%'));
    }
  }
  function shadeFuture(ref) {
    const present = currentTime();
    if (ref.to <= present) return;
    const start = Math.max(ref.from, present), width = ref.x(ref.to) - ref.x(start);
    ref.svg.append(node('rect', { x:ref.x(start), y:ref.top, width, height:ref.bottom - ref.top, fill:'var(--chart-future)' }));
    if (width > 100) ref.svg.append(node('text', { x:ref.x(start) + width / 2, y:ref.top + 19, 'text-anchor':'middle', class:'chartFutureLabel' }, 'Horas futuras'));
  }
  function addSeries(ref, segments, value, color, thick = 2, dashed = false) {
    if (!segments.length) return;
    ref.svg.append(node('path', { d:seriesPath(segments, ref.x, ref.y, value, dashed), fill:'none', stroke:color, 'stroke-width':thick,
      ...(dashed ? { 'stroke-dasharray':'5 5' } : {}), 'stroke-linejoin':'round', 'stroke-linecap':'round' }));
    for (const segment of segments) if (segment.length === 1)
      ref.svg.append(node('circle', { cx:ref.x(segment[0].receivedAt), cy:ref.y(value(segment[0])), r:3, fill:color }));
  }
  function shadeThresholds(ref, segments) {
    for (const segment of segments) {
      const first = segment[0], last = segment.at(-1);
      for (const [edge, value, color] of [[1, row => row.threshold, 'var(--chart-trash-zone)'], [0, row => 1 - row.threshold, 'var(--chart-clear-zone)']]) {
        const boundary = seriesPath([segment], ref.x, ref.y, value, true);
        const d = boundary + `L${ref.x(last.receivedAt).toFixed(1)},${ref.y(edge).toFixed(1)}H${ref.x(first.receivedAt).toFixed(1)}Z`;
        ref.svg.append(node('path', { d, fill:color, stroke:'none' }));
      }
    }
  }
  function mark(ref) {
    ref.marker = node('line', { y1:ref.top, y2:ref.bottom, class:'chartCursor' }); ref.svg.append(ref.marker);
    ref.dot = node('circle', { r:4, fill:'var(--chart-average)', stroke:'var(--surface)', 'stroke-width':2 }); ref.svg.append(ref.dot);
  }
  function selection() {
    const row = entries.find(item => item.id === selectedId) ?? entries.at(-1);
    if (probability) {
      probability.marker.setAttribute('visibility', row ? 'visible' : 'hidden'); probability.dot.setAttribute('visibility', row ? 'visible' : 'hidden');
      if (row) {
        const px = probability.x(row.receivedAt); probability.marker.setAttribute('x1', px); probability.marker.setAttribute('x2', px);
        probability.dot.setAttribute('cx', px); probability.dot.setAttribute('cy', probability.y(row.trashAverage));
      }
    }
    $('probabilityAverage').textContent = row ? pct(row.trashAverage) : '—';
    $('probabilityCapture').textContent = row ? pct(row.trashNow) : '—';
    $('averageSamples').textContent = row ? `Promedio de ${row.readings} ${row.readings === 1 ? 'captura' : 'capturas'}` : `Promedio de hasta ${policy.windowSize} capturas`;
    $('detectionTooltip').textContent = row ? `${selectedId === null ? 'Última captura del intervalo' : 'Captura seleccionada'}: ${date(row.receivedAt)} · ${row.conclusion} · Confirmaciones seguidas: ${row.streak}.` : 'No hay mediciones en este intervalo.';
    $('thresholdGuide').textContent = row ? `En esta medición: ≤ ${pct(1 - row.threshold)} apoya «Sin basura»; ≥ ${pct(row.threshold)} apoya «Hay basura». Entre ambos, la evidencia es intermedia.` : 'Los límites punteados muestran los umbrales de decisión.';
  }
  function timestampAt(event, ref) {
    const box = ref.svg.getBoundingClientRect();
    const px = (event.clientX - box.left) / box.width * ref.width;
    return ref.from + Math.max(0, Math.min(1, (px - ref.left) / (ref.right - ref.left))) * (ref.to - ref.from);
  }
  function interactProbability(ref) {
    const inspect = event => { selectedId = nearestEntry(entries, timestampAt(event, ref))?.id ?? null; selection(); };
    ref.svg.onpointermove = inspect; ref.svg.onpointerdown = inspect;
    ref.svg.onpointerleave = () => { selectedId = null; selection(); };
    ref.svg.onkeydown = event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || !entries.length) return;
      event.preventDefault();
      const start = selectedId === null ? entries.length - 1 : Math.max(0, entries.findIndex(row => row.id === selectedId));
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? entries.length - 1 : Math.max(0, Math.min(entries.length - 1, start + (event.key === 'ArrowLeft' ? -1 : 1)));
      selectedId = entries[index].id; selection();
    };
  }
  function showDecision(stamp) {
    if (stamp > currentTime()) {
      $('stepState').textContent = 'Aún no ocurre'; $('stepState').className = 'decisionTag future';
      $('stepTime').textContent = date(stamp);
      $('stepTooltip').textContent = 'Esta hora aún no ha ocurrido. No hay una conclusión disponible.'; return;
    }
    const span = spans.find(item => stamp >= item.from && stamp < item.to);
    const label = !span ? 'Sin datos recientes' : span.conclusion === 'No seguro' ? 'Sin confirmar' : span.conclusion;
    $('stepState').textContent = label;
    $('stepState').className = 'decisionTag ' + (!span ? 'missing' : span.conclusion === 'No seguro' ? 'unsure' : span.conclusion === 'Hay basura' ? 'trash' : 'clear');
    $('stepTime').textContent = date(stamp);
    $('stepTooltip').textContent = !span ? 'No hay una medición vigente en este momento del gráfico.' : span.conclusion === 'No seguro' ? 'El sistema aún no confirma ninguno de los dos resultados. Por eso la línea se interrumpe.' : `Conclusión confirmada entre ${time(span.from)} y ${time(span.to)}. La altura indica el resultado, no un porcentaje.`;
  }
  function drawDecision(from, to) {
    const ref = frame('decisionChart', from, to, true);
    const defs = node('defs'), pattern = node('pattern', { id:'noDataPattern', width:8, height:8, patternUnits:'userSpaceOnUse' });
    pattern.append(node('rect', { width:8, height:8, fill:'var(--chart-nodata)' }), node('path', { d:'M0,8L8,0', stroke:'var(--chart-hatch)', 'stroke-width':1 })); defs.append(pattern); ref.svg.append(defs);
    ref.svg.append(node('rect', { x:ref.left, y:ref.top, width:ref.right - ref.left, height:ref.bottom - ref.top, fill:'url(#noDataPattern)' }));
    for (const span of spans) ref.svg.append(node('rect', { x:ref.x(span.from), y:ref.top, width:ref.x(span.to) - ref.x(span.from), height:ref.bottom - ref.top, fill:span.conclusion === 'No seguro' ? 'var(--chart-unsure)' : 'var(--surface)' }));
    shadeFuture(ref);
    grid(ref, true);
    const runs = decisionStepSegments(spans);
    ref.svg.append(node('path', { d:decisionStepPath(runs, ref.x, ref.y), class:'decisionLine', fill:'none' }));
    for (const run of runs) for (const point of [run[0], run.at(-1)])
      ref.svg.append(node('circle', { cx:ref.x(point.at), cy:ref.y(point.value), r:3.5, fill:point.value ? 'var(--chart-trash)' : 'var(--chart-clear)' }));
    const marker = node('line', { y1:ref.top, y2:ref.bottom, class:'chartCursor' }); ref.svg.append(marker);
    const inspect = stamp => { showDecision(stamp); marker.setAttribute('visibility', 'visible'); marker.setAttribute('x1', ref.x(stamp)); marker.setAttribute('x2', ref.x(stamp)); };
    ref.svg.onpointermove = event => inspect(timestampAt(event, ref)); ref.svg.onpointerdown = ref.svg.onpointermove;
    ref.svg.onpointerleave = () => { marker.setAttribute('visibility', 'hidden'); showDecision(Math.max(from, Math.min(to - 1, currentTime() - 1))); };
    ref.svg.onpointerenter = () => marker.setAttribute('visibility', 'visible');
    let index = spans.length - 1;
    ref.svg.onkeydown = event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || !spans.length) return;
      event.preventDefault(); index = event.key === 'Home' ? 0 : event.key === 'End' ? spans.length - 1 : Math.max(0, Math.min(spans.length - 1, index + (event.key === 'ArrowLeft' ? -1 : 1)));
      marker.setAttribute('visibility', 'visible'); inspect((spans[index].from + spans[index].to) / 2);
    };
    marker.setAttribute('visibility', 'hidden'); showDecision(Math.max(from, Math.min(to - 1, currentTime() - 1)));
    $('stepEmpty').hidden = !entries.length || runs.length > 0;
  }
  function render() {
    if (!active) return;
    const { from, to } = bounds(); entries = mergeChartEntries(entries, [], from, to);
    spans = conclusionSpans(context ? [context, ...entries] : entries, from, Math.min(to, currentTime()), staleMs); drawDecision(from, to);
    const segments = lineSegments(entries, staleMs);
    probability = frame('detectionChart', from, to);
    shadeThresholds(probability, segments); shadeFuture(probability); grid(probability);
    addSeries(probability, segments, row => row.threshold, 'var(--chart-trash)', 1.3, true);
    addSeries(probability, segments, row => 1 - row.threshold, 'var(--chart-clear)', 1.3, true);
    if ($('showCaptures').checked) addSeries(probability, segments, row => row.trashNow, 'var(--chart-capture)', 1.2);
    addSeries(probability, segments, row => row.trashAverage, 'var(--chart-average)', 3);
    mark(probability); interactProbability(probability); selection();
    $('chartStatus').textContent = error || (lastUpdated ? `${entries.length} mediciones · ${live ? (realtime ? 'Actualización al recibir mediciones' : 'Actualización automática cada 2 s') : 'Historial cargado'}.` + (limited ? ' Hay más de 6000 mediciones en este intervalo: acerca el zoom para ver todas las del tramo.' : '') : 'Cargando este tramo… Las marcas del mapa siguen disponibles.');
    $('chartStatus').classList.toggle('chartFailure', !!error);
    $('chartEmpty').textContent = from >= currentTime() ? 'Este tramo de hoy aún no ocurre. Desplaza la barra hacia una hora anterior o vuelve al vivo.' : 'No hay mediciones en este tramo. Prueba otra hora, otro intervalo o una fecha distinta.';
    $('chartEmpty').hidden = entries.length > 0 || !lastUpdated || !!error;
    syncNavigation();
  }

  function applyData(data, fromCache = false) {
    if(error && !fromCache)overview.reload(false);
    if (!fromCache) skew = data.now - Date.now();
    staleMs = data.staleMs; cursor = data.cursor;
    if ('earliestAt' in data) earliest = data.earliestAt;
    if ('latestAt' in data) overview.setLatest(data.latestAt);
    const view = bounds();
    // El fin del dia es exclusivo: una captura de las 00:00 pertenece al dia siguiente.
    const incoming = mergeChartEntries(entries, data.entries, data.from, data.to).filter(row => row.receivedAt < domain().to);
    context = [...(data.context ? [data.context] : []), ...incoming.filter(row => row.receivedAt < view.from)].at(-1) ?? null;
    limited = limited || data.truncated || entries.length + data.entries.length > 6000;
    entries = mergeChartEntries(incoming, [], view.from, view.to);
    if (earliest === null && entries.length) earliest = entries[0].receivedAt;
    loaded = true; lastUpdated = data.now; error = '';
    overview.render(); overview.accept(data.entries); render();
  }
  async function refresh(reset = false) {
    clearTimeout(timer);
    if (!active || document.hidden || (request && !reset)) return;
    if (reset) {
      const old = request; request = null; old?.abort();
      entries = []; context = null; cursor = null; lastUpdated = null; selectedId = null; limited = false; error = ''; loaded = false; render();
    }
    const view = bounds(), queryTo = Math.min(view.to, currentTime());
    // Las horas futuras se muestran vacias y no se envian como fechas futuras a la API.
    if (view.from >= queryTo) {
      entries = []; context = null; loaded = true; lastUpdated = currentTime(); error = ''; render();
      if (live && !realtime) timer = setTimeout(refresh, 2000); return;
    }
    // Reusar un dia ya consultado permite desplazarse y acercar sin repetir consultas.
    if (!live && cache && view.from >= cache.from && queryTo <= cache.to) { applyData(cache, true); return; }
    const controller = new AbortController(); request = controller;
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const params = new URLSearchParams(earliest === null && live && !loaded ?
        { minutes:String((fullDay ? 1440 : duration / 60000)) } : { from:String(Math.floor(view.from)), to:String(Math.floor(queryTo)) });
      if (live && loaded && cursor !== null) params.set('after', cursor);
      const response = await fetch('/api/chart-history?' + params, { cache:'no-store', signal:controller.signal });
      if (request !== controller || !active) return;
      if (response.status === 401) { onUnauthorized(); return; }
      const data = await response.json();
      if (request !== controller || !active) return;
      if (!response.ok) throw new Error(data.error || 'No se pudieron consultar los gráficos.');
      if (!live && !data.truncated && (!cache || data.from < cache.from || data.to > cache.to)) cache = data;
      applyData(data);
    } catch (cause) {
      if (request !== controller || !active) return;
      error = 'No se pudieron actualizar los gráficos. ' + (entries.length ? 'Se conservan los datos anteriores.' : 'Pulsa Actualizar gráficos para reintentar.'); render();
    } finally {
      clearTimeout(timeout);
      if (request === controller) {
        request = null;
        if (active && live && !document.hidden) {
          if (refreshQueued) { refreshQueued = false; timer = setTimeout(refresh, 0); }
          else if (!realtime) timer = setTimeout(refresh, 2000);
        }
      }
    }
  }

  function navigate(to, nextDuration = duration, immediate = false) {
    resizeSource = null;
    clearTimeout(timer); clearTimeout(navigationTimer);
    const old = request; request = null; old?.abort();
    duration = nextDuration; live = false; viewEnd = to; refreshQueued = false;
    entries = []; context = null; selectedId = null; cursor = null; lastUpdated = null; loaded = false; limited = false; error = '';
    const view=bounds();
    if(cache && view.from>=cache.from && Math.min(view.to,currentTime())<=cache.to) { applyData(cache,true); return; }
    render();
    if (immediate) refresh(true); else navigationTimer = setTimeout(() => refresh(true), 180);
  }
  function resizeVisibleWindow(view,{commit}) {
    if(!active)return;
    const day=domain();
    fullDay=view.to-view.from===day.to-day.from;
    if(commit){navigate(view.to,view.to-view.from,true);return;}
    clearTimeout(timer);clearTimeout(navigationTimer);
    const old=request;request=null;old?.abort();refreshQueued=false;
    resizeSource ??= {entries:[...entries],context,limited};
    live=false;viewEnd=view.to;duration=view.to-view.from;
    if(cache && view.from>=cache.from && Math.min(view.to,currentTime())<=cache.to){applyData(cache,true);return;}
    const available=[...(resizeSource.context?[resizeSource.context]:[]),...resizeSource.entries];
    context=available.filter(row=>row.receivedAt<view.from).at(-1)??null;
    entries=mergeChartEntries(resizeSource.entries,[],view.from,view.to);limited=resizeSource.limited;error='';
    render();$('chartStatus').textContent='Ajustando intervalo… Al soltar se cargarán las mediciones del tramo elegido.';
  }
  for (const bar of scrollers) {
    bar.onscroll = () => {
      if (!active || Math.abs(bar.scrollLeft - (positions.get(bar) ?? -100)) < .75) return;
      const distance = bar.scrollWidth - bar.clientWidth;
      if (distance <= 0) return;
      const view = windowAtOffset(domain(), bounds().to - bounds().from, bar.scrollLeft / distance);
      // Llegar al extremo derecho no reactiva el vivo accidentalmente.
      navigate(view.to);
    };
  }
  function setIntervalView(nextDuration, whole = false) {
    const view = bounds(), extent = domain(), wasLive = live;
    const center = (view.from + view.to) / 2;
    fullDay = whole;
    const target = whole ? extent.to : clampDayWindow(extent, nextDuration, wasLive ? currentTime() : center + nextDuration / 2).to;
    navigate(target, nextDuration);
    if (wasLive) { live = true; viewEnd = null; render(); }
  }
  function zoom(factor) {
    const extent = domain(), span = extent.to - extent.from;
    const nextDuration = Math.max(60000, Math.min(Math.round((bounds().to - bounds().from) * factor), span));
    setIntervalView(nextDuration, nextDuration === span);
  }
  function chooseDay(key) {
    const day = localDayBounds(key), today = localDayKey(currentTime());
    if (!day || key > today || (earliest !== null && key < localDayKey(earliest))) {
      $('chartDateError').textContent = 'Elige una fecha entre el inicio del historial y hoy.'; $('chartDateError').hidden = false;
      $('chartDate').value = selectedDay; return;
    }
    $('chartDateError').hidden = true; selectedDay = key; live = false; fullDay = true;
    navigate(day.to, day.to - day.from, true);
  }
  $('chartDate').onchange = () => chooseDay($('chartDate').value);
  function shiftDay(offset) {
    const value = new Date(domain().from); value.setHours(12, 0, 0, 0); value.setDate(value.getDate() + offset);
    chooseDay(localDayKey(value));
  }
  $('previousChartDay').onclick = () => shiftDay(-1);
  $('nextChartDay').onclick = () => shiftDay(1);
  for (const button of presetButtons) button.onclick = () => {
    const minutes = Number(button.dataset.chartMinutes);
    setIntervalView(minutes * 60000, minutes === 1440);
  };
  $('zoomInCharts').onclick = () => zoom(.5);
  $('zoomOutCharts').onclick = () => zoom(2);
  $('liveCharts').onclick = () => {
    resizeSource = null;
    clearTimeout(navigationTimer); live = true; viewEnd = null; fullDay = false; duration = 5 * 60000; cache = null;
    $('chartDateError').hidden = true; refresh(true);
  };
  $('showCaptures').onchange = () => render();
  $('refreshCharts').onclick = () => { clearTimeout(navigationTimer); cache = null; overview.reload(); refresh(true); onRefresh(); };
  document.addEventListener('visibilitychange', () => {
    clearTimeout(timer); clearTimeout(navigationTimer);
    if (document.hidden) { const old = request; request = null; old?.abort(); }
    else if (active && (live || !loaded)) refresh(!loaded);
  });
  const resize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(render, 100); };
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe($('chartSections'));
  else window.addEventListener('resize', resize);
  return {
    focusRange({from,to}){
      const day=domain();from=Math.max(day.from,from);to=Math.min(day.to,to);
      if(Number.isFinite(from)&&Number.isFinite(to)&&from<to){fullDay=false;navigate(to,to-from,true);}
    },
    setPolicy(next) {
      policy = next;
      $('chartWindowDescription').textContent = `La línea gruesa muestra Botellas + Papeles y Cartones + Bolsas. Configuración actual: promedio de hasta ${next.windowSize} capturas. Cada registro anterior conserva su promedio original.`;
      $('chartDecisionHelp').textContent = `Configuración actual: ${next.confirmationsRequired} evaluaciones consecutivas para confirmar. El porcentaje no representa cantidad ni volumen de residuos.`;
    },
    setRealtime(connected) {
      const reconnect=connected && !realtime;
      realtime = connected; clearTimeout(timer);
      if(reconnect)overview.reload(false);
      if (!connected && active && live && !document.hidden && !request) timer = setTimeout(refresh, 2000);
    },
    notify() {
      if (!active || !live || document.hidden) return;
      if (request) refreshQueued = true; else refresh();
    },
    start() { if (!active) { active = true; live = true; viewEnd = null; overview.start(); refresh(true); } },
    stop() {
      resizeSource = null;
      active = false; overview.stop(); refreshQueued = false; clearTimeout(timer); clearTimeout(navigationTimer); clearTimeout(resizeTimer);
      const old = request; request = null; old?.abort();
      entries = []; context = null; cursor = null; selectedId = null; probability = null; spans = []; lastUpdated = null; loaded = false; cache = null;
      for (const id of ['detectionChart', 'decisionChart']) $(id).replaceChildren();
      for (const id of ['detectionTooltip', 'stepTooltip', 'stepState', 'stepTime', 'chartStatus', 'probabilityAverage', 'probabilityCapture', 'thresholdGuide', 'chartRange', 'chartMode']) $(id).textContent = '';
    }
  };
}
