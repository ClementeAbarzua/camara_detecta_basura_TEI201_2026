import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createAdminAuth} from '../lib/admin-auth.js';
import {createAdminHandlers} from '../api/admin.js';
import {createOperationHandlers} from '../api/operations.js';
import {createDeviceStatus} from '../lib/device-status.js';
import {createServer} from '../lib/http-server.js';
import {createStore} from '../lib/store.js';
import {createIngestHandler} from '../api/ingest.js';
import {createStateHandler} from '../api/state.js';
const password='operations-test-password',secret='operations-test-secret-'.repeat(3);
const config={threshold:.8,staleMs:90000,decisionProfile:'demo'};

test('Pausa privada persistente: CSRF, placa, descarte sin inferencia y reanudación con ventana nueva',async()=>{
  process.env.CAMERA_TOKEN='operations-camera-token-'.repeat(3);delete process.env.INGEST_PAUSED;
  const db=new PGlite();let app,analyses=0,notices=0,pauseDuringAnalysis=false;
  try{
    const schema=await readFile(new URL('../database/schema.sql',import.meta.url),'utf8');await db.exec(schema);
    const store=createStore(async(sql,args)=>(await db.query(sql,args)).rows);
    const auth=createAdminAuth({readCredentials:()=>({password,secret}),production:()=>false}),device=createDeviceStatus();
    const ops=createOperationHandlers({auth,read:store.readCameraSettings,save:store.setCapturePaused,publish:()=>notices++,device});
    const routes={'/api/admin/operations':ops.operations,'/api/device/control':ops.control,'/api/state':createStateHandler(store.readCameraView),
      '/api/ingest':createIngestHandler(async()=>{analyses++;if(pauseDuringAnalysis){const c=await store.readCameraSettings();await store.setCapturePaused({paused:true,expectedVersion:c.version});}return {scores:[.05,.45,.4,.1],analysisMs:2};},store.saveReading,store.readCameraSettings,()=>{})};
    for(const [name,handler]of Object.entries(createAdminHandlers({auth,read:store.readCameraSettings,save:store.setCameraSettings})))routes['/api/admin/'+name]=handler;
    app=createServer({routes,health:async()=>{}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
    const base='http://127.0.0.1:'+app.server.address().port;
    const login=await fetch(base+'/api/admin/login',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({password})});
    const session=await login.json(),owner={cookie:login.headers.get('set-cookie').split(';')[0],origin:base,'x-csrf-token':session.csrfToken,'content-type':'application/json'};
    const cameraHeaders={authorization:'Bearer '+process.env.CAMERA_TOKEN};
    for(const headers of [{},cameraHeaders,{cookie:'xiao_session=legacy'}])assert.equal((await fetch(base+'/api/admin/operations',{headers})).status,401);
    const put=(input,headers=owner)=>fetch(base+'/api/admin/operations',{method:'PUT',headers,body:JSON.stringify(input)});
    const change={paused:true,expectedVersion:'0'};
    assert.equal((await put(change,{...owner,origin:'https://evil.test'})).status,403);
    assert.equal((await put(change,{...owner,'x-csrf-token':''})).status,403);
    for(const input of [{...change,paused:'true'},{...change,expectedVersion:0},{...change,extra:1},{}])assert.equal((await put(input)).status,400);
    const send=seq=>fetch(base+'/api/ingest',{method:'POST',headers:{...cameraHeaders,'content-type':'image/jpeg','x-camera-boot':'0123456789abcdef','x-frame-seq':String(seq)},body:Buffer.from([255,216,255,217])});
    for(let seq=1;seq<=4;seq++)assert.equal((await send(seq)).status,200);
    assert.equal((await store.readState()).conclusion,'Hay basura');
    const before=(await store.readHistory()).entries;
    const paused=await put(change);assert.equal(paused.status,200);const result=await paused.json();
    assert.equal(result.camera.version,'1');assert.equal(result.camera.threshold,.8);assert.equal(result.camera.paused,true);assert.equal(notices,1);
    assert.equal((await put(change)).status,409);
    assert.equal((await put({paused:true,expectedVersion:'1'})).status,200);assert.equal((await store.readCameraSettings()).version,'1');
    await db.exec(schema);assert.equal((await store.readCameraSettings()).paused,true);
    const skipped=await send(5);assert.equal(skipped.status,200);assert.equal(skipped.headers.get('x-capture-paused'),'1');assert.equal((await skipped.json()).paused,true);assert.equal(analyses,4);
    assert.deepEqual((await store.readHistory()).entries,before);
    const state=await(await fetch(base+'/api/state')).json();assert.equal(state.online,false);assert.equal(state.state.conclusion,'Capturas pausadas');
    assert.equal((await fetch(base+'/api/device/control')).status,401);
    assert.equal((await fetch(base+'/api/device/control',{headers:cameraHeaders})).status,200);
    const control=await fetch(base+'/api/device/control',{headers:{...cameraHeaders,'x-control-protocol':'1','x-device-mode':'paused','x-control-version':'1'}});
    assert.equal(await control.text(),'PAUSE\n1\n');assert.match(control.headers.get('cache-control'),/no-store/);
    const snapshot=await(await fetch(base+'/api/admin/operations',{headers:owner})).json();assert.equal(snapshot.device.paused,true);assert.equal(snapshot.device.online,true);
    assert.equal((await put({paused:false,expectedVersion:'1'})).status,200);
    assert.equal(await(await fetch(base+'/api/device/control',{headers:cameraHeaders})).text(),'RUN\n2\n');
    assert.equal((await send(6)).status,200);assert.equal((await store.readState()).history.length,1);assert.equal((await store.readState()).conclusion,'No seguro');
    assert.equal((await store.readHistory()).entries.length,before.length+1);
    pauseDuringAnalysis=true;assert.equal((await send(7)).status,409);assert.equal((await store.readHistory()).entries.length,before.length+1);
  }finally{if(app)await new Promise(r=>{app.server.close(r);app.server.closeAllConnections();});await db.close();}
});

test('Pausa que llega después de leer los ajustes bloquea el commit atómico en SQL',async()=>{
  const db=new PGlite();try{
    await db.exec(await readFile(new URL('../database/schema.sql',import.meta.url),'utf8'));
    let race=true;const plain=createStore(async(sql,args)=>(await db.query(sql,args)).rows);
    const store=createStore(async(sql,args)=>{if(race&&sql.includes('WITH configuracion_actual')){race=false;await plain.setCapturePaused({paused:true,expectedVersion:'0'});}return(await db.query(sql,args)).rows;});
    await assert.rejects(store.saveReading({boot:'0123456789abcdef',seq:1,receivedAt:Date.now(),scores:[.1,.4,.3,.2],analysisMs:1},config),e=>e.status===409);
    assert.equal((await plain.readHistory()).entries.length,0);assert.equal(await plain.readState(),null);
  }finally{await db.close();}
});

test('Confirmación de la placa: no confunde firmware antiguo, mensajes inválidos ni una conexión vencida',()=>{
  let now=1000;const status=createDeviceStatus(()=>now);
  status.note({headers:{}});assert.equal(status.read(),null);
  status.note({headers:{'x-control-protocol':'1','x-device-mode':'paused','x-control-version':'x'}});assert.equal(status.read(),null);
  status.note({headers:{'x-control-protocol':'1','x-device-mode':'paused','x-control-version':'7'}});assert.deepEqual(status.read(),{seenAt:1000,paused:true,version:'7',online:true});
  now+=20000;assert.equal(status.read().online,false);
});
