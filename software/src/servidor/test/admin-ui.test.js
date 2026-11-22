import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {DEFAULT_ROI,sameRoi} from '../public/roi-geometry.js';
import {createRoiEditor} from '../public/roi-editor.js';
import {createAdminLive} from '../public/admin-live.js';
import {createAdminTools} from '../public/admin-tools.js';

class Element {
  constructor(){this.hidden=false;this.disabled=false;this.value='';this.textContent='';this.attributes={};this.listeners={};this.style={};const names=new Set();this.classList={toggle(n,on){if(on)names.add(n);else names.delete(n);},contains:n=>names.has(n)};}
  addEventListener(name,fn){this.listeners[name]=fn;}
  setAttribute(name,value){this.attributes[name]=value;}
  set src(value){this.attributes.src=value;}
  get src(){return this.attributes.src;}
  getBoundingClientRect(){return {left:0,top:0,width:400,height:300};}
  setPointerCapture(){}
  removeAttribute(name){delete this.attributes[name];}
  getAttribute(name){return this.attributes[name]??null;}
  dispatch(name){return this.listeners[name]?.({preventDefault(){}});}
}
const response=(data,status=200)=>({ok:status<300,status,json:async()=>data});
test('Panel: entrar, previsualizar sin guardar, guardar con CSRF, conflicto y cierre de sesion',async(t)=>{
  const elements=new Map(),get=id=>{assert.ok(!['livePhoto','liveEmpty'].includes(id),'El visor superior fue eliminado');if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
  get('cameraRotation').value='180';get('thresholdPercent').value=get('thresholdSlider').value='80';
  let current={rotation:180,threshold:.8,version:'0',roi:{...DEFAULT_ROI}},conflict=false,expired=false;const calls=[];
  const decision={profile:'demo',windowSize:3,confirmationsRequired:2};
  const fetch=async(path,options={})=>{
    calls.push({path,...options});
    if(path==='/api/admin/operations'){
      if(options.method==='PUT'){const data=JSON.parse(options.body);assert.equal(options.headers['X-CSRF-Token'],'c'.repeat(64));assert.equal(data.expectedVersion,current.version);current={...current,paused:data.paused,version:String(BigInt(current.version)+1n)};}
      return response({camera:{...current},device:null});
    }
    if(path==='/api/state')return response({state:{rotation:180,preview:'test-jpeg',receivedAt:Date.now()}});
    if(path==='/api/admin/live')return response({active:true,owned:true,stopAt:Date.now()+300000,frameAt:Date.now(),device:{protocol:3,online:true},fps:12});
    if(path==='/api/admin/session')return response({authenticated:false,configured:true});
    if(path==='/api/admin/login'){assert.equal(JSON.parse(options.body).password,'test-ui-password');return response({authenticated:true,csrfToken:'c'.repeat(64)});}
    if(path==='/api/admin/logout')return response({authenticated:false});
    if(path==='/api/admin/settings'){
      if(expired)return response({error:'Inicia sesión como administrador.'},401);
      if(options.method==='PUT'){
        if(conflict)return response({error:'Los ajustes cambiaron en otra pestaña. Recarga los valores antes de guardar.'},409);
        const data=JSON.parse(options.body);assert.equal(options.headers['X-CSRF-Token'],'c'.repeat(64));assert.equal(data.expectedVersion,current.version);
        current={rotation:data.rotation,threshold:data.threshold,version:String(BigInt(current.version)+1n),roi:data.roi};
      }
      return response({camera:{...current},decision,message:'Ajustes guardados.'});
    }
    throw Error('Ruta inesperada: '+path);
  };
  const document={hidden:false,getElementById:get,addEventListener(){}};
  const context=vm.createContext({document,fetch,DEFAULT_ROI,sameRoi,createRoiEditor,createAdminLive,createAdminTools:options=>{const tools=createAdminTools(options);t.after(()=>tools.stop());return tools;},AbortSignal,setTimeout(){return 1;},clearTimeout(){}});
  vm.runInContext((await readFile(new URL('../public/admin.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,''),context);
  await new Promise(resolve=>setImmediate(resolve));assert.equal(get('loginPanel').hidden,false);assert.equal(get('adminPanel').hidden,true);
  get('adminPassword').value='test-ui-password';await get('loginForm').dispatch('submit');await new Promise(resolve=>setImmediate(resolve));
  assert.equal(get('adminPassword').value,'');assert.equal(get('adminPanel').hidden,false);assert.equal(get('saveSettings').disabled,true);
  get('cameraRotation').value='0';await get('cameraRotation').dispatch('change');
  get('thresholdSlider').value='90';await get('thresholdSlider').dispatch('input');
  assert.equal(get('adminPhoto').classList.contains('rotated'),true);assert.equal(get('clearLimit').textContent,'10 %');assert.equal(get('thresholdPercent').value,'90');
  assert.ok(!calls.some(c=>c.method==='PUT'));assert.equal(get('saveSettings').disabled,false);
  get('thresholdPercent').value='59';await get('thresholdPercent').dispatch('input');assert.equal(get('saveSettings').disabled,true);
  get('thresholdPercent').value='90';await get('thresholdPercent').dispatch('input');await get('settingsForm').dispatch('submit');
  assert.deepEqual(current,{rotation:0,threshold:.9,version:'1',roi:{...DEFAULT_ROI}});assert.equal(get('saveSettings').disabled,true);
  get('roiSize').value='60';await get('roiSize').dispatch('input');assert.equal(get('saveSettings').disabled,false);assert.equal(current.roi.size,1);
  await get('settingsForm').dispatch('submit');assert.equal(current.roi.size,.6);assert.equal(current.version,'2');assert.equal(get('saveSettings').disabled,true);
  get('thresholdPercent').value='70';await get('thresholdPercent').dispatch('input');
  await get('pauseCaptures').dispatch('click');assert.equal(current.paused,true);assert.equal(get('pauseCaptures').textContent,'Reanudar capturas y análisis');assert.equal(get('thresholdPercent').value,'70');assert.equal(get('saveSettings').disabled,false);
  assert.equal(get('exportDatabaseJSON').getAttribute('href'),'/api/admin/export?format=json');
  get('exportScope').value='dates';await get('exportScope').dispatch('change');assert.equal(get('exportDatabaseJSON').getAttribute('href'),null);
  get('exportFrom').value='2026-01-01';get('exportTo').value='2026-01-02';await get('exportTo').dispatch('change');
  const download=new URL(get('exportMeasurementsCSV').getAttribute('href'),'http://test');assert.equal(download.searchParams.get('format'),'csv');assert.equal(Number(download.searchParams.get('from')),new Date('2026-01-01T00:00:00').getTime());assert.equal(Number(download.searchParams.get('to')),new Date('2026-01-03T00:00:00').getTime());
  get('exportFrom').value='2026-01-03';await get('exportFrom').dispatch('change');assert.equal(get('exportMeasurementsCSV').getAttribute('href'),null);
  // El video bajo el recuadro conserva el borrador y no vuelve a la foto al consultar estado.
  await get('toggleLive').dispatch('click');get('roiLive').dispatch('load');
  assert.equal(get('adminPhoto').hidden,true);assert.equal(get('roiLive').hidden,false);assert.equal(get('roiBox').hidden,false);
  const stream=get('roiLive').src;assert.match(stream,/^\/api\/admin\/live\/stream/);
  get('cameraRotation').value='180';await get('cameraRotation').dispatch('change');
  assert.equal(get('roiLive').classList.contains('rotated'),true);
  get('roiSize').value='50';await get('roiSize').dispatch('input');const region={...get('roiBox').style};
  await vm.runInContext('preview()',context);
  assert.equal(get('adminPhoto').hidden,true);assert.equal(get('roiLive').src,stream);assert.equal(get('roiLive').hidden,false);
  assert.deepEqual(get('roiBox').style,region);assert.equal(get('roiSize').value,'50');assert.equal(get('thresholdPercent').value,'70');
  await get('toggleLive').dispatch('click');assert.equal(get('roiLive').src,undefined);assert.equal(get('roiLive').hidden,true);
  assert.equal(get('adminPhoto').hidden,false);assert.match(get('previewStatus').textContent,/captura del/);assert.equal(get('roiSize').value,'50');
  get('cameraRotation').value='0';await get('cameraRotation').dispatch('change');
  conflict=true;await get('settingsForm').dispatch('submit');
  assert.equal(get('thresholdPercent').value,'70');assert.match(get('adminError').textContent,/otra pestaña/);
  await get('reloadSettings').dispatch('click');assert.equal(get('thresholdPercent').value,'90');
  expired=true;await get('reloadSettings').dispatch('click');assert.equal(get('adminPanel').hidden,true);assert.equal(get('loginPanel').hidden,false);
  expired=false;get('adminPassword').value='test-ui-password';await get('loginForm').dispatch('submit');await get('logoutButton').dispatch('click');
  assert.equal(get('adminPanel').hidden,true);assert.equal(get('exportDatabaseJSON').getAttribute('href'),null);assert.equal(get('pauseCaptures').disabled,true);assert.equal(calls.at(-1).path,'/api/admin/logout');
  assert.equal(calls.at(-1).headers['X-CSRF-Token'],'c'.repeat(64));
});
