import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import sharp from 'sharp';
import { prepareImage, classify, predictRGB } from '../lib/model.js';
import { createStore } from '../lib/store.js';
import { createSession } from '../lib/auth.js';
import { createServer } from '../lib/http-server.js';
import { createStateHandler } from '../api/state.js';
import { createIngestHandler } from '../api/ingest.js';
import { createCameraSettingsHandler } from '../api/camera-settings.js';
import { migrate } from '../lib/migrate.js';

const schema = () => readFile(new URL('../database/schema.sql', import.meta.url), 'utf8');
const config = { threshold: .8, staleMs: 90000 };
const frame = seq => ({ boot: '0123456789abcdef', seq, receivedAt: Date.now() + seq,
  scores: [.05, .45, .4, .1], preview: 'miniatura', analysisMs: 12 });
const executeFor = db => async (sql, params) => (await db.query(sql, params)).rows;

test('Giro real de 180 grados: miniatura y pixeles de inferencia tienen la misma orientacion', async () => {
  const size = 224, pixels = Buffer.alloc(size * size * 3);
  const colors = [[230,20,20],[20,220,20],[20,20,230],[230,220,20]];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const color = colors[(y >= size / 2 ? 2 : 0) + (x >= size / 2 ? 1 : 0)];
    for (let c = 0; c < 3; c++) pixels[(y * size + x) * 3 + c] = color[c];
  }
  const jpeg = await sharp(pixels, { raw: { width: size, height: size, channels: 3 } }).jpeg({ quality: 95 }).toBuffer();
  const normal = await prepareImage(jpeg), rotated = await prepareImage(jpeg, 180);
  const expected = Buffer.alloc(normal.rgb.length);
  for (let i = 0; i < size * size; i++) normal.rgb.copy(expected, i * 3, (size * size - i - 1) * 3, (size * size - i) * 3);
  assert.deepEqual(rotated.rgb, expected);
  const preview = await sharp(rotated.preview).raw().toBuffer();
  const point = (buffer, x, y) => [...buffer.subarray((y * size + x) * 3, (y * size + x) * 3 + 3)];
  assert.ok(point(preview, 20, 20).every((v, i) => Math.abs(v - colors[3][i]) < 15));
  assert.ok(point(preview, 200, 200).every((v, i) => Math.abs(v - colors[0][i]) < 15));
  const result = await classify(jpeg, { rotation: 180 });
  assert.deepEqual(result.scores, await predictRGB(rotated.rgb));
  assert.equal(result.preview, rotated.preview.toString('base64'));
  await assert.rejects(prepareImage(jpeg, 90), /Orientacion invalida/);
});

test('Orientacion inicial de 180 grados: conserva historial y no se reinicia al desplegar de nuevo', async () => {
  const db = new PGlite(), execute = executeFor(db), store = createStore(execute);
  try {
    await db.exec(await schema());
    assert.deepEqual(await store.readCameraSettings(), { rotation:180,version:'0',threshold:null,paused:false,roi:{centerX:.5,centerY:.5,size:1} });
    for (let i=1;i<=5;i++) await store.saveReading(frame(i),config);
    const original=(await store.readHistory()).entries;
    assert.equal((await store.readState()).rotation,180);
    await assert.rejects(db.query('UPDATE camaras SET rotacion=90'), error=>error.code==='23514');
    await assert.rejects(store.saveReading({...frame(6),rotation:0},config),error=>error.status===409);
    const pool={connect:async()=>({query:sql=>db.exec(sql),release(){}})};
    await migrate(pool);await migrate(pool);
    assert.deepEqual(await store.readCameraSettings(),{rotation:180,version:'0',threshold:null,paused:false,roi:{centerX:.5,centerY:.5,size:1}});
    assert.deepEqual((await store.readHistory()).entries,original);
    const previous=await store.readState();
    await execute('UPDATE estado_camara SET estado=$1::jsonb',[JSON.stringify({...previous,rotation:0})]);
    const next=await store.saveReading(frame(6),config);
    assert.equal(next.history.length,1);assert.equal(next.streak,0);assert.equal(next.rotation,180);
    assert.equal((await store.readHistory()).entries.length,6);
  } finally {await db.close();}
});

test('La migracion conserva la orientacion y version elegidas sin forzar el montaje',async()=>{
  const db=new PGlite();
  try {
    await db.exec("CREATE TABLE camaras(id text PRIMARY KEY,nombre text NOT NULL,ubicacion text,creada_en timestamptz NOT NULL DEFAULT now(),rotacion smallint NOT NULL DEFAULT 0,orientacion_version bigint NOT NULL DEFAULT 7); INSERT INTO camaras(id,nombre) VALUES('camara-1','Nombre existente');");
    const pool={connect:async()=>({query:sql=>db.exec(sql),release(){}})};
    await migrate(pool);await migrate(pool);
    assert.equal((await db.query('SELECT nombre FROM camaras')).rows[0].nombre,'Nombre existente');
    assert.deepEqual(await createStore(executeFor(db)).readCameraSettings(),{rotation:0,version:'7',threshold:null,paused:false,roi:{centerX:.5,centerY:.5,size:1}});
    await assert.rejects(db.query("INSERT INTO camaras(id,nombre,rotacion) VALUES('otra','Otra',90)"),error=>error.code==='23514');
  }finally{await db.close();}
});

test('HTTP: el ajuste de giro esta retirado incluso con sesiones anteriores; cada inferencia usa 180 grados',async()=>{
  process.env.SESSION_SECRET='rotation-session-test-'.repeat(3);
  process.env.CAMERA_TOKEN='rotation-camera-test-'.repeat(3);
  const db=new PGlite(),store=createStore(executeFor(db));let app;
  try {
    await db.exec(await schema());
    const seen=[];let broken=false;
    app=createServer({health:async()=>{},routes:{
      '/api/state':createStateHandler(store.readCameraView),
      '/api/camera-settings':createCameraSettingsHandler(()=>assert.fail('No debe modificar la camara')),
      '/api/ingest':createIngestHandler(async(_jpeg,options)=>{seen.push(options.rotation);return{scores:[.05,.45,.4,.1],preview:'preview',analysisMs:12};},store.saveReading,async()=>broken?{rotation:90,version:'0'}:store.readCameraSettings())
    }});
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
    const base='http://127.0.0.1:'+app.server.address().port;
    const cookie='xiao_session='+createSession();
    for(const headers of [{},{cookie}])for(const method of ['GET','POST']){
      const response=await fetch(base+'/api/camera-settings',{method,headers:{...headers,'content-type':'application/json'},...(method==='POST'?{body:JSON.stringify({rotation:0,expectedVersion:'0'})}:{})});
      assert.equal(response.status,410);
    }
    const view=await(await fetch(base+'/api/state',{headers:{cookie}})).json();
    assert.equal(view.canManageCamera,false);assert.equal(view.camera.rotation,180);
    const send=seq=>fetch(base+'/api/ingest',{method:'POST',headers:{authorization:'Bearer '+process.env.CAMERA_TOKEN,'content-type':'image/jpeg','x-camera-boot':'0123456789abcdef','x-frame-seq':String(seq)},body:Buffer.from([255,216,255,217])});
    assert.equal((await send(1)).status,200);assert.equal((await send(2)).status,200);
    assert.deepEqual(seen,[180,180]);
    const state=await(await fetch(base+'/api/state')).json();assert.equal(state.state.rotation,180);
    assert.equal((await fetch(base+'/api/ingest',{method:'POST'})).status,401);
    broken=true;assert.equal((await send(3)).status,503);assert.deepEqual(seen,[180,180]);
    assert.equal((await store.readHistory()).entries.length,2);
  }finally{if(app)await new Promise(resolve=>{app.server.close(resolve);app.server.closeAllConnections();});await db.close();}
});
