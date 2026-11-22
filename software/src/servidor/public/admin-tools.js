export function createAdminTools({get,document:doc,request,getCamera,isAuthenticated,isBusy,onBusy,onCamera,onError}){
  let active=false,timer,operation=null,generation=0;
  const dayKey=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  function render(){
    const camera=operation?.camera??getCamera(),paused=!!camera?.paused;
    get('pauseCaptures').textContent=paused?'Reanudar capturas y análisis':'Pausar capturas y análisis';
    get('pauseCaptures').disabled=!active||isBusy()||!camera;
    get('operationTitle').textContent=paused?'Detección en pausa':'Detección activa';
    const device=operation?.device;
    get('operationStatus').textContent=operation?.maintenancePaused?'Hay una pausa de mantenimiento en Railway (INGEST_PAUSED). Debe retirarse allí para reanudar.':
      paused?'El servidor no analiza ni guarda nuevas mediciones. El historial se conserva.':'La cámara puede enviar fotografías y el servidor registra sus análisis.';
    get('devicePauseStatus').textContent=device?.online&&device.version===camera?.version&&device.paused===paused?
      (paused?'La XIAO confirmó la pausa de las fotos de análisis.':'La XIAO confirmó que las fotos de análisis están activas.'):
      device?.online?'Esperando que la XIAO confirme la última orden.':
      'Sin confirmación reciente de la placa. Para detener también la toma de fotos, carga el firmware actualizado conservando tu config.h.';
  }
  async function poll(){
    clearTimeout(timer);const expected=generation;
    if(!active||doc.hidden||!isAuthenticated())return;
    try{
      const data=await request('operations');
      if(active&&generation===expected){operation=data;render();}
    }catch(error){if(active&&generation===expected)get('operationStatus').textContent=error.message;}
    finally{if(active&&generation===expected&&!doc.hidden)timer=setTimeout(poll,3000);}
  }
  get('pauseCaptures').addEventListener('click',async()=>{
    if(!active||isBusy()||!getCamera())return;
    generation++;clearTimeout(timer);onBusy(true);onError('');
    try{
      const camera=getCamera(),data=await request('operations',{method:'PUT',body:JSON.stringify({paused:!(operation?.camera??camera).paused,expectedVersion:camera.version})});
      if(!active)return;
      operation=data;onCamera(data.camera);
    }catch(error){onError(error.message);}
    finally{onBusy(false);render();if(active)poll();}
  });
  function downloads(){
    const ranged=get('exportScope').value==='dates';get('exportDates').hidden=!ranged;
    const today=dayKey(new Date());get('exportFrom').max=get('exportTo').max=today;
    let from,to,valid=active&&isAuthenticated();
    if(ranged){
      const a=get('exportFrom').value,b=get('exportTo').value;
      valid=valid&&/^\d{4}-\d{2}-\d{2}$/.test(a)&&/^\d{4}-\d{2}-\d{2}$/.test(b)&&a<=b&&b<=today;
      if(valid){const first=new Date(a+'T00:00:00'),last=new Date(b+'T00:00:00');last.setDate(last.getDate()+1);from=first.getTime();to=last.getTime();valid=Number.isSafeInteger(from)&&from>=0&&Number.isSafeInteger(to)&&from<to;}
    }
    get('exportStatus').textContent=ranged?(valid?'Se incluirán las mediciones de esos días, según la hora de este dispositivo.':'Elige una fecha inicial y final válidas.'):'Se incluirá todo el historial guardado.';
    for(const [id,format]of [['exportDatabaseJSON','json'],['exportMeasurementsCSV','csv']]){
      const link=get(id),params=new URLSearchParams({format});
      if(ranged&&valid){params.set('from',from);params.set('to',to);}
      if(valid)link.setAttribute('href','/api/admin/export?'+params);else link.removeAttribute('href');
      link.setAttribute('aria-disabled',String(!valid));
      link.onclick=event=>{if(!active||!isAuthenticated()||!valid)event.preventDefault();};
    }
  }
  for(const id of ['exportScope','exportFrom','exportTo'])get(id).addEventListener('change',downloads);
  doc.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(active&&!doc.hidden)poll();});
  return {
    start(){if(active){render();downloads();return;}active=true;generation++;render();downloads();poll();},
    stop(){active=false;generation++;clearTimeout(timer);operation=null;render();downloads();},
    render,
    configuration(){operation=null;render();}
  };
}
