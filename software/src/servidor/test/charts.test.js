import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeChartEntries, lineSegments, conclusionSpans, nearestEntry, decisionStepSegments, decisionStepPath, historyDomain, windowAtOffset, localDayKey, localDayBounds, clampDayWindow } from '../public/chart-data.js';
import { createChartHistoryHandler } from '../api/chart-history.js';
import { createSession } from '../lib/auth.js';
import { createStore } from '../lib/store.js';

test('Graficos conservan valores originales, orden temporal, BIGINT y una ventana acotada sin duplicados', () => {
  const row = (id, receivedAt, trashAverage = .238) => ({ id, receivedAt, trashAverage, conclusion:'No seguro' });
  const old = [row('9007199254740993', 10), row('9007199254740994', 20)];
  const merged = mergeChartEntries(old, [row('9007199254740994', 20), row('9007199254740995', 30), row('9007199254740996', 90)], 15, 40);
  assert.deepEqual(merged.map(item => item.id), ['9007199254740994', '9007199254740995']);
  assert.equal(merged[0].trashAverage, .238); assert.equal(merged[0].conclusion, 'No seguro');
  const many = Array.from({ length:6005 }, (_, i) => row(String(i + 1), i));
  assert.equal(mergeChartEntries([], many, 0, 7000).length, 6000);
  assert.equal(mergeChartEntries([], many, 0, 7000)[0].id, '6');
  assert.equal(nearestEntry(merged, 29).id, '9007199254740995');
  assert.equal(nearestEntry([], 29), null);
});

test('Cortes de red rompen las lineas y dejan huecos en la franja; No seguro sigue siendo un estado distinto', () => {
  const rows = [{ id:'1',receivedAt:100,conclusion:'Hay basura' }, { id:'2',receivedAt:200,conclusion:'Hay basura' },
    { id:'3',receivedAt:300,conclusion:'No seguro' }, { id:'4',receivedAt:1000,conclusion:'Sin basura' }];
  assert.deepEqual(lineSegments(rows, 150).map(group => group.length), [3, 1]);
  assert.deepEqual(conclusionSpans(rows, 0, 1300, 150), [
    { from:100,to:300,conclusion:'Hay basura' }, { from:300,to:450,conclusion:'No seguro' },
    { from:1000,to:1150,conclusion:'Sin basura' }
  ]);
  assert.deepEqual(conclusionSpans([], 0, 1000, 150), []);
});

test('API publica de graficos valida intervalos y cursores y admite actualizaciones incrementales', async () => {
  process.env.SESSION_SECRET = 'charts-session-test-'.repeat(3);
  const now = 100 * 86400000;
  let calls = [];
  const handler = createChartHistoryHandler(async query => { calls.push(query); return { entries:[],cursor:query.after ?? '0',from:1,to:1000000,truncated:false,limit:6000 }; }, () => now);
  const request = async (url, cookie = '', method = 'GET') => {
    let data; const headers = {}; const res = { setHeader(name, value) { headers[name] = value; }, end(value) { data = JSON.parse(value); } };
    await handler({ method, url, headers:{cookie} }, res); return { status:res.statusCode,data,headers };
  };
  assert.equal((await request('/api/chart-history')).status, 200); assert.equal(calls.length, 1); calls = [];
  const cookie = 'xiao_session=' + createSession();
  for (const suffix of ['minutes=0', 'minutes=NaN', 'minutes=Infinity', 'minutes=-1', 'after=-1', 'after=1e2', 'after=9223372036854775808',
    'from=1', 'to=10', 'from=20&to=10', 'from=-1&to=10', 'from=1&to=' + (now+1), 'from=1e2&to=1000', 'from=&to=10'])
    assert.equal((await request('/api/chart-history?' + suffix, cookie)).status, 400);
  assert.equal((await request('/api/chart-history', cookie, 'POST')).status, 405); assert.equal(calls.length, 0);
  const response = await request('/api/chart-history?minutes=1440&after=9007199254740993', cookie);
  assert.equal(response.status, 200); assert.equal(response.data.cursor, '9007199254740993');
  assert.deepEqual(calls[0], { minutes:1440,after:'9007199254740993',now,staleMs:90000 });
  assert.match(response.headers['Cache-Control'], /no-store/); assert.equal(response.data.staleMs, 90000);
  // Cualquier intervalo valido, no solo 15 min / 1 h / 24 h.
  assert.equal((await request('/api/chart-history?minutes=7.5')).status, 200);
  assert.equal((await request('/api/chart-history?from=1&to=999999')).status, 200);
  assert.deepEqual(calls.at(-1), {from:1,to:999999,after:null,now,staleMs:90000});
});

test('El historial para graficos limita la respuesta sin redondear el cursor de PostgreSQL', async () => {
  const rows = Array.from({length:6001}, (_, i) => ({ id:String(9007199254747999n - BigInt(i)),receivedAt:1000 + i }));
  const store = createStore(async sql => sql.includes('LIMIT 6001') ? rows : sql.includes('min(recibido_en)') ? [{earliestAt:1000}] : []);
  const result = await store.readChartHistory({ now:1000000 });
  assert.equal(result.entries.length, 6000); assert.equal(result.truncated, true);
  assert.equal(result.cursor, '9007199254747999');
  assert.equal(result.earliestAt, 1000); assert.equal(result.context, null);
  await assert.rejects(store.readChartHistory({ from:20,to:10 }), error => error.status === 400);
});

test('Desplazamiento libre: alcanza dias antiguos, conserva el ancho y sincroniza extremos sin presets', () => {
  const now = 100 * 86400000, first = now - 45 * 86400000, duration = 7.5 * 60000;
  const extent = historyDomain(first, now, duration);
  assert.equal(windowAtOffset(extent,duration,0).from, first);
  assert.equal(windowAtOffset(extent,duration,1).to, now);
  const middle = windowAtOffset(extent,duration,.37);
  assert.equal(middle.to-middle.from,duration); assert.ok(now-middle.to>24*3600000);
  assert.deepEqual(windowAtOffset(extent,duration,-1),windowAtOffset(extent,duration,0));
  assert.deepEqual(windowAtOffset(extent,duration,2),windowAtOffset(extent,duration,1));
  assert.deepEqual(windowAtOffset(historyDomain(null,now,duration),duration,0),{from:now-duration,to:now});
});

test('Navegacion diaria: fecha valida, extremos 00-24, intervalos y zoom siempre dentro del dia elegido', () => {
  const day = localDayBounds('2026-11-18');
  assert.equal(localDayKey(day.from), '2026-11-18');
  assert.equal(localDayKey(day.to), '2026-11-19');
  assert.equal(localDayBounds('2026-02-30'), null); assert.equal(localDayBounds('18/11/2026'), null);
  const first = windowAtOffset(day, 15 * 60000, 0), last = windowAtOffset(day, 15 * 60000, 1);
  assert.equal(first.from, day.from); assert.equal(last.to, day.to);
  assert.deepEqual(clampDayWindow(day, 3600000, day.from - 1), {from:day.from,to:day.from + 3600000});
  assert.deepEqual(clampDayWindow(day, 3600000, day.to + 1), {from:day.to - 3600000,to:day.to});
  assert.deepEqual(clampDayWindow(day, 2 * 86400000, day.to), day);
});

test('El calendario local respeta cambios de hora de Chile sin mezclar fechas vecinas', () => {
  const previous = process.env.TZ; process.env.TZ = 'America/Santiago';
  try {
    const short = localDayBounds('2026-09-06'), long = localDayBounds('2026-04-04');
    assert.equal(short.to - short.from, 23 * 3600000);
    assert.equal(long.to - long.from, 25 * 3600000);
    assert.equal(localDayKey(short.to - 1), '2026-09-06'); assert.equal(localDayKey(short.to), '2026-09-07');
    assert.equal(localDayKey(long.to - 1), '2026-04-04'); assert.equal(localDayKey(long.to), '2026-04-05');
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});

test('Escalones: saltos verticales en la hora confirmada, sin convertir incertidumbre o desconexion en Sin basura', () => {
  const spans = [{from:0,to:10,conclusion:'Sin basura'}, {from:10,to:20,conclusion:'Hay basura'},
    {from:20,to:30,conclusion:'No seguro'}, {from:30,to:40,conclusion:'Hay basura'},
    {from:50,to:60,conclusion:'Sin basura'}];
  const runs = decisionStepSegments(spans);
  assert.deepEqual(runs, [
    [{at:0,value:0},{at:10,value:0},{at:10,value:1},{at:20,value:1}],
    [{at:30,value:1},{at:40,value:1}], [{at:50,value:0},{at:60,value:0}]
  ]);
  assert.equal(decisionStepPath(runs, x=>x, y=>y), 'M0.0,0.0L10.0,0.0L10.0,1.0L20.0,1.0M30.0,1.0L40.0,1.0M50.0,0.0L60.0,0.0');
  assert.deepEqual(decisionStepSegments([{from:0,to:100,conclusion:'No seguro'}]), []);
  assert.deepEqual(decisionStepSegments([]), []);
});
