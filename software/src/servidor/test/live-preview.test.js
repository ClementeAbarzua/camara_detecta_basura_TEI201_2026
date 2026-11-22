import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAdminAuth} from '../lib/admin-auth.js';
import {createLivePreview} from '../lib/live-preview.js';
import {createLivePreviewHandlers} from '../api/live-preview.js';
import {createOperationHandlers} from '../api/operations.js';
import {createDeviceStatus} from '../lib/device-status.js';
import {createServer} from '../lib/http-server.js';
import sharp from 'sharp';
const password='live-test-password',secret='live-test-secret-'.repeat(3);
function fixture(){
  let clock=1000000,credentials={password,secret};
  const auth=createAdminAuth({now:()=>clock,readCredentials:()=>credentials,production:()=>false});
  const login=()=>{
    let cookie;const req={headers:{host:'test',origin:'http://test'},socket:{remoteAddress:'test'}};
    const session=auth.login(req,{setHeader(_k,v){cookie=v.split(';')[0];}},password);
    return {...req,headers:{...req.headers,cookie,'x-csrf-token':session.csrf}};
  };
  const preview=createLivePreview({auth,now:()=>clock});
  return {auth,preview,login,now:()=>clock,advance(ms){clock+=ms;},rotate(){credentials={...credentials,password:password+'new'};}};
}

test('Vista en vivo: lease acotada, propiedad, revocación, imagen reciente y cierre automático',()=>{
  const f=fixture(),owner=f.login(),other=f.login(),view=f.preview;
  assert.equal(view.active(),false);assert.equal(view.latest(),null);
  view.command(owner,'start');assert.equal(view.status(owner).owned,true);assert.equal(view.status(other).owned,false);
  assert.throws(()=>view.command(other,'start'),e=>e.status===409);
  view.accept(Buffer.from('first'));assert.equal(view.latest().bytes.toString(),'first');
  view.accept(Buffer.from('second'));assert.equal(view.latest().bytes.toString(),'second');
  const callbacks=[];const dispose=view.subscribe(frame=>callbacks.push(frame));
  f.advance(3001);assert.equal(view.latest(),null);assert.equal(view.active(),true);
  view.command(owner,'keepalive');f.advance(15000);assert.equal(view.active(),false);assert.equal(view.latest(),null);assert.deepEqual(callbacks,[null]);
  assert.throws(()=>view.command(owner,'keepalive'),e=>e.status===409);
  view.command(owner,'start');f.auth.logout(owner,{setHeader(){}});assert.equal(view.active(),false);
  const fresh=f.login();view.command(fresh,'start');f.rotate();assert.equal(view.active(),false);dispose();
});

test('Vista en vivo: cinco minutos máximos y límite de espectadores aunque la sesión siga activa',()=>{
  const f=fixture(),owner=f.login(),view=f.preview;
  view.command(owner,'start');for(let i=0;i<21;i++){f.advance(14000);view.command(owner,'keepalive');}
  f.advance(6000);assert.equal(view.active(),false);
  view.command(owner,'start');const removes=Array.from({length:4},()=>view.subscribe(()=>{}));
  assert.throws(()=>view.subscribe(()=>{}),e=>e.status===429);removes.forEach(remove=>remove());
  view.command(owner,'stop');assert.equal(view.active(),false);
});

test('HTTP: video privado, CSRF, token de cámara, JPEG limitado, stream real y compatibilidad de firmware',async()=>{
  process.env.CAMERA_TOKEN='live-test-camera-token-'.repeat(3);
  const f=fixture(),device=createDeviceStatus(f.now),camera={rotation:180,version:'7',paused:true,threshold:.8};let app;
  const live=createLivePreviewHandlers({...f,device,heartbeatMs:10});
  const ops=createOperationHandlers({auth:f.auth,preview:f.preview,device,read:async()=>({...camera})});
  try{
    app=createServer({health:async()=>{},routes:{'/api/admin/live':live.control,'/api/admin/live/stream':live.stream,'/api/device/preview':live.upload,'/api/device/control':ops.control}});
    await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
    const owner=f.login(),headers={...owner.headers,host:undefined,origin:base,'content-type':'application/json'};delete headers.host;
    const put=(action,custom=headers)=>fetch(base+'/api/admin/live',{method:'PUT',headers:custom,body:JSON.stringify({action})});
    const cameraHeaders={authorization:'Bearer '+process.env.CAMERA_TOKEN,'content-type':'image/jpeg','x-control-protocol':'3','x-device-mode':'paused','x-control-version':'7','x-preview-mode':'active'};
    for(const path of ['/api/admin/live','/api/admin/live/stream'])for(const h of [{},{authorization:cameraHeaders.authorization},{cookie:'xiao_session=legacy'}])assert.equal((await fetch(base+path,{headers:h})).status,401);
    assert.equal((await put('start',{...headers,origin:'https://evil.test'})).status,403);
    assert.equal((await put('start',{...headers,'x-csrf-token':''})).status,403);
    for(const action of ['start-video',null,0])assert.equal((await put(action)).status,400);
    assert.equal((await fetch(base+'/api/device/preview',{method:'POST',body:'x'})).status,401);
    const jpeg=await sharp({create:{width:800,height:600,channels:3,background:'#429050'}}).jpeg().toBuffer();
    const upload=(data=jpeg,custom=cameraHeaders)=>fetch(base+'/api/device/preview',{method:'POST',headers:custom,body:data});
    assert.equal((await upload()).status,410);
    assert.equal((await put('start')).status,200);assert.equal(f.preview.active(),true);
    assert.equal((await upload()).status,410); // El transporte lento por POST queda retirado.
    const controller=new AbortController(),stream=await fetch(base+'/api/admin/live/stream',{headers:{cookie:headers.cookie},signal:controller.signal});
    assert.equal(stream.status,200);assert.match(stream.headers.get('content-type'),/multipart\/x-mixed-replace/);assert.match(stream.headers.get('cache-control'),/private, no-store/);
    const reader=stream.body.getReader();f.preview.accept(jpeg,{transport:'continuous'});
    let bytes=Buffer.alloc(0);while(!bytes.includes(jpeg))bytes=Buffer.concat([bytes,Buffer.from((await reader.read()).value)]);
    assert.ok(bytes.includes(Buffer.from('Content-Type: image/jpeg')));assert.equal((await upload()).status,410);
    const status=await(await fetch(base+'/api/admin/live',{headers})).json();assert.equal(status.transport,'continuous');assert.equal(status.frameAt,f.now());assert.equal(status.bytes,undefined);
    const control=await fetch(base+'/api/device/control',{headers:cameraHeaders});assert.equal(await control.text(),'PAUSE\n7\nPREVIEW\n');
    const oldVideo=await fetch(base+'/api/device/control',{headers:{...cameraHeaders,'x-control-protocol':'2'}});assert.equal(await oldVideo.text(),'PAUSE\n7\nIDLE\n');
    const legacy=await fetch(base+'/api/device/control',{headers:{...cameraHeaders,'x-control-protocol':'1'}});assert.equal(await legacy.text(),'PAUSE\n7\n');
    assert.equal((await(await fetch(base+'/')).text()).includes('id="toggleLive"'),false);
    for(const path of ['/api/live','/api/preview','/stream'])assert.equal((await fetch(base+path)).status,404);
    assert.equal(camera.paused,true); // La vista no modifica la pausa persistente de detección.
    f.auth.logout(owner,{setHeader(){}});f.advance(400);
    const rejected=await upload();assert.equal(rejected.status,410);assert.equal(rejected.headers.get('x-preview-active'),'0');assert.equal(f.preview.latest(),null);
    let done=false;for(let i=0;i<3&&!done;i++)done=(await reader.read()).done;assert.equal(done,true);controller.abort();
  }finally{f.preview.clear();if(app)await new Promise(r=>{app.server.close(r);app.server.closeAllConnections();});}
});

test('La expiración elimina el cuadro de RAM aun cuando ya no llegan solicitudes',async()=>{
  const f=fixture(),owner=f.login(),view=createLivePreview({auth:f.auth,now:f.now,leaseMs:20});let cleared=false;
  view.command(owner,'start');view.accept(Buffer.from('private-frame'));const remove=view.subscribe(frame=>{if(frame===null)cleared=true;});
  f.advance(21);await new Promise(r=>setTimeout(r,40));assert.equal(cleared,true);assert.equal(view.latest(),null);remove();
});

test('Un espectador lento descarta cuadros y no acumula imágenes pendientes',async()=>{
  const {EventEmitter}=await import('node:events'),f=fixture(),owner=f.login();
  const handlers=createLivePreviewHandlers({...f,heartbeatMs:10000});
  const res=new EventEmitter();res.headers={};res.setHeader=(k,v)=>{res.headers[k]=v;};res.flushHeaders=()=>{};res.writableNeedDrain=false;let writes=0;
  res.write=()=>{writes++;res.writableNeedDrain=true;return false;};res.end=()=>{res.writableEnded=true;res.emit('close');};
  f.preview.command(owner,'start');await handlers.stream({...owner,method:'GET'},res);
  for(let i=0;i<100;i++)f.preview.accept(Buffer.from('frame-'+i));
  assert.equal(writes,1);res.writableNeedDrain=false;f.preview.accept(Buffer.from('newest'));assert.equal(writes,2);
  f.preview.command(owner,'stop');assert.equal(res.writableEnded,true);assert.equal(f.preview.latest(),null);
});
