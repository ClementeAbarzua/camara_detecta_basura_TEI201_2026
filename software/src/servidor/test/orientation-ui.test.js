import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import {DEFAULT_ROI,roiBounds} from '../public/roi-geometry.js';
import {decisionProgress} from '../public/decision-progress.js';
import {createLiveDecision} from '../public/dashboard-live.js';
import {createDecisionTrends} from '../public/decision-trends.js';

// Superficie DOM pequena para ejecutar los eventos reales del monitor sin navegador.
class Element {
  constructor() {
    this.hidden = false; this.disabled = false; this.style = {}; this.attributes = {}; this.children = [];
    this.textContent = '';this.dataset={}; const classes = new Set();
    this.classList = { toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); }, contains: name => classes.has(name) };
  }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(name, value) { this.attributes[name] = value; }
  getAttribute(name) { return this.attributes[name] ?? null; }
  addEventListener() {}
}
const settle = () => new Promise(resolve => setImmediate(resolve));
const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data });

test('El monitor publico muestra la orientacion fija y la confianza, sin controles aunque conserve una sesion anterior',async()=>{
  const elements=new Map();const get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
  const document={getElementById:get,createElement:()=>new Element(),body:new Element(),hidden:false,addEventListener(){}};
  const timers=new Map();let timerId=0;
  let camera={rotation:180,version:'1'};
  let reading={receivedAt:Date.now(),rotation:180,orientationVersion:'1',scores:[.05,.45,.4,.1],preview:'rotated',conclusion:'Hay basura',trashNow:.95,trashAverage:.95,readings:5,streak:3,threshold:.8,analysisMs:100};
  const requests=[];
  const fetch=async(url,options={})=>{
    requests.push({url,method:options.method??'GET'});
    if(url==='/api/state')return response({state:{...reading},camera:{...camera},canManageCamera:true,staleMs:90000}); // Cliente antiguo no debe activar controles.
    if(url.startsWith('/api/history'))return response({entries:[],nextCursor:null});
    if(url.startsWith('/api/decision-trends'))return response({now:Date.now(),bins:[],events:[],totals:{total:0,trash:0,clear:0,unsure:0}});
    throw Error('Ruta inesperada: '+url);
  };
  const context=vm.createContext({DEFAULT_ROI,roiBounds,decisionProgress,createLiveDecision,createDecisionTrends,document,fetch,AbortController,AbortSignal,URL,URLSearchParams,Blob,
    setTimeout:fn=>{const id=++timerId;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),setInterval(){},createCharts:()=>({start(){},stop(){}})});
  const source=(await readFile(new URL('../public/app.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
  const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  assert.doesNotMatch(html,/id="rotateCamera"|id="logout"|type="password"|exportJSON|exportHistory/);
  vm.runInContext(source,context);await settle();
  assert.equal(get('total').textContent,'95.0 %');assert.equal(get('confidenceBar').hidden,false);
  assert.equal(get('photo').classList.contains('upsideDown'),false);
  assert.match(get('orientationStatus').textContent,/Orientación:.*180/);
  reading={...reading,conclusion:'Sin basura',trashNow:.02,trashAverage:.1,scores:[.98,.01,.005,.005]};
  await vm.runInContext('poll()',context);assert.equal(get('total').textContent,'90.0 %');assert.equal(get('trashAverage').textContent,'10.0 %');
  reading={...reading,conclusion:'No seguro',trashAverage:.238,streak:0};
  await vm.runInContext('poll()',context);assert.equal(get('total').textContent,'—');assert.equal(get('confidenceBar').hidden,true);assert.match(get('detail').textContent,/evidencia es ambigua/);
  reading={...reading,rotation:0,orientationVersion:'0',preview:'legacy'};
  await vm.runInContext('poll()',context);assert.equal(get('photo').classList.contains('upsideDown'),true);assert.equal(get('conclusion').textContent,'Esperando nueva captura');
  reading={...reading,rotation:180,orientationVersion:'1',preview:'corrected'};
  await vm.runInContext('poll()',context);assert.equal(get('photo').classList.contains('upsideDown'),false);
  reading={...reading,receivedAt:Date.now()-100000};await vm.runInContext('poll()',context);
  assert.equal(get('conclusion').textContent,'Sin datos recientes');assert.equal(get('total').textContent,'—');
  assert.ok(requests.every(request=>request.method==='GET'));
  assert.ok(!requests.some(request=>/camera-settings|login|logout/.test(request.url)));
});

test('Avisos en vivo: refrescan al guardar, reconcilian un aviso durante una consulta y usan respaldo al desconectarse',async()=>{
  const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
  const listeners={},timers=new Map();let timerId=0,stateRequests=0,release;
  const callbacks={};
  const document={getElementById:get,createElement:()=>new Element(),hidden:false,addEventListener(name,fn){(callbacks[name]??=[]).push(fn);listeners[name]=()=>callbacks[name].forEach(callback=>callback());}};
  const chartCalls=[];const charts={start(){},setPolicy(p){chartCalls.push(['policy',p.windowSize,p.confirmationsRequired]);},setRealtime(v){chartCalls.push(['live',v]);},notify(){chartCalls.push(['notify']);}};
  class Events {
    static instances=[];
    constructor(url){this.url=url;this.handlers={};Events.instances.push(this);}
    addEventListener(name,fn){this.handlers[name]=fn;}
    close(){this.closed=true;}
    emit(name){this.handlers[name]?.();}
  }
  const reading={receivedAt:Date.now(),rotation:180,orientationVersion:'0',scores:[.05,.45,.4,.1],preview:'jpeg',conclusion:'Hay basura',trashNow:.95,trashAverage:.95,readings:3,streak:2,windowSize:3,confirmationsRequired:2,threshold:.8,analysisMs:50};
  const state=()=>response({camera:{rotation:180,version:'0'},state:reading,staleMs:90000,decision:{profile:'demo',windowSize:3,confirmationsRequired:2}});
  const fetch=async url=>{
    if(url==='/api/state'){stateRequests++;if(stateRequests===1)return new Promise(resolve=>{release=()=>resolve(state());});return state();}
    if(url.startsWith('/api/decision-trends'))return response({now:Date.now(),bins:[],events:[],totals:{total:0,trash:0,clear:0,unsure:0}});
    return response({entries:[],nextCursor:null});
  };
  const context=vm.createContext({DEFAULT_ROI,roiBounds,decisionProgress,createLiveDecision,createDecisionTrends,document,fetch,EventSource:Events,AbortSignal,URLSearchParams,createCharts:()=>charts,
    setTimeout(fn,ms){const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),setInterval(){}});
  const source=(await readFile(new URL('../public/app.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
  vm.runInContext(source,context);assert.equal(stateRequests,1);
  const events=Events.instances[0];assert.equal(events.url,'/api/events');events.emit('ready');
  assert.equal(stateRequests,1);release();await settle();
  const queued=[...timers].find(([,t])=>t.ms===0);assert.ok(queued);timers.delete(queued[0]);queued[1].fn();await settle();
  assert.equal(stateRequests,2);assert.ok(![...timers.values()].some(t=>t.ms===2000));
  assert.equal(get('captureCount').textContent,'3 / 3');assert.equal(get('confirmationCount').textContent,'2 / 2');assert.match(get('decisionRules').textContent,/3 capturas.*2 evaluaciones/);
  events.emit('measurement');await settle();assert.equal(stateRequests,3);
  events.onerror();await settle();assert.ok([...timers.values()].some(t=>t.ms===2000));
  assert.ok(chartCalls.some(c=>c[0]==='notify'));assert.ok(chartCalls.some(c=>c[0]==='live'&&c[1]===false));
  document.hidden=true;listeners.visibilitychange();assert.equal(events.closed,true);assert.equal(timers.size,0);
  const before=stateRequests;events.emit('measurement');await settle();assert.equal(stateRequests,before);
  document.hidden=false;listeners.visibilitychange();await settle();assert.equal(Events.instances.length,2);
});
