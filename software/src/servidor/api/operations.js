import {adminAuth} from '../lib/admin-auth.js';
import {cameraAuthorized} from '../lib/auth.js';
import {body,reply,settings} from '../lib/config.js';
import {readCameraSettings,setCapturePaused} from '../lib/store.js';
import {liveEvents} from '../lib/live-events.js';
import {livePreview} from '../lib/live-preview.js';
import {deviceStatus} from '../lib/device-status.js';

export function createOperationHandlers({auth=adminAuth,read=readCameraSettings,save=setCapturePaused,publish=liveEvents.publish,device=deviceStatus,preview=livePreview}={}){
  const normalize=camera=>({...camera,threshold:camera.threshold??settings().threshold});
  const snapshot=async()=>({camera:normalize(await read()),device:device.read(),maintenancePaused:process.env.INGEST_PAUSED==='true'});
  return {
    operations:async(req,res)=>{
      try{
        if(req.method==='GET'){auth.requireSession(req);return reply(res,200,await snapshot());}
        if(req.method!=='PUT')return reply(res,405,{error:'Usa GET o PUT.'});
        auth.requireMutation(req);
        if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))return reply(res,415,{error:'Se requiere JSON.'});
        let input;try{input=JSON.parse((await body(req,4096)).toString('utf8'));}catch(e){if(e.status)throw e;return reply(res,400,{error:'JSON inválido.'});}
        if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['paused','expectedVersion'].includes(k)))return reply(res,400,{error:'Operación inválida.'});
        const camera=normalize(await save(input));
        try{publish();}catch{console.error('No se pudo avisar del cambio de pausa.');}
        return reply(res,200,{camera,device:device.read(),maintenancePaused:process.env.INGEST_PAUSED==='true'});
      }catch(e){reply(res,e.status||503,{error:e.status?e.message:'No se pudo consultar o guardar la pausa.'});}
    },
    control:async(req,res)=>{
      try{
        if(req.method!=='GET')return reply(res,405,{error:'Usa GET.'});
        if(!cameraAuthorized(req))return reply(res,401,{error:'Token de cámara incorrecto.'});
        device.note(req);const camera=await read(),paused=camera.paused||process.env.INGEST_PAUSED==='true';
        res.setHeader('Content-Type','text/plain; charset=utf-8');res.setHeader('Cache-Control','private, no-store');
        const protocol=req.headers['x-control-protocol'],live=protocol==='3'&&preview.active();res.setHeader('X-Preview-Active',live?'1':'0');
        const extra=['2','3'].includes(protocol)?`${live?'PREVIEW':'IDLE'}\n`:'';
        res.statusCode=200;res.end(`${paused?'PAUSE':'RUN'}\n${camera.version}\n${extra}`);
      }catch(e){reply(res,e.status||503,{error:'No se pudo consultar la orden de la cámara.'});}
    }
  };
}
export const operationHandlers=createOperationHandlers();
