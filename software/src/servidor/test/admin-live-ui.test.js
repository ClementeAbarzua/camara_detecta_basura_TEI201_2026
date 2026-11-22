import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAdminLive} from '../public/admin-live.js';
class Element{
  constructor(){this.attributes={};this.listeners={};this.value='180';this.hidden=true;this.disabled=false;this.textContent='';const names=new Set();this.classList={toggle(n,on){if(on)names.add(n);else names.delete(n);},contains:n=>names.has(n)};}
  addEventListener(name,fn){this.listeners[name]=fn;}
  setAttribute(name,value){this.attributes[name]=value;}
  removeAttribute(name){delete this.attributes[name];}
  dispatch(name){return this.listeners[name]?.();}
}
function setup(custom){
  const elements=new Map(),get=id=>{assert.ok(!['livePhoto','liveEmpty'].includes(id),'No se debe acceder al visor eliminado');if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
  const handlers={},pageHandlers={},doc={hidden:false,addEventListener(name,fn){handlers[name]=fn;}},timers=new Map();
  let next=0,clock=1000,authenticated=true,busy=false;const calls=[],errors=[],previews=[];
  const data=()=>({active:true,owned:true,frameAt:clock,stopAt:clock+300000,fps:12,device:{protocol:3,online:true}});
  const request=async(path,options={})=>{calls.push({path,...options});return custom?custom(path,options,data()):data();};
  const ui=createAdminLive({get,document:doc,request,isAuthenticated:()=>authenticated,isBusy:()=>busy,onError:e=>errors.push(e),onPreviewChange:p=>previews.push(p),page:{addEventListener(name,fn){pageHandlers[name]=fn;}},
    schedule:(fn,delay)=>{timers.set(++next,{fn,at:clock+delay});return next;},cancel:id=>timers.delete(id),now:()=>clock});
  const settle=()=>new Promise(r=>setImmediate(r));
  const advance=async ms=>{const end=clock+ms;for(;;){const first=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!first||first[1].at>end)break;timers.delete(first[0]);clock=first[1].at;await first[1].fn();await settle();}clock=end;};
  return {ui,get,doc,handlers,pageHandlers,timers,calls,errors,previews,settle,advance,jump(ms){clock+=ms;},auth(value){authenticated=value;},busy(value){busy=value;},actions(){return calls.filter(c=>c.method==='PUT').map(c=>JSON.parse(c.body).action);},load(){get('roiLive').dispatch('load');}};
}

test('Un solo visor en la zona de análisis inicia y detiene el stream privado sin modificar detección',async()=>{
  const f=setup();f.ui.enable();f.busy(true);await f.get('toggleLive').dispatch('click');assert.equal(f.calls.length,0);f.busy(false);
  await f.get('toggleLive').dispatch('click');assert.deepEqual(f.actions(),['start']);
  const src=f.get('roiLive').attributes.src;assert.match(src,/^\/api\/admin\/live\/stream\?t=\d+&connection=1$/);
  assert.equal(f.previews.at(-1).active,true);assert.equal(f.previews.at(-1).ready,false);f.load();assert.equal(f.previews.at(-1).ready,true);
  f.ui.render();assert.equal(f.get('roiLive').classList.contains('rotated'),true);f.get('cameraRotation').value='0';f.ui.render();assert.equal(f.get('roiLive').classList.contains('rotated'),false);
  await f.advance(5000);assert.equal(f.actions().at(-1),'keepalive');
  await f.get('toggleLive').dispatch('click');assert.equal(f.actions().at(-1),'stop');assert.equal(f.calls.at(-1).keepalive,true);
  for(const id of ['roiLive'])assert.equal(f.get(id).attributes.src,undefined);
  assert.deepEqual(f.previews.at(-1),{active:false,ready:false});assert.equal(f.timers.size,0);assert.ok(f.calls.every(c=>c.path==='live'));
});

test('Cambiar visibilidad y foco entre pantallas no apaga ni recarga un stream sano',async()=>{
  const f=setup();f.ui.enable();await f.get('toggleLive').dispatch('click');f.load();const src=f.get('roiLive').attributes.src;
  f.doc.hidden=true;await f.handlers.visibilitychange();await f.advance(5000);
  assert.equal(f.actions().includes('stop'),false);assert.equal(f.get('roiLive').attributes.src,src);
  f.doc.hidden=false;await f.handlers.visibilitychange();await f.settle();await f.pageHandlers.focus();await f.settle();
  assert.equal(f.actions().filter(a=>a==='start').length,1);assert.equal(f.actions().includes('stop'),false);
  assert.equal(f.get('roiLive').attributes.src,src);assert.equal(f.get('toggleLive').textContent,'Detener video');
  f.ui.disable();
});

test('El MJPEG aparece también en navegadores que no emiten load hasta que termina la transmisión',async()=>{
  const f=setup();f.ui.enable();await f.get('toggleLive').dispatch('click');
  f.get('roiLive').naturalWidth=320;
  await f.advance(250);assert.equal(f.get('roiLive').hidden,false);assert.equal(f.previews.at(-1).ready,true);
  await f.get('toggleLive').dispatch('click');assert.equal(f.timers.size,0);
});

test('Un error transitorio reconecta automáticamente el visor de la zona de análisis con la autorización existente',async()=>{
  const f=setup();f.ui.enable();await f.get('toggleLive').dispatch('click');f.load();const old=f.get('roiLive').attributes.src;
  f.get('roiLive').dispatch('error');assert.equal(f.previews.at(-1).ready,false);assert.match(f.get('liveStatus').textContent,/Reconectando/);
  await f.advance(1000);assert.equal(f.actions().at(-1),'keepalive');assert.notEqual(f.get('roiLive').attributes.src,old);
  assert.equal(f.actions().filter(a=>a==='start').length,1);f.load();assert.equal(f.previews.at(-1).ready,true);f.ui.disable();
});

test('Una autorización vencida en segundo plano se recupera al volver, respetando los cinco minutos originales',async()=>{
  let expired=false;const f=setup(async(_path,options,data)=>!options.method&&expired?{active:false,owned:false}:data);
  f.ui.enable();await f.get('toggleLive').dispatch('click');f.load();const original=f.get('roiLive').attributes.src;f.doc.hidden=true;await f.handlers.visibilitychange();
  f.timers.clear();f.jump(20000);expired=true;f.doc.hidden=false;await f.handlers.visibilitychange();await f.settle();
  assert.deepEqual(f.actions(),['start','start']);assert.equal(f.get('toggleLive').textContent,'Detener video');assert.notEqual(f.get('roiLive').attributes.src,original);
  f.jump(280001);await f.pageHandlers.focus();await f.settle();assert.equal(f.actions().at(-1),'stop');assert.equal(f.actions().filter(a=>a==='start').length,2);assert.equal(f.get('toggleLive').textContent,'Iniciar video');
});

test('Recuperar no roba otra sesión ni vuelve a iniciar después del cierre de sesión',async()=>{
  let other=false;const f=setup(async(_path,options,data)=>!options.method&&other?{active:true,owned:false}:data);
  f.ui.enable();await f.get('toggleLive').dispatch('click');other=true;await f.pageHandlers.focus();await f.settle();
  assert.equal(f.get('toggleLive').textContent,'Iniciar video');assert.equal(f.get('toggleLive').disabled,false);assert.equal(f.actions().includes('stop'),false);
  other=false;await f.get('toggleLive').dispatch('click');f.auth(false);f.ui.disable();await f.pageHandlers.focus();await f.advance(10000);
  assert.equal(f.get('toggleLive').disabled,true);assert.equal(f.get('roiLive').attributes.src,undefined);assert.equal(f.actions().filter(a=>a==='start').length,2);
});

test('Ocultar la ventana mientras inicia no cancela el video; cerrar la página sí lo detiene',async()=>{
  let resolve;const f=setup(async(_path,options,data)=>options.body&&JSON.parse(options.body).action==='start'?new Promise(r=>{resolve=()=>r(data);}):data);
  f.ui.enable();const starting=f.get('toggleLive').dispatch('click');f.doc.hidden=true;await f.handlers.visibilitychange();resolve();await starting;
  assert.deepEqual(f.actions(),['start']);assert.ok(f.get('roiLive').attributes.src);
  await f.pageHandlers.pagehide();await f.settle();assert.equal(f.actions().at(-1),'stop');assert.equal(f.get('roiLive').attributes.src,undefined);
});
