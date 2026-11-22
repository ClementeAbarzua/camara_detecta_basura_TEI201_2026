export function createAdminLive({get,document:doc,request,isAuthenticated,isBusy,onError,onPreviewChange=()=>{},page=globalThis.window,schedule=setTimeout,cancel=clearTimeout,now=Date.now}){
  let enabled=false,viewing=false,pending=false,timer,retryTimer,readyTimer,generation=0,deadline=0;
  let attached=false,attachedAt=0,roiReady=false,retryDelay=1000,sourceId=0;
  const photo=get('roiLive');
  const notify=()=>onPreviewChange({active:viewing,ready:viewing&&roiReady});
  function render(){
    get('toggleLive').textContent=viewing?'Detener video':'Iniciar video';
    get('toggleLive').disabled=!enabled||pending||isBusy();
    get('toggleLive').setAttribute('aria-pressed',String(viewing));
    photo.classList.toggle('rotated',get('cameraRotation').value==='180');
  }
  function clearStream(){
    cancel(readyTimer);
    attached=false;roiReady=false;
    photo.removeAttribute('src');photo.hidden=true;notify();
  }
  function attach(){
    if(attached)return;
    attached=true;attachedAt=now();
    const src='/api/admin/live/stream?t='+now()+'&connection='+(++sourceId);
    photo.setAttribute('src',src);
    checkFrames();
  }
  function checkFrames(){
    if(!viewing||!attached)return;
    // Algunos navegadores no emiten load hasta que termina el MJPEG.
    if(!roiReady&&photo.naturalWidth>0){roiReady=true;photo.hidden=false;notify();}
    if(!roiReady)readyTimer=schedule(checkFrames,250);
  }
  async function stop(remote=true,message='Video detenido. Se muestra la última captura disponible.'){
    const wasViewing=viewing;viewing=false;pending=false;const expected=++generation;cancel(timer);cancel(retryTimer);clearStream();
    get('liveStatus').textContent=message;render();
    if(remote&&wasViewing&&isAuthenticated()){
      pending=true;render();try{await request('live',{method:'PUT',body:JSON.stringify({action:'stop'}),keepalive:true});}catch{}
      finally{if(expected===generation)pending=false;render();}
    }
  }
  function status(data){
    if(data.frameAt&&now()-data.frameAt<8000){
      photo.hidden=!roiReady;
      get('liveStatus').textContent=`Video continuo · ${data.fps??0} fps recibidos. Ajusta la cámara y el recuadro para encuadrar.`;
    }else{
      get('liveStatus').textContent=data.device?.online&&data.device.protocol!==3?
        'La placa necesita el firmware de video continuo. Conserva tu config.h al actualizarla.':
        'Esperando la transmisión de la XIAO. Comprueba su conexión y el firmware de video continuo.';
      if(attached&&now()-attachedAt>10000){clearStream();reconnect();}
    }
  }
  function reconnect(){
    if(!viewing||!enabled)return;
    cancel(timer);cancel(retryTimer);
    get('liveStatus').textContent='Reconectando el video automáticamente…';
    if(!doc.hidden)retryTimer=schedule(()=>synchronize(true),retryDelay);
    retryDelay=Math.min(5000,retryDelay*2);
  }
  async function synchronize(recover=false,initial=false){
    if(!viewing||!enabled||pending)return;
    if(!isAuthenticated())return stop(false);
    if(now()>=deadline)return stop(true,'El video llegó al límite de 5 minutos. Pulsa Iniciar video para volver a activarlo.');
    cancel(timer);cancel(retryTimer);pending=true;const expected=generation;let success=false;
    render();
    const valid=()=>viewing&&enabled&&expected===generation&&isAuthenticated();
    try{
      let action=initial?'start':'keepalive';
      if(recover){
        const current=await request('live');if(!valid())return;
        if(current.active&&!current.owned){await stop(false,'Otra sesión está usando el video. Puedes iniciarlo cuando termine.');return;}
        action=current.active?'keepalive':'start';
      }
      const data=await request('live',{method:'PUT',body:JSON.stringify({action})});
      if(!valid()){
        if(action==='start'&&enabled&&!viewing&&isAuthenticated())await request('live',{method:'PUT',body:JSON.stringify({action:'stop'}),keepalive:true}).catch(()=>{});
        return;
      }
      deadline=Math.min(deadline,data.stopAt??deadline);retryDelay=1000;
      if(action==='start'&&attached)clearStream();
      attach();status(data);success=true;
    }catch(error){
      if(valid()){
        if([401,403].includes(error.status)){await stop(false,error.message);onError(error.message);}
        else reconnect();
      }
    }finally{
      if(expected===generation){pending=false;render();if(success&&viewing)timer=schedule(()=>synchronize(false),5000);}
    }
  }
  get('toggleLive').addEventListener('click',async()=>{
    if(!enabled||pending||isBusy())return;
    if(viewing)return stop(true);
    viewing=true;generation++;deadline=now()+300000;notify();onError('');
    get('liveStatus').textContent='Conectando el video…';await synchronize(false,true);
  });
  photo.addEventListener('load',()=>{
    if(!viewing||!attached)return;
    roiReady=true;photo.hidden=false;notify();
    get('liveStatus').textContent='Video en vivo. Ajusta la posición de la cámara y la zona de análisis.';
  });
  const streamError=()=>{if(viewing&&attached){clearStream();reconnect();}};
  photo.addEventListener('error',streamError);
  // Mover entre pantallas puede provocar hidden/visible. No revocar la intención del usuario.
  const foreground=()=>{if(viewing&&enabled&&!doc.hidden)return synchronize(true);};
  doc.addEventListener('visibilitychange',foreground);
  page?.addEventListener('focus',foreground);
  page?.addEventListener('pageshow',foreground);
  page?.addEventListener('pagehide',()=>stop(true));
  return {enable(){enabled=true;render();},disable(){enabled=false;pending=false;stop(false);},render};
}
