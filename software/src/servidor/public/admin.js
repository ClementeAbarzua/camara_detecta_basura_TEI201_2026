import {DEFAULT_ROI,sameRoi} from './roi-geometry.js';
import {createRoiEditor} from './roi-editor.js';
import {createAdminLive} from './admin-live.js';
import {createAdminTools} from './admin-tools.js';
const $ = id => document.getElementById(id);
let csrfToken = null, camera = null, latest = null, authenticated = false, busy = false, timer;
let livePreview={active:false,ready:false};
const adminTools=createAdminTools({get:$,document,request,getCamera:()=>camera,isAuthenticated:()=>authenticated,isBusy:()=>busy,onBusy:setBusy,onCamera:next=>{camera=next;renderDraft();},onError:message=>{$('adminError').textContent=message;}});
const adminLive=createAdminLive({get:$,document,request,isAuthenticated:()=>authenticated,isBusy:()=>busy,onPreviewChange:state=>{livePreview=state;renderPreview();},onError:message=>{$('adminError').textContent=message;}});
const percent = value => `${Math.round(value * 100)} %`;
const imageSize=()=>({width:latest?.imageWidth || $('adminPhoto').naturalWidth || 800,height:latest?.imageHeight || $('adminPhoto').naturalHeight || 600});
const roiEditor=createRoiEditor({stage:$('roiStage'),box:$('roiBox'),handle:$('roiHandle'),sizeInput:$('roiSize'),xInput:$('roiX'),yInput:$('roiY'),reset:$('resetRoi'),
  readSize:imageSize,onChange:()=>renderDraft(),isDisabled:()=>busy||!authenticated});
function setSession(data) {
  authenticated = !!data.authenticated; csrfToken = data.csrfToken || null;
  $('loginPanel').hidden = authenticated; $('adminPanel').hidden = !authenticated;
  if (!authenticated) {
    clearTimeout(timer); adminTools.stop(); adminLive.disable(); camera = null; latest = null; $('adminPhoto').removeAttribute('src');
    roiEditor.setAvailable(false);
    $('adminStatus').textContent = data.configured === false ? 'El administrador todavía no está configurado en el servidor.' : 'Inicia sesión para cambiar los ajustes.';
  } else {adminLive.enable();$('adminStatus').textContent = 'Solo tu sesión puede guardar cambios. El monitor público sigue disponible.';}
}
async function request(path, options = {}) {
  const mutation = options.method && options.method !== 'GET';
  const response = await fetch('/api/admin/' + path, {cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(15000),...options,
    headers:{...(mutation ? {'Content-Type':'application/json'} : {}),...(csrfToken ? {'X-CSRF-Token':csrfToken} : {}),...options.headers}});
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && path !== 'login') setSession({authenticated:false});
    throw Object.assign(new Error(data.error || 'No se pudo completar la solicitud.'),{status:response.status});
  }
  return data;
}
function setBusy(value) {
  busy=value; $('loginButton').disabled=value; $('logoutButton').disabled=value;
  $('reloadSettings').disabled=value; $('cameraRotation').disabled=value;
  $('thresholdPercent').disabled=value; $('thresholdSlider').disabled=value; renderDraft();
  roiEditor.render();adminTools.render();adminLive.render();
}
function renderDraft() {
  adminLive.render();
  const threshold = Number($('thresholdPercent').value), rotation = Number($('cameraRotation').value);
  const valid = $('thresholdPercent').value.trim() !== '' && Number.isInteger(threshold) && threshold >= 60 && threshold <= 95;
  const roi=roiEditor.get();
  const dirty = !!camera && (rotation !== camera.rotation || Math.abs(threshold / 100 - camera.threshold) > .00001 || !sameRoi(roi,camera.roi ?? DEFAULT_ROI));
  $('roiSizeValue').textContent=Math.round(roi.size*100)+' %';$('roiXValue').textContent=Math.round(roi.centerX*100)+' %';$('roiYValue').textContent=Math.round(roi.centerY*100)+' %';
  $('trashLimit').textContent=valid ? threshold + ' %' : '—'; $('clearLimit').textContent=valid ? (100-threshold) + ' %' : '—';
  $('saveSettings').disabled=busy || !valid || !dirty;
  $('draftStatus').textContent=!valid ? 'Elige una exigencia entera entre 60 y 95 %.' : dirty ? 'Tienes cambios sin guardar. La vista previa todavía no cambia el análisis.' : 'No hay cambios pendientes.';
  renderPreview();
}
function renderPreview(){
  const rotation=Number($('cameraRotation').value);
  $('roiLive').classList.toggle('rotated',rotation===180);
  $('roiLive').hidden=!(authenticated&&livePreview.active&&livePreview.ready);
  if(authenticated&&livePreview.active){
    $('adminPhoto').hidden=true;$('adminPhotoEmpty').hidden=livePreview.ready;
    $('adminPhotoEmpty').textContent='Conectando el video para encuadrar…';
    $('previewStatus').textContent=livePreview.ready?'Video en vivo · mueve la cámara y ajusta el recuadro. El giro y la zona se aplican al guardar cambios.':'Esperando el video en vivo para encuadrar. La detección puede permanecer pausada.';
    roiEditor.setAvailable(livePreview.ready);
  }else if (authenticated&&latest?.preview) {
    const src='data:image/jpeg;base64,'+latest.preview;
    if($('adminPhoto').getAttribute('src')!==src)$('adminPhoto').src=src;
    $('adminPhoto').hidden=false; $('adminPhotoEmpty').hidden=true;
    $('adminPhoto').classList.toggle('rotated',rotation !== (latest.rotation ?? 0));
    $('previewStatus').textContent='Vista previa del giro y la zona seleccionados · captura del ' + new Date(latest.receivedAt).toLocaleString('es-CL');
    roiEditor.setAvailable(true);
  }else{
    $('adminPhoto').hidden=true;$('adminPhotoEmpty').hidden=false;$('adminPhotoEmpty').textContent='Todavía no hay una captura.';
    $('previewStatus').textContent='Todavía no hay una captura.';roiEditor.setAvailable(false);
  }
}
function applyConfiguration(data) {
  camera=data.camera; $('cameraRotation').value=String(camera.rotation);
  roiEditor.set(camera.roi ?? DEFAULT_ROI);
  $('thresholdPercent').value=String(Math.round(camera.threshold*100)); $('thresholdSlider').value=$('thresholdPercent').value;
  $('savedSettings').textContent=`Guardado: ${camera.rotation === 180 ? 'giro de 180°' : 'orientación normal (0°)'} · exigencia ${percent(camera.threshold)} · tamaño de zona ${percent((camera.roi ?? DEFAULT_ROI).size)} del lado corto.`;
  $('adminDecisionPolicy').textContent=`${data.decision.profile === 'demo' ? 'Modo demo' : 'Modo estable'}: promedio de hasta ${data.decision.windowSize} capturas y ${data.decision.confirmationsRequired} evaluaciones seguidas para confirmar.`;
  renderDraft();adminTools.configuration();adminTools.start();
}
async function preview() {
  clearTimeout(timer);
  if (!authenticated || document.hidden) return;
  try {
    const response=await fetch('/api/state',{cache:'no-store',signal:AbortSignal.timeout(15000)});
    if (!response.ok) throw Error();
    const data=await response.json();
    if (!authenticated) return;
    latest=data.state;
    renderDraft();
  }catch{if(authenticated&&!livePreview.active)$('previewStatus').textContent='No se pudo actualizar la vista previa. Se volverá a intentar.';}
  finally{if(authenticated&&!document.hidden)timer=setTimeout(preview,5000);}
}
$('loginForm').addEventListener('submit',async event=>{
  event.preventDefault(); if(busy)return; setBusy(true); $('adminError').textContent='';
  try {
    const password=$('adminPassword').value; $('adminPassword').value='';
    setSession(await request('login',{method:'POST',body:JSON.stringify({password})}));
    applyConfiguration(await request('settings')); preview();
  }catch(error){$('adminError').textContent=error.message;}
  finally{setBusy(false);}
});
$('settingsForm').addEventListener('submit',async event=>{
  event.preventDefault();if(busy||$('saveSettings').disabled)return;setBusy(true);$('adminError').textContent='';
  try{
    const data=await request('settings',{method:'PUT',body:JSON.stringify({rotation:Number($('cameraRotation').value),threshold:Number($('thresholdPercent').value)/100,expectedVersion:camera.version,roi:roiEditor.get()})});
    applyConfiguration(data);$('adminStatus').textContent=data.message;preview();
  }catch(error){$('adminError').textContent=error.message;}
  finally{setBusy(false);}
});
$('reloadSettings').addEventListener('click',async()=>{
  if(busy)return;setBusy(true);$('adminError').textContent='';
  try{applyConfiguration(await request('settings'));$('adminStatus').textContent='Ajustes guardados recargados. Se descartó el borrador de esta pestaña.';}
  catch(error){$('adminError').textContent=error.message;}finally{setBusy(false);}
});
$('logoutButton').addEventListener('click',async()=>{
  if(busy)return;setBusy(true);$('adminError').textContent='';
  try{await request('logout',{method:'POST',body:'{}'});setSession({authenticated:false});$('adminStatus').textContent='Sesión cerrada.';}
  catch(error){$('adminError').textContent=error.message;}finally{setBusy(false);}
});
$('thresholdPercent').addEventListener('input',()=>{$('thresholdSlider').value=$('thresholdPercent').value;renderDraft();});
$('thresholdSlider').addEventListener('input',()=>{$('thresholdPercent').value=$('thresholdSlider').value;renderDraft();});
$('cameraRotation').addEventListener('change',renderDraft);
$('adminPhoto').addEventListener('load',()=>{roiEditor.render();renderDraft();});
document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden&&authenticated)preview();});
async function start(){
  setBusy(true);
  try{setSession(await request('session'));if(authenticated){applyConfiguration(await request('settings'));preview();}}
  catch(error){setSession({authenticated:false});$('adminError').textContent=error.message;}
  finally{setBusy(false);}
}
start();
