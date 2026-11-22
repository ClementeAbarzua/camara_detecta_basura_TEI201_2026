// Datos originales del historial. No se recalculan las conclusiones del servidor.
export const STATE_COLORS = { 'Hay basura': '#c66742', 'Sin basura': '#258263', 'No seguro': '#89968d' };

// El deslizador representa todo el historial; la ventana visible no depende de presets.
export function historyDomain(earliest, now, duration) {
  return { from:Math.min(earliest ?? now - duration, now - duration), to:now };
}
export function windowAtOffset(domain, duration, fraction) {
  const span = Math.min(duration, domain.to - domain.from);
  const from = Math.round(domain.from + Math.max(0, Math.min(1, fraction)) * (domain.to - domain.from - span));
  return { from, to:from + span };
}

export function localDayKey(timestamp) {
  const value = new Date(timestamp);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}
export function localDayBounds(key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const [year, month, day] = key.split('-').map(Number);
  const start = new Date(year, month - 1, day);
  if (localDayKey(start) !== key) return null;
  // Usar el calendario local, no sumar 86400000: los cambios de hora dan dias de 23/25 h.
  return { from:start.getTime(), to:new Date(year, month - 1, day + 1).getTime() };
}
export function clampDayWindow(day, duration, end) {
  const span = Math.min(duration, day.to - day.from);
  const to = Math.max(day.from + span, Math.min(day.to, end));
  return { from:to - span, to };
}
// Ajustar un extremo sin desplazar el otro ni salir del día (también días de 23/25 h).
export function resizeDayWindow(day, view, edge, timestamp, minimum = 60000) {
  if (!['start','end'].includes(edge) || !Number.isFinite(timestamp) || !Number.isFinite(minimum) || minimum <= 0 ||
      !day || !view || day.from >= day.to || view.from < day.from || view.to > day.to || view.from >= view.to)
    throw new Error('Intervalo de selección inválido.');
  const span = Math.min(minimum, view.to - view.from), target = Math.round(timestamp);
  return edge === 'start' ? {from:Math.max(day.from,Math.min(view.to-span,target)),to:view.to} :
    {from:view.from,to:Math.min(day.to,Math.max(view.from+span,target))};
}

export function coverageSessions(bins, gapMs = 90000) {
  const sessions=[];
  for (const bin of bins) {
    const previous=sessions.at(-1);
    if (previous && bin.firstAt-previous.to<=Math.max(60000,gapMs)) {
      previous.to=Math.max(previous.to,bin.lastAt);previous.count+=bin.count;
    } else sessions.push({from:bin.firstAt,to:bin.lastAt,count:bin.count});
  }
  return sessions;
}
export function nearestCoverageTimestamp(bins, timestamp) {
  let best=null,distance=Infinity;
  for (const bin of bins) for (const stamp of [bin.firstAt,bin.lastAt])
    if (Math.abs(stamp-timestamp)<distance) {best=stamp;distance=Math.abs(stamp-timestamp);}
  return best;
}
// Completar el mapa con avisos nuevos sin contar dos veces IDs ya agregados en SQL.
export function extendCoverage(coverage, entries, day) {
  if (!coverage) return null;
  const bins=new Map(coverage.bins.map(bin=>[bin.index,{...bin}]));
  let cursor=coverage.cursor,total=coverage.total;const seen=new Set();
  for (const row of entries) {
    if (row.receivedAt<day.from || row.receivedAt>=day.to || BigInt(row.id)<=BigInt(coverage.cursor) || seen.has(row.id)) continue;
    seen.add(row.id);
    const index=Math.floor((row.receivedAt-day.from)/60000),bin=bins.get(index);
    if (bin) {bin.count++;bin.firstAt=Math.min(bin.firstAt,row.receivedAt);bin.lastAt=Math.max(bin.lastAt,row.receivedAt);}
    else bins.set(index,{index,count:1,firstAt:row.receivedAt,lastAt:row.receivedAt,lastId:row.id});
    if (BigInt(row.id)>BigInt(cursor)) cursor=row.id;
    total++;
  }
  const sorted=[...bins.values()].sort((a,b)=>a.index-b.index);
  return {...coverage,bins:sorted,cursor,total,firstAt:sorted[0]?.firstAt ?? null,lastAt:sorted.at(-1)?.lastAt ?? null};
}

export function mergeChartEntries(previous, incoming, from, to, limit = 6000) {
  const unique = new Map([...previous, ...incoming].map(row => [row.id, row]));
  return [...unique.values()].filter(row => row.receivedAt >= from && row.receivedAt <= to)
    .sort((a, b) => a.receivedAt - b.receivedAt || (BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : 0))
    .slice(-limit);
}

export function lineSegments(entries, staleMs) {
  const segments = [];
  for (const row of entries) {
    const current = segments.at(-1), previous = current?.at(-1);
    if (!previous || row.receivedAt - previous.receivedAt > staleMs) segments.push([row]);
    else current.push(row);
  }
  return segments;
}

export function conclusionSpans(entries, from, to, staleMs) {
  const spans = [];
  for (let i = 0; i < entries.length; i++) {
    const row = entries[i];
    const start = Math.max(from, row.receivedAt);
    const end = Math.min(to, row.receivedAt + staleMs, entries[i + 1]?.receivedAt ?? to);
    if (end <= start || !STATE_COLORS[row.conclusion]) continue;
    const previous = spans.at(-1);
    if (previous?.conclusion === row.conclusion && previous.to === start) previous.to = end;
    else spans.push({ from: start, to: end, conclusion: row.conclusion });
  }
  return spans;
}

// Dos niveles reales, sin interpretar No seguro o una desconexion como cero.
// Al cambiar directamente de estado, los dos puntos en el mismo instante
// dibujan un salto vertical. Cualquier periodo desconocido interrumpe la linea.
export function decisionStepSegments(spans) {
  const runs = [];
  for (const span of spans) {
    if (!['Hay basura', 'Sin basura'].includes(span.conclusion)) continue;
    const value = span.conclusion === 'Hay basura' ? 1 : 0;
    let run = runs.at(-1);
    if (!run || run.at(-1).at !== span.from) { run = []; runs.push(run); }
    run.push({ at:span.from,value }, { at:span.to,value });
  }
  return runs;
}

export function decisionStepPath(runs, x, y) {
  return runs.map(run => run.map((point, i) => `${i ? 'L' : 'M'}${x(point.at).toFixed(1)},${y(point.value).toFixed(1)}`).join('')).join('');
}

export function nearestEntry(entries, timestamp) {
  if (!entries.length) return null;
  let lo = 0, hi = entries.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (entries[mid].receivedAt < timestamp) lo = mid + 1; else hi = mid; }
  const right = entries[lo], left = entries[lo - 1];
  return left && timestamp - left.receivedAt <= right.receivedAt - timestamp ? left : right;
}

export function seriesPath(segments, x, y, value, step = false) {
  return segments.map(segment => segment.map((row, i) => {
    const px = x(row.receivedAt).toFixed(1), py = y(value(row)).toFixed(1);
    return i === 0 ? `M${px},${py}` : (step ? `H${px}V${py}` : `L${px},${py}`);
  }).join('')).join('');
}
