import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { rawMeasurements } from '../lib/raw-export.js';
import { createExportHandler } from '../api/export.js';
import { createIngestHandler } from '../api/ingest.js';
import { createSession } from '../lib/auth.js';
import { createServer } from '../lib/http-server.js';
import { connectionOptions } from '../lib/database.js';
async function collect(iterable) { const rows = []; for await (const row of iterable) rows.push(row); return rows; }

test('TLS de Aiven conserva la CA y rechaza conexiones sin verificacion', () => {
  const uri = 'postgres://user:password@demo.aivencloud.com:1234/defaultdb?sslmode=require';
  const ca = '-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----';
  const result = connectionOptions(uri, { caCertificate: ca.replace(/\n/g, '\\n') });
  assert.equal(result.ssl.ca, ca); assert.equal(result.ssl.rejectUnauthorized, true);
  assert.equal(result.ssl.servername, 'demo.aivencloud.com');
  assert.equal(new URL(result.connectionString).searchParams.has('sslmode'), false);
  assert.throws(() => connectionOptions(uri), /DATABASE_CA_CERT/);
  assert.throws(() => connectionOptions(uri.replace('require', 'disable'), { caCertificate: ca }), /verificacion TLS/);
  assert.throws(() => connectionOptions(uri.replace('require', 'no-verify')), /DATABASE_CA_CERT/);
  assert.throws(() => connectionOptions(uri, { caCertificate: 'invalid' }), /PEM/);
  assert.throws(() => connectionOptions(uri + '&host=other', { caCertificate: ca }), /host y puerto/);
  assert.equal(connectionOptions('postgres://u:p@postgres.railway.internal:5432/railway').ssl, undefined);
});

test('JSON crudo pagina numericamente, conserva BIGINT, microsegundos y revierte cancelaciones', async () => {
  const db = new PGlite(); let releases = 0; const statements = [];
  const pool = { connect: async () => ({ query: async (sql, values) => { statements.push(sql); return db.query(sql, values); }, release() { releases++; } }) };
  try {
    await db.exec(await readFile(new URL('../database/schema.sql', import.meta.url), 'utf8'));
    assert.deepEqual(await collect(rawMeasurements(pool)), []);
    await db.exec(`INSERT INTO mediciones
      (id,camara_id,recibido_en,arranque,secuencia,conclusion,p_sin_basura,p_botellas,p_papeles_cartones,p_bolsas,basura_actual,basura_promedio,umbral,capturas_promedio,confirmaciones,analisis_ms)
      OVERRIDING SYSTEM VALUE SELECT n,'camara-1','2026-11-20 12:34:56.123456+00','0123456789abcdef',n,'Hay basura',0.05,0.45,0.4,0.1,0.95,0.95,0.8,5,3,123
      FROM unnest(ARRAY[2,9,10,101,9007199254740993]::bigint[]) AS n;`);
    const rows = await collect(rawMeasurements(pool, { batchSize: 2 }));
    assert.deepEqual(rows.map(row => row.id), ['2','9','10','101','9007199254740993']);
    assert.equal(rows.at(-1).secuencia, '9007199254740993');
    assert.equal(rows[0].recibido_en, '2026-11-20T12:34:56.123456Z');
    assert.equal(rows[0].p_botellas, .45); assert.equal(Object.keys(rows[0]).length, 16);
    assert.ok(!('preview' in rows[0])); assert.equal(releases, 2);
    const controller = new AbortController();
    const iterator = rawMeasurements(pool, { signal: controller.signal, batchSize: 2 });
    await iterator.next(); controller.abort(); await assert.rejects(iterator.next());
    assert.equal(statements.at(-1), 'ROLLBACK'); assert.equal(releases, 3);
    const fault = { connect: async () => ({ query: async (sql, values) => {
      if (values?.[0] !== '0' && sql.startsWith('SELECT')) throw new Error('test failure');
      return db.query(sql, values);
    }, release() { releases++; } }) };
    await assert.rejects(collect(rawMeasurements(fault, { batchSize: 2 })), /test failure/);
    assert.equal(releases, 4);
    assert.equal((await db.query('SELECT count(*) AS n FROM mediciones')).rows[0].n, 5);
  } finally { await db.close(); }
});

test('La exportacion HTTP esta retirada incluso con una sesion de administrador; la camara sigue autenticada', async () => {
  process.env.SESSION_SECRET = 'test-session-secret-'.repeat(3);
  process.env.CAMERA_TOKEN = 'test-camera-token-'.repeat(3);
  let reads = 0;
  const app = createServer({ health: async () => {}, routes: {
    '/api/export.json': createExportHandler(() => { reads++; throw new Error('No debe leer la base'); }),
    '/api/ingest': createIngestHandler(() => assert.fail('No debe analizar durante la pausa'), () => assert.fail('No debe escribir durante la pausa'))
  } });
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const base = 'http://127.0.0.1:' + app.server.address().port;
    const cookie = 'xiao_session=' + createSession();
    for (const headers of [{}, {cookie}]) {
      const response = await fetch(base + '/api/export.json', {headers});
      assert.equal(response.status, 404); assert.equal(response.headers.get('content-disposition'), null);
      assert.deepEqual(await response.json(), { error:'No encontrado.' });
    }
    assert.equal(reads, 0);
    process.env.INGEST_PAUSED = 'true';
    assert.equal((await fetch(base + '/api/ingest', { method:'POST',headers:{authorization:'Bearer ' + process.env.CAMERA_TOKEN} })).status, 503);
    assert.equal((await fetch(base + '/api/ingest', { method:'POST' })).status, 401);
  } finally {
    delete process.env.INGEST_PAUSED;
    await new Promise(resolve => { app.server.close(resolve); app.server.closeAllConnections(); });
  }
});
