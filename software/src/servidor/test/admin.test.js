import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createAdminAuth } from '../lib/admin-auth.js';
import { createAdminHandlers } from '../api/admin.js';
import { createServer } from '../lib/http-server.js';
import { createStore } from '../lib/store.js';
import { createStateHandler } from '../api/state.js';
import { createIngestHandler } from '../api/ingest.js';
import { createSession } from '../lib/auth.js';

const password='test-only-admin-password',secret='test-only-session-secret-'.repeat(3);
const config={threshold:.8,staleMs:90000,decisionProfile:'demo'};
const frame=(seq,camera)=>({boot:'0123456789abcdef',seq,receivedAt:Date.now()+seq,
  scores:[.15,.35,.3,.2],analysisMs:2,rotation:camera.rotation,orientationVersion:camera.version});

test('Sesiones nuevas: cookie segura, caducidad, revocacion al salir y cambio de credenciales',()=>{
  let clock=1000,credential={password,secret};
  const auth=createAdminAuth({now:()=>clock,readCredentials:()=>credential,production:()=>true});
  let setCookie;
  const res={setHeader(name,value){if(name==='Set-Cookie')setCookie=value;}};
  const req={headers:{host:'monitor.test',origin:'https://monitor.test'},socket:{remoteAddress:'127.0.0.1'}};
  auth.requireOrigin(req);
  for(const origin of [undefined,'http://monitor.test','https://evil.test','https://monitor.test.evil'])
    assert.throws(()=>auth.requireOrigin({...req,headers:{...req.headers,origin}}),error=>error.status===403);
  const session=auth.login(req,res,password);
  assert.match(setCookie,/^__Host-xiao_admin=[a-f0-9]{64}; Path=\/; HttpOnly; SameSite=Strict; Max-Age=28800; Secure$/);
  const owner={...req,headers:{...req.headers,cookie:setCookie.split(';')[0],'x-csrf-token':session.csrf}};
  assert.ok(auth.lookup(owner));
  assert.throws(()=>auth.requireMutation({...owner,headers:{...owner.headers,'x-csrf-token':'x'.repeat(64)}}),error=>error.status===403);
  auth.logout(owner,res);assert.equal(auth.lookup(owner),null);assert.match(setCookie,/Max-Age=0/);
  auth.login(req,res,password);const expiring={...req,headers:{...req.headers,cookie:setCookie.split(';')[0]}};
  clock+=8*3600000;assert.equal(auth.lookup(expiring),null);
  auth.login(req,res,password);const oldPassword={...req,headers:{...req.headers,cookie:setCookie.split(';')[0]}};
  credential={...credential,password:password+'new'};assert.equal(auth.lookup(oldPassword),null);
  credential={password:'',secret:''};assert.equal(auth.configured(),false);
  assert.throws(()=>auth.login(req,res,password),error=>error.status===503);
});

test('Contraseña: cinco fallos limitan los intentos; el bloqueo vence y no confia en X-Forwarded-For',()=>{
  let clock=1000;const auth=createAdminAuth({now:()=>clock,readCredentials:()=>({password,secret}),production:()=>false});
  const req={headers:{},socket:{remoteAddress:'same-connection'}},headers={};const res={setHeader(k,v){headers[k]=v;}};
  for(let i=0;i<5;i++)assert.throws(()=>auth.login({...req,headers:{'x-forwarded-for':String(i)}},res,'incorrecta'),error=>error.status===401);
  assert.throws(()=>auth.login(req,res,password),error=>error.status===429);assert.equal(headers['Retry-After'],'900');
  clock+=15*60000;assert.ok(auth.login(req,res,password));
});

test('HTTP y PostgreSQL: solo el administrador cambia ajustes; persisten, reinician la ventana y conservan historial',async()=>{
  process.env.CAMERA_TOKEN='test-only-camera-token-'.repeat(3);process.env.SESSION_SECRET=secret;
  const db=new PGlite();let app;let notices=0;
  try{
    const schema=await readFile(new URL('../database/schema.sql',import.meta.url),'utf8');await db.exec(schema);
    const store=createStore(async(sql,args)=>(await db.query(sql,args)).rows);
    let camera=await store.readCameraSettings();
    for(let seq=1;seq<=4;seq++)await store.saveReading(frame(seq,camera),config);
    assert.equal((await store.readState()).conclusion,'Hay basura');
    const original=(await store.readHistory()).entries;
    const auth=createAdminAuth({readCredentials:()=>({password,secret}),production:()=>false});
    const admin=createAdminHandlers({auth,read:store.readCameraSettings,save:store.setCameraSettings,publish:()=>notices++});
    const routes={'/api/state':createStateHandler(store.readCameraView),
      '/api/ingest':createIngestHandler(async(_bytes,options)=>({scores:[.15,.35,.3,.2],preview:'test',analysisMs:1}),store.saveReading,store.readCameraSettings)};
    for(const[name,handler]of Object.entries(admin))routes['/api/admin/'+name]=handler;
    app=createServer({routes,health:async()=>{}});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
    const base='http://127.0.0.1:'+app.server.address().port;
    const send=(path,options={})=>fetch(base+'/api/admin/'+path,options);
    const session=await(await send('session')).json();assert.equal(session.authenticated,false);assert.equal(session.csrfToken,undefined);
    assert.equal((await send('settings')).status,401);
    assert.equal((await send('settings',{headers:{cookie:'xiao_session='+createSession()}})).status,401);
    assert.equal((await send('settings',{method:'PUT',headers:{authorization:'Bearer '+process.env.CAMERA_TOKEN},body:'{}'})).status,401);
    assert.equal((await send('login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password})})).status,403);
    const login=await send('login',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({password})});assert.equal(login.status,200);
    const owner=await login.json(),cookie=login.headers.get('set-cookie').split(';')[0];
    const headers={cookie,origin:base,'x-csrf-token':owner.csrfToken,'content-type':'application/json'};
    const settings=await(await send('settings',{headers:{cookie}})).json();assert.equal(settings.camera.threshold,.8);
    const change={rotation:0,threshold:.9,expectedVersion:'0'},put=(value=change,custom=headers)=>send('settings',{method:'PUT',headers:custom,body:JSON.stringify(value)});
    assert.equal((await put(change,{...headers,origin:'https://evil.test'})).status,403);
    assert.equal((await put(change,{...headers,'x-csrf-token':''})).status,403);
    for(const threshold of [.59,.96,'0.9',null])assert.equal((await put({...change,threshold})).status,400);
    assert.equal((await put({...change,rotation:90})).status,400);
    assert.equal((await put({...change,export:true})).status,400);
    assert.equal((await put({...change,expectedVersion:'9223372036854775807'})).status,400);
    const saved=await put();assert.equal(saved.status,200);camera=(await saved.json()).camera;
    assert.deepEqual(camera,{rotation:0,threshold:.9,version:'1',paused:false,roi:{centerX:.5,centerY:.5,size:1}});assert.equal(notices,1);
    assert.equal((await put()).status,409); // Una pestaña antigua no sobrescribe el cambio.
    const pending=await(await fetch(base+'/api/state')).json();
    assert.equal(pending.policyPending,true);assert.equal(pending.orientationPending,true);assert.equal(pending.state.conclusion,'No seguro');
    assert.equal(pending.canManageCamera,false);assert.equal(pending.camera.threshold,.9);
    assert.deepEqual((await store.readHistory()).entries,original);
    await db.exec(schema);await db.exec(schema);assert.deepEqual(await store.readCameraSettings(),camera);
    const upload=await fetch(base+'/api/ingest',{method:'POST',headers:{authorization:'Bearer '+process.env.CAMERA_TOKEN,'content-type':'image/jpeg','x-camera-boot':'0123456789abcdef','x-frame-seq':'5'},body:Buffer.from([255,216,255,217])});
    assert.equal(upload.status,200);
    const next=await store.readState();assert.equal(next.history.length,1);assert.equal(next.streak,0);assert.equal(next.rotation,0);assert.equal(next.threshold,.9);
    for(let seq=6;seq<=8;seq++)await store.saveReading(frame(seq,camera),config);
    assert.equal((await store.readState()).conclusion,'No seguro'); // 85 % no supera el nuevo 90 %.
    const beforeThreshold=frame(9,camera);
    camera=await store.setCameraSettings({rotation:0,threshold:.75,expectedVersion:camera.version});
    assert.equal((await(await fetch(base+'/api/state')).json()).orientationPending,false);
    await assert.rejects(store.saveReading(beforeThreshold,config),error=>error.status===409);
    const restarted=await store.saveReading(frame(9,camera),config);assert.equal(restarted.history.length,1);assert.equal(restarted.threshold,.75);
    for(let seq=10;seq<=12;seq++)await store.saveReading(frame(seq,camera),config);
    assert.equal((await store.readState()).conclusion,'Hay basura');
    const unchanged=await store.setCameraSettings({rotation:0,threshold:.75,expectedVersion:camera.version});assert.deepEqual(unchanged,camera);
    const tail=await store.saveReading(frame(13,camera),config);assert.equal(tail.history.length,3);assert.equal(tail.streak,2);
    assert.deepEqual((await store.readHistory()).entries.slice(-4),original);
    assert.equal((await send('logout',{method:'POST',headers,body:'{}'})).status,200);
    assert.equal((await send('settings',{headers:{cookie}})).status,401);
    assert.equal((await put({...change,expectedVersion:camera.version})).status,401);
    for(const path of ['login','logout'])assert.equal((await send(path)).status,405);
    assert.equal((await fetch(base+'/api/export.json')).status,404);
  }finally{if(app)await new Promise(resolve=>{app.server.close(resolve);app.server.closeAllConnections();});await db.close();}
});

test('Una inferencia no se guarda si cambian los ajustes justo al confirmar la transaccion',async()=>{
  const db=new PGlite();let race=false;
  try{
    await db.exec(await readFile(new URL('../database/schema.sql',import.meta.url),'utf8'));
    const execute=async(sql,args)=>{
      if(race&&sql.includes('WITH configuracion_actual')){race=false;await db.query('UPDATE camaras SET umbral_decision=.95, orientacion_version=orientacion_version+1');}
      return(await db.query(sql,args)).rows;
    };
    const store=createStore(execute),camera=await store.readCameraSettings();race=true;
    await assert.rejects(store.saveReading(frame(1,camera),config),error=>error.status===409);
    assert.equal(await store.readState(),null);assert.equal((await store.readHistory()).entries.length,0);
  }finally{await db.close();}
});
