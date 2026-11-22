import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createStore } from '../lib/store.js';
import { createHistoryHandler } from '../api/history.js';
import { createSession } from '../lib/auth.js';
import { migrate } from '../lib/migrate.js';

test('PostgreSQL real en WASM: esquema, concurrencia, historial, transaccion y API', async () => {
  const db = new PGlite();
  try {
    const schema = await readFile(new URL('../database/schema.sql', import.meta.url), 'utf8');
    const pool = { connect: async () => ({ query: sql => db.exec(sql), release() {} }) };
    await migrate(pool);
    const execute = async (sql, params) => (await db.query(sql, params)).rows;
    const store = createStore(execute);
    const config = { threshold: .8, staleMs: 90000 };
    const frame = (seq, extra = {}) => ({ boot: '0123456789abcdef', seq,
      receivedAt: 1700000000000 + seq * 15000, scores: [.05,.45,.4,.1],
      preview: 'solo-miniatura-actual', analysisMs: 120, ...extra });
    const count = async () => Number((await execute('SELECT count(*) AS n FROM mediciones'))[0].n);
    assert.equal(await store.readState(), null);
    assert.deepEqual(await store.readHistory(), { entries: [], nextCursor: null });
    await Promise.all([store.saveReading(frame(1), config), store.saveReading(frame(1), config)]);
    assert.equal(await count(), 1);
    for (let i = 2; i <= 5; i++) await store.saveReading(frame(i), config);
    assert.equal((await store.readState()).conclusion, 'Hay basura');
    await store.saveReading(frame(1), config);await store.saveReading(frame(5), config);
    assert.equal(await count(), 5);
    const page1 = await store.readHistory({ limit: 2 });
    assert.equal(page1.entries[0].cameraId, 'camara-1');
    assert.equal(page1.entries[0].receivedAt, frame(5).receivedAt);
    assert.deepEqual(page1.entries[0].scores, frame(5).scores);
    assert.equal(page1.entries[0].preview, undefined);
    await store.saveReading(frame(6), config);
    const page2 = await store.readHistory({ before: page1.nextCursor, limit: 250 });
    assert.equal(page2.entries.length, 3);
    assert.ok(!page2.entries.some(row => page1.entries.some(other => other.id === row.id)));
    const before = await store.readState();
    // Un error de restriccion revierte tanto la medicion como el nuevo estado.
    await assert.rejects(store.saveReading(frame(7, { analysisMs: -1 }), config), error => error.code === '23514');
    assert.deepEqual(await store.readState(), before);assert.equal(await count(), 6);
    await store.saveReading(frame(7), config);assert.equal(await count(), 7);
    await store.saveReading(frame(1, { boot: 'ffffffffffffffff', receivedAt: 1700000999999 }), config);
    assert.equal((await store.readState()).history.length, 1);assert.equal(await count(), 8);
    await migrate(pool);assert.equal(await count(), 8); // Reiniciar el servidor no borra.
    assert.equal((await createStore(execute).readHistory()).entries.length, 8);
    const graph = await store.readChartHistory({ minutes:60,now:1700001020000 });
    assert.equal(graph.entries.length, 8); assert.equal(graph.truncated, false);
    assert.equal(graph.entries[0].preview, undefined);
    assert.ok(Math.abs(graph.entries[0].trashNow - .95) < 1e-12);
    const incremental = await store.readChartHistory({ minutes:60,now:1700001020000,after:graph.cursor });
    assert.equal(incremental.entries.length, 0); assert.equal(incremental.cursor, graph.cursor);
    const throughFive = await store.readChartHistory({ minutes:15,now:frame(5).receivedAt });
    assert.equal(throughFive.entries.length, 5); // No anticipar lecturas con fecha posterior.
    const past = await store.readChartHistory({ from:frame(1).receivedAt+1, to:frame(2).receivedAt+1, now:1700001020000 });
    assert.equal(past.entries.length, 1); assert.equal(past.entries[0].receivedAt, frame(2).receivedAt);
    assert.equal(past.context.receivedAt, frame(1).receivedAt); assert.equal(past.earliestAt, frame(1).receivedAt);
    const daysAgo = await store.readChartHistory({ from:frame(1).receivedAt, to:frame(5).receivedAt, now:frame(5).receivedAt+5*86400000 });
    assert.equal(daysAgo.entries.length, 5); // Navegar a mas de 24 h, sin anticipar mediciones posteriores.
    const lastWindow = await store.readChartHistory({ minutes:15,now:1700001020000 });
    assert.equal(lastWindow.entries.length, 1); // La ventana temporal excluye capturas antiguas.
    await assert.rejects(store.readHistory({ before: '9223372036854775808' }), error => error.status === 400);
    await assert.rejects(store.readHistory({ before: '1-0' }), error => error.status === 400);
    process.env.SESSION_SECRET = 'postgres-session-test-secret-'.repeat(2);
    const handler = createHistoryHandler(store.readHistory);
    const request = async (url, cookie = '') => {
      let body;const res = { setHeader() {}, end(value) { body = JSON.parse(value); } };
      await handler({ method: 'GET', url, headers: { cookie } }, res);
      return { status: res.statusCode, body };
    };
    assert.equal((await request('/api/history')).status, 200);
    const cookie = 'xiao_session=' + createSession();
    const result = await request('/api/history?limit=2', cookie);
    assert.equal(result.status, 200);assert.equal(result.body.entries.length, 2);
    assert.equal((await request('/api/history?before=invalido', cookie)).status, 400);
    assert.equal((await request('/api/history?limit=251', cookie)).status, 400);
    const oldCount=await count();
    for(let seq=2;seq<=5;seq++) await store.saveReading(frame(seq,{boot:'ffffffffffffffff',receivedAt:1700001000000+seq*5000}),{...config,decisionProfile:'demo'});
    assert.equal(await count(),oldCount+4); // El cambio de perfil no borra ninguna medicion anterior.
    const demoState=await store.readState();assert.equal(demoState.history.length,3);assert.equal(demoState.streak,2);
    assert.equal(demoState.conclusion,'Hay basura');assert.equal(demoState.decisionProfile,'demo');
  } finally { await db.close(); }
});
