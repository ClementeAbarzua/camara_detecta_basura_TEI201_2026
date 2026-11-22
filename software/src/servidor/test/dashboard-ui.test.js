import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLiveDecision} from '../public/dashboard-live.js';
import {createDecisionTrends} from '../public/decision-trends.js';
import {localDayKey} from '../public/chart-data.js';
class Element{
  constructor(){this.hidden=false;this.disabled=false;this.textContent='';this.attributes={};this.dataset={};this.style={};this.children=[];this.handlers={};}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  setAttribute(name,value){this.attributes[name]=value;}
  addEventListener(name,callback){this.handlers[name]=callback;}
  dispatch(name){return this.handlers[name]?.();}
}
function dom(){const elements=new Map(),listeners={};const get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};return{get,document:{hidden:false,createElement:()=>new Element(),addEventListener(name,fn){(listeners[name]??=[]).push(fn);}},listeners};}
const settle=()=>new Promise(r=>setImmediate(r));
test('Alertas de la pantalla: color por estado, sonido solo por elección y una vez por confirmación nueva',async()=>{
  const f=dom(),timers=new Map();let count=0,created=0,next=0;
  class Audio{constructor(){created++;this.state='suspended';this.currentTime=0;}async resume(){this.state='running';}createOscillator(){return{frequency:{},connect(){},start(){count++;},stop(){}};}createGain(){return{gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}};}}
  const live=createLiveDecision({...f,Audio,schedule:fn=>{timers.set(++next,fn);return next;},cancel:id=>timers.delete(id)});
  const render=(stamp,conclusion,extra={})=>live.render({state:{receivedAt:stamp,conclusion},fresh:true,...extra});
  f.get('decisionToast').hidden=true;render(1000,'Hay basura');assert.equal(f.get('decisionToast').hidden,true);assert.equal(created,0);assert.equal(count,0);assert.equal(f.get('result').attributes['data-state'],'trash');
  await f.get('toggleAlertSound').dispatch('click');assert.equal(created,1);assert.equal(f.get('toggleAlertSound').attributes['aria-pressed'],'true');
  render(2000,'No seguro');assert.equal(count,0);assert.equal(f.get('result').attributes['data-state'],'unsure');
  render(3000,'Sin basura');assert.equal(count,1);assert.equal(f.get('decisionToast').hidden,false);assert.match(f.get('decisionToastText').textContent,/Sin basura/);
  render(3000,'Sin basura');render(4000,'Sin basura');assert.equal(count,1);
  render(5000,'Hay basura');assert.equal(count,3);assert.equal(f.get('result').attributes['data-state'],'trash');
  render(5000,'Hay basura',{fresh:false});assert.equal(count,3);assert.equal(f.get('result').attributes['data-state'],'offline');
  await f.get('toggleAlertSound').dispatch('click');render(6000,'Sin basura');assert.equal(count,3);
  f.get('closeDecisionToast').dispatch('click');assert.equal(f.get('decisionToast').hidden,true);assert.equal(timers.size,0);
});

test('Tendencias de la pantalla: categorías exactas, horas vacías/futuras y salto a una hora con datos',async()=>{
  const f=dom(),clock=Date.UTC(2026,10,22,12,30),calls=[],explored=[],timers=new Map();let next=0;
  const request=async(url)=>{calls.push(url);return{ok:true,json:async()=>({now:clock,totals:{total:4,trash:2,clear:1,unsure:1},bins:[{index:1,total:4,trash:2,clear:1,unsure:1}],events:[{receivedAt:clock-1000,conclusion:'Hay basura',confidence:.9}]})};};
  const trends=createDecisionTrends({...f,request,now:()=>clock,onExplore:r=>explored.push(r),schedule:fn=>{timers.set(++next,fn);return next;},cancel:id=>timers.delete(id)});
  trends.start();await settle();assert.equal(f.get('trendTrash').textContent,'50.0 %');assert.equal(f.get('trendClear').textContent,'25.0 %');assert.equal(f.get('trendUnsure').textContent,'25.0 %');
  const tiles=f.get('hourlyTrends').children;assert.equal(tiles.length,24);assert.equal(tiles[0].disabled,true);assert.equal(tiles[1].disabled,false);assert.equal(tiles.at(-1).disabled,true);
  assert.match(tiles[0].attributes['aria-label'],/Sin mediciones/);assert.match(tiles.at(-1).attributes['aria-label'],/Hora futura/);
  tiles[1].dispatch('click');assert.equal(explored.length,1);assert.equal(explored[0].to-explored[0].from,3600000);
  assert.match(f.get('trendEvents').children[0].children[1].textContent,/Hay basura/);
  trends.notify();assert.equal(calls.length,1);assert.equal(timers.size,1);trends.stop();assert.equal(timers.size,0);
});

test('Cambiar la fecha no muestra una respuesta atrasada bajo el día nuevo ni interpreta ausencia como cero basura',async()=>{
  const f=dom(),clock=Date.UTC(2026,10,22,12),timers=new Map();let release,calls=0,id=0;
  const request=async()=>{calls++;if(calls===1)return new Promise(r=>{release=r;});return{ok:true,json:async()=>({now:clock,bins:[],events:[],totals:{total:0,trash:0,clear:0,unsure:0}})};};
  const trends=createDecisionTrends({...f,request,now:()=>clock,schedule:fn=>{timers.set(++id,fn);return id;},cancel:i=>timers.delete(i)});
  trends.start();await settle();trends.selectDay(localDayKey(clock-86400000));await settle();
  assert.equal(f.get('trendTrash').textContent,'—');assert.equal(f.get('trendEmpty').hidden,false);
  release({ok:true,json:async()=>({now:clock,bins:[],events:[],totals:{total:99,trash:99,clear:0,unsure:0}})});await settle();
  assert.equal(f.get('trendTrash').textContent,'—');assert.match(f.get('trendStatus').textContent,/0 mediciones/);
  trends.notify();assert.equal(calls,2);trends.stop();
});
