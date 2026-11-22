import {WebSocketServer,WebSocket} from 'ws';
import {cameraAuthorized} from './auth.js';
import {livePreview} from './live-preview.js';
import {deviceStatus} from './device-status.js';
import {readCameraSettings} from './store.js';

// Un solo enlace TLS continuo desde la placa. Sin cola, modelo ni escrituras SQL.
export function attachDeviceVideo(server,{preview=livePreview,device=deviceStatus,read=readCameraSettings,now=Date.now,controlMs=1000}={}){
  const wss=new WebSocketServer({noServer:true,maxPayload:200000,maxFragments:64,maxBufferedChunks:128,perMessageDeflate:false});
  let current=null,closed=false;
  const reject=(socket,code)=>{socket.end(`HTTP/1.1 ${code} Rejected\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);};
  const upgrade=(req,socket,head)=>{
    socket.on('error',()=>{});
    let path;try{path=new URL(req.url,'http://localhost').pathname;}catch{return reject(socket,400);}
    if(path!=='/api/device/video')return reject(socket,404);
    if(closed)return reject(socket,503);
    if(!cameraAuthorized(req))return reject(socket,401);
    // El navegador ve MJPEG privado; solo la XIAO puede subir video por este enlace.
    if(req.headers.origin||req.headers['x-control-protocol']!=='3')return reject(socket,403);
    if(!preview.active())return reject(socket,409);
    if(current)return reject(socket,409);
    wss.handleUpgrade(req,socket,head,ws=>{
      current=ws;let timer,reading=false,ready=false,received=0,tokens=4,last=now(),lastFrame=now(),lastState=now();
      const send=text=>{if(ws.readyState!==WebSocket.OPEN)return false;if(ws.bufferedAmount>4096){ws.terminate();return false;}ws.send(text);return true;};
      const stop=()=>ws.terminate(),removeStop=preview.onStop(stop);
      const refresh=async()=>{
        if(ws.readyState!==WebSocket.OPEN)return;
        if(!preview.active()||now()-lastFrame>10000)return stop();
        if(reading){if(now()-lastState>5000)stop();return;}
        reading=true;
        try{
          const camera=await read();
          if(ws.readyState!==WebSocket.OPEN||!preview.active())return stop();
          ready=true;lastState=now();
          send(`STATE\n${camera.paused||process.env.INGEST_PAUSED==='true'?'PAUSE':'RUN'}\n${camera.version}\n`);
        }catch{stop();}finally{reading=false;}
      };
      ws.on('message',(data,binary)=>{
        if(ws.readyState!==WebSocket.OPEN)return;
        if(!preview.active())return stop();
        // Hasta 30 cuadros/s y ráfaga corta; nunca acumular una grabación.
        const at=now();tokens=Math.min(4,tokens+(at-last)*.03);last=at;
        if(tokens<1)return ws.close(1008,'Rate limit');tokens--;
        if(!ready||at-lastState>5000)return stop();
        if(!binary){
          if(data.length>128)return ws.close(1008,'Invalid status');
          const match=/^STATUS\n(PAUSE|RUN)\n(0|[1-9]\d{0,18})\n$/.exec(data.toString());
          if(!match)return ws.close(1008,'Invalid status');
          device.note({headers:{'x-control-protocol':'3','x-device-mode':match[1]==='PAUSE'?'paused':'running','x-control-version':match[2],'x-preview-mode':'active'}});
          return;
        }
        if(data.length<4||data[0]!==255||data[1]!==216||data.at(-2)!==255||data.at(-1)!==217)return ws.close(1008,'Invalid JPEG');
        try{preview.accept(data,{transport:'continuous'});}catch{return stop();}
        lastFrame=at;send(`ACK\n${++received}\n`);
      });
      ws.on('error',()=>{});
      ws.on('close',()=>{clearInterval(timer);removeStop();if(current===ws)current=null;});
      timer=setInterval(refresh,controlMs);timer.unref?.();refresh();
    });
  };
  server.on('upgrade',upgrade);
  return {close(){closed=true;server.off('upgrade',upgrade);for(const ws of wss.clients)ws.terminate();wss.close();}};
}
