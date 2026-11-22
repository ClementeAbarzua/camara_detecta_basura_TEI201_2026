// Confirmación operativa de la placa. No guarda secretos ni fotos.
export function createDeviceStatus(now=Date.now){
  let last=null;
  return {
    note(req){
      const protocol=req.headers['x-control-protocol'];if(!['1','2','3'].includes(protocol))return;
      const mode=req.headers['x-device-mode'],version=req.headers['x-control-version'];
      if(!['running','paused'].includes(mode)||! /^(0|[1-9]\d{0,18})$/.test(version||''))return;
      last={seenAt:now(),paused:mode==='paused',version,...(protocol!=='1'?{protocol:Number(protocol),previewing:req.headers['x-preview-mode']==='active'}:{})};
    },
    read(){return last?{...last,online:now()-last.seenAt<20000}:null;}
  };
}
export const deviceStatus=createDeviceStatus();
