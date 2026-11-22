import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../lib/http-server.js';
import { createLiveEvents } from '../lib/live-events.js';
import { createIngestHandler } from '../api/ingest.js';

test('SSE publico: conexion/reconexion, aviso inmediato, sin claves ni imagenes, y cierre limpio', async () => {
  const events=createLiveEvents(),app=createServer({health:async()=>{},routes:{'/api/events':events.subscribe}});
  const controller=new AbortController();let reader;
  try {
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
    const url='http://127.0.0.1:'+app.server.address().port+'/api/events';
    assert.equal((await fetch(url,{method:'POST'})).status,405);
    const response=await fetch(url,{signal:controller.signal});
    assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/event-stream/);
    assert.equal(response.headers.get('x-accel-buffering'),'no');reader=response.body.getReader();
    const decode=value=>new TextDecoder().decode(value);
    const ready=decode((await reader.read()).value);assert.match(ready,/retry: 2000/);assert.match(ready,/event: ready/);
    events.publish();const update=decode((await reader.read()).value);
    assert.equal(update,'event: measurement\ndata: {}\n\n');assert.doesNotMatch(update,/token|preview|password|scores/);
    events.close();assert.equal((await reader.read()).done,true);
  } finally {controller.abort();events.close();app.server.closeAllConnections();await new Promise(resolve=>app.server.close(resolve));}
});

test('El aviso espera al guardado y no se emite si el analisis o la escritura fallan', async () => {
  process.env.CAMERA_TOKEN='demo-test-camera-'.repeat(3);
  let release,entered,notices=0;
  const saving=new Promise(resolve=>{release=resolve;});const started=new Promise(resolve=>{entered=resolve;});
  const handler=createIngestHandler(async()=>({scores:[.05,.45,.4,.1],analysisMs:1}),async()=>{entered();await saving;return{conclusion:'No seguro'};},async()=>({rotation:180,version:'0'}),()=>{notices++;});
  const request=()=>({method:'POST',url:'/api/ingest',headers:{authorization:'Bearer '+process.env.CAMERA_TOKEN,'content-type':'image/jpeg','x-camera-boot':'0123456789abcdef','x-frame-seq':'1'},body:Buffer.from([255,216,255,217])});
  const response=()=>({setHeader(){},end(){}});
  const res=response(),pending=handler(request(),res);await started;assert.equal(notices,0);
  release();await pending;assert.equal(res.statusCode,200);assert.equal(notices,1);
  const failed=createIngestHandler(async()=>({}),async()=>{throw new Error('save failed');},async()=>({rotation:180,version:'0'}),()=>{notices++;});
  const bad=response();await failed(request(),bad);assert.equal(bad.statusCode,503);assert.equal(notices,1);
});
