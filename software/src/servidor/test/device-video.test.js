import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import WebSocket from 'ws';
import sharp from 'sharp';
import {createServer} from '../lib/http-server.js';
import {createAdminAuth} from '../lib/admin-auth.js';
import {createLivePreview} from '../lib/live-preview.js';
import {createLivePreviewHandlers} from '../api/live-preview.js';
import {createDeviceStatus} from '../lib/device-status.js';
import {attachDeviceVideo} from '../lib/device-video.js';

const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function setup(){
  process.env.CAMERA_TOKEN='continuous-video-test-'.repeat(3);
  let cookie;
  const auth=createAdminAuth({readCredentials:()=>({password:'test-video-password',secret:'video-secret-'.repeat(4)}),production:()=>false});
  const owner={headers:{host:'test',origin:'http://test'},socket:{remoteAddress:'test'}};
  const session=auth.login(owner,{setHeader(_k,v){cookie=v.split(';')[0];}},'test-video-password');
  owner.headers={...owner.headers,cookie,'x-csrf-token':session.csrf};
  const preview=createLivePreview({auth}),device=createDeviceStatus(),camera={paused:true,version:'4'};
  const handlers=createLivePreviewHandlers({auth,preview,device,heartbeatMs:10});
  const app=createServer({routes:{'/api/admin/live':handlers.control,'/api/admin/live/stream':handlers.stream},health:async()=>{}});
  const video=attachDeviceVideo(app.server,{preview,device,read:async()=>({...camera}),controlMs:30});
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+app.server.address().port;
  const headers={authorization:'Bearer '+process.env.CAMERA_TOKEN,'x-control-protocol':'3'};
  const connect=(custom=headers,path='/api/device/video')=>{
    const ws=new WebSocket(base.replace('http:','ws:')+path,'xiao-video',{headers:custom});
    const messages=[];ws.on('message',d=>messages.push(d.toString()));ws.on('error',()=>{});
    const opened=new Promise((resolve,reject)=>{ws.once('open',()=>resolve(ws));ws.once('unexpected-response',(_req,res)=>{res.resume();ws.terminate();reject(Object.assign(new Error('Rejected'),{status:res.statusCode}));});ws.once('error',reject);});
    const message=async prefix=>{const until=Date.now()+3000;while(Date.now()<until){const at=messages.findIndex(m=>m.startsWith(prefix));if(at>=0)return messages.splice(at,1)[0];await wait(5);}throw new Error('Missing message: '+prefix);};
    return {ws,opened,message};
  };
  return {auth,owner,preview,device,camera,base,headers,connect,async close(){preview.clear();video.close();await new Promise(r=>{app.server.close(r);app.server.closeAllConnections();});}};
}

test('Video continuo: token y permiso temporal obligatorios, sin acceso desde visitantes ni firmware antiguo',async()=>{
  const f=await setup();
  try{
    await assert.rejects(f.connect({}).opened,e=>e.status===401);
    await assert.rejects(f.connect().opened,e=>e.status===409);
    f.preview.command(f.owner,'start');
    await assert.rejects(f.connect({...f.headers,origin:'https://evil.test'}).opened,e=>e.status===403);
    await assert.rejects(f.connect({...f.headers,'x-control-protocol':'2'}).opened,e=>e.status===403);
    await assert.rejects(f.connect(f.headers,'/public-video').opened,e=>e.status===404);
    const link=f.connect();await link.opened;assert.equal(await link.message('STATE'),'STATE\nPAUSE\n4\n');
    await assert.rejects(f.connect().opened,e=>e.status===409);
    link.ws.send('STATUS\nPAUSE\n4\n');await wait(15);assert.equal(f.device.read().paused,true);assert.equal(f.device.read().protocol,3);
    const closed=once(link.ws,'close');f.preview.command(f.owner,'stop');await closed;assert.equal(f.preview.latest(),null);
  }finally{await f.close();}
});

test('Video continuo: 24 cuadros por una conexión, MJPEG privado, métricas, cambios de pausa y revocación',async()=>{
  const f=await setup();let reader;
  try{
    f.preview.command(f.owner,'start');const link=f.connect();await link.opened;await link.message('STATE');
    const response=await fetch(f.base+'/api/admin/live/stream',{headers:{cookie:f.owner.headers.cookie}});
    assert.match(response.headers.get('content-type'),/multipart\/x-mixed-replace/);
    reader=response.body.getReader();const chunks=[];
    const consuming=(async()=>{for(;;){const next=await reader.read();if(next.done)break;chunks.push(Buffer.from(next.value));}})();
    const jpeg=await sharp({create:{width:320,height:240,channels:3,background:'#319056'}}).jpeg().toBuffer();
    for(let i=1;i<=24;i++){link.ws.send(jpeg);assert.equal(await link.message('ACK'),`ACK\n${i}\n`);await wait(83);}
    const status=f.preview.status(f.owner);assert.equal(status.transport,'continuous');assert.ok(status.fps>=8&&status.fps<=13,JSON.stringify(status));
    assert.equal(f.preview.latest().sequence,24);assert.deepEqual(f.preview.latest().bytes,jpeg);
    f.camera.paused=false;f.camera.version='5';assert.equal(await link.message('STATE\nRUN'),'STATE\nRUN\n5\n');
    link.ws.send('STATUS\nRUN\n5\n');await wait(15);assert.equal(f.device.read().paused,false);assert.equal(f.device.read().version,'5');
    const closed=once(link.ws,'close');f.auth.logout(f.owner,{setHeader(){}});await closed;await consuming;
    assert.equal(f.preview.latest(),null);const all=Buffer.concat(chunks);assert.ok(all.includes(jpeg));assert.equal(all.toString('latin1').split('--xiao-frame').length-1,24);
  }finally{await reader?.cancel().catch(()=>{});await f.close();}
});

test('Video continuo: descarta mensajes inválidos y limita el tamaño del cuadro',async()=>{
  const f=await setup();
  try{
    f.preview.command(f.owner,'start');let link=f.connect();await link.opened;await link.message('STATE');
    let closed=once(link.ws,'close');link.ws.send(Buffer.from('not-jpeg'));assert.equal((await closed)[0],1008);assert.equal(f.preview.latest(),null);
    await wait(15);link=f.connect();await link.opened;await link.message('STATE');closed=once(link.ws,'close');link.ws.send(Buffer.alloc(200001));assert.equal((await closed)[0],1009);assert.equal(f.preview.latest(),null);
  }finally{await f.close();}
});
