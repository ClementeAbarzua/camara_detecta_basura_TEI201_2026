import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resizeDayWindow,localDayBounds} from '../public/chart-data.js';
import {createDayOverview} from '../public/chart-overview.js';
import {createCharts} from '../public/charts.js';

const MIN=60000,HOUR=60*MIN;
const tick=()=>new Promise(resolve=>setImmediate(resolve));
class Element {
  constructor(){this.children=[];this.attributes={};this.style={};this.dataset={};this.textContent='';this.clientWidth=800;this.scrollLeft=0;this.classList={toggle(){}};}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=[...nodes];}
  setAttribute(key,value){this.attributes[key]=String(value);}
  getAttribute(key){return this.attributes[key]??null;}
  get firstElementChild(){return this.children[0];}
  get options(){return this.children;}
  get scrollWidth(){return parseFloat(this.firstElementChild?.style.width)||this.clientWidth;}
  getBoundingClientRect(){return {left:100,top:0,width:800,height:78};}
  setPointerCapture(id){this.pointer=id;}
  hasPointerCapture(id){return this.pointer===id;}
  releasePointerCapture(id){delete this.pointer;this.onlostpointercapture?.({pointerId:id});}
  focus(){}
}
function dom(t){
  const ids=new Map(),listeners={},cleanups=[],get=id=>{if(!ids.has(id))ids.set(id,new Element());return ids.get(id);};
  const presets=[5,15,60,1440].map(value=>{const e=new Element();e.dataset.chartMinutes=String(value);return e;});
  const scrollers=[new Element(),new Element()];for(const e of scrollers)e.append(new Element());
  const previous={document:globalThis.document,window:globalThis.window,fetch:globalThis.fetch};
  globalThis.document={hidden:false,getElementById:get,createElementNS:()=>new Element(),createElement:()=>new Element(),
    querySelectorAll:selector=>selector==='[data-chart-minutes]'?presets:selector==='.historyScroller'?scrollers:[],
    addEventListener:(name,fn)=>(listeners[name]??=[]).push(fn)};
  globalThis.window={addEventListener(){}};
  t.after(()=>{for(const cleanup of cleanups.reverse())cleanup();for(const [key,value]of Object.entries(previous))if(value===undefined)delete globalThis[key];else globalThis[key]=value;});
  return {get,presets,scrollers,listeners,cleanups};
}
const event=values=>({button:0,pointerId:7,clientX:0,preventDefault(){},stopPropagation(){},...values});
const find=(svg,edge)=>svg.children.find(e=>e.getAttribute('data-resize-edge')===edge);
const marks=svg=>svg.children.filter(e=>e.getAttribute('class')==='coverageMark');

test('Los extremos conservan el opuesto, admiten intervalos libres y respetan un minuto y los días de 23/25 horas',()=>{
  const previous=process.env.TZ;process.env.TZ='America/Santiago';
  try{
    for(const key of ['2026-11-21','2026-09-06','2026-04-04']){
      const day=localDayBounds(key),view={from:day.from+10*HOUR,to:day.from+11*HOUR};
      assert.deepEqual(resizeDayWindow(day,view,'start',day.from+8*HOUR+1234),{from:day.from+8*HOUR+1234,to:view.to});
      assert.deepEqual(resizeDayWindow(day,view,'end',day.to+HOUR),{from:view.from,to:day.to});
      assert.deepEqual(resizeDayWindow(day,view,'start',day.from-HOUR),{from:day.from,to:view.to});
      assert.deepEqual(resizeDayWindow(day,view,'start',day.to),{from:view.to-MIN,to:view.to});
      assert.deepEqual(resizeDayWindow(day,view,'end',day.from),{from:view.from,to:view.from+MIN});
      assert.deepEqual(resizeDayWindow(day,day,'end',day.from),{from:day.from,to:day.from+MIN});
    }
  }finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
  assert.throws(()=>resizeDayWindow({from:0,to:HOUR},{from:0,to:MIN},'other',0));
  assert.throws(()=>resizeDayWindow({from:0,to:HOUR},{from:0,to:MIN},'start',NaN));
});

test('Mapa real: ratón/tacto, agarres separados, captura del puntero y clic posterior no cambian la selección accidentalmente',async t=>{
  const {get,cleanups}=dom(t),day=localDayBounds('2026-11-20');let view={from:day.from+12*HOUR,to:day.from+12*HOUR+5*MIN};
  const calls=[],jumps=[],coverage={bins:[{index:720,firstAt:day.from+12*HOUR,lastAt:day.from+12*HOUR+MIN,count:2}],cursor:'2',total:2,firstAt:day.from+12*HOUR,lastAt:day.from+12*HOUR+MIN};
  globalThis.fetch=async()=>({ok:true,json:async()=>coverage});
  const overview=createDayOverview({getDay:()=>day,getView:()=>view,getNow:()=>day.to,onJump:stamp=>jumps.push(stamp),onFit(){},onLastAvailable(){},
    onResize:(next,options)=>{view=next;calls.push(options);overview.render();}});
  cleanups.push(()=>overview.stop());overview.start();await tick();
  const svg=get('coverageChart'),left=find(svg,'start'),right=find(svg,'end'),initialEnd=view.to;
  assert.equal(left.children[0].getAttribute('x'),'-24');assert.equal(right.children[0].getAttribute('x'),'0');
  const x=stamp=>100+24+(stamp-day.from)/(day.to-day.from)*752;
  left.onpointerdown(event({clientX:x(view.from)-8,pointerType:'touch'}));
  svg.onpointermove(event({clientX:x(view.from)-8-752/24}));
  assert.equal(view.from,day.from+11*HOUR);assert.equal(view.to,initialEnd);assert.equal(svg.pointer,7);
  // Una llegada de datos puede reemplazar los agarres; la captura pertenece al SVG estable.
  overview.accept([{id:'3',receivedAt:day.from+13*HOUR}]);assert.equal(marks(svg).length,2);
  assert.notEqual(find(svg,'start'),left);assert.equal(svg.pointer,7);
  svg.onpointermove(event({pointerId:99,clientX:0}));assert.equal(view.from,day.from+11*HOUR);
  svg.onpointerup(event());assert.equal(calls.filter(c=>c.commit).length,1);assert.equal(svg.pointer,undefined);
  svg.onclick(event({clientX:x(day.from+12*HOUR)}));assert.equal(jumps.length,0);
  svg.onpointerdown(event());svg.onclick(event({clientX:x(day.from+12*HOUR)}));assert.equal(jumps.length,1);
  const endHandle=find(svg,'end');endHandle.onpointerdown(event({clientX:x(view.to)+5}));
  svg.onpointermove(event({clientX:x(day.to)+100}));assert.equal(view.to,day.to);
  svg.onpointercancel(event());assert.equal(calls.filter(c=>c.commit).length,2);
  assert.equal(endHandle.getAttribute('aria-valuetext'),'Final: 24:00');
  const before=view.from;find(svg,'start').onkeydown(event({key:'ArrowLeft',shiftKey:true}));
  assert.equal(view.from,before-15*MIN);assert.equal(view.to,day.to);
  assert.equal(calls.filter(c=>c.commit).length,3);
});

test('Controlador real: ambos gráficos y barras cambian juntos; consulta una vez al soltar, conserva mapa y reutiliza el día',async t=>{
  const {get,presets,scrollers,cleanups}=dom(t),now=new Date(2026,10,21,12).getTime(),day=localDayBounds('2026-11-21');
  t.mock.method(Date,'now',()=>now);
  const rows=Array.from({length:121},(_,i)=>({id:String(i+1),receivedAt:now-(120-i)*MIN,trashAverage:.9,trashNow:.9,threshold:.8,readings:3,streak:2,conclusion:'Hay basura'}));
  const requests=[];
  globalThis.fetch=async url=>{
    requests.push(url);const params=new URL(url,'https://test.local').searchParams;
    if(url.startsWith('/api/chart-coverage'))return {ok:true,json:async()=>({bins:rows.map(r=>({index:Math.floor((r.receivedAt-day.from)/MIN),firstAt:r.receivedAt,lastAt:r.receivedAt,count:1})),cursor:'121',total:121,firstAt:rows[0].receivedAt,lastAt:now})};
    const from=Number(params.get('from')??now-5*MIN),to=Number(params.get('to')??now);
    return {ok:true,json:async()=>({from,to,now,staleMs:90000,entries:rows.filter(r=>r.receivedAt>=from&&r.receivedAt<=to),context:null,cursor:'121',truncated:false,earliestAt:rows[0].receivedAt,latestAt:now})};
  };
  const charts=createCharts();cleanups.push(()=>charts.stop());charts.setRealtime(true);charts.start();await tick();
  const svg=get('coverageChart'),count=()=>requests.filter(u=>u.startsWith('/api/chart-history')).length;
  const x=stamp=>100+24+(stamp-day.from)/(day.to-day.from)*752;
  assert.equal(count(),1);const originalMarks=marks(svg).length,start=now-5*MIN;
  find(svg,'start').onpointerdown(event({clientX:x(start)-5}));
  for(const delta of [60,2,60])svg.onpointermove(event({clientX:x(start)-5-delta/60*752/24}));
  assert.equal(count(),1);assert.equal(marks(svg).length,originalMarks);
  assert.match(get('chartRange').textContent,/10:55.*12:00.*65 min/);
  assert.match(get('chartStatus').textContent,/Ajustando/);
  const axis=id=>get(id).children.filter(e=>e.getAttribute('y')==='246').map(e=>e.textContent);
  assert.deepEqual(axis('decisionChart'),axis('detectionChart'));
  assert.equal(scrollers[0].firstElementChild.style.width,scrollers[1].firstElementChild.style.width);
  assert.equal(scrollers[0].scrollLeft,scrollers[1].scrollLeft);
  svg.onpointerup(event());await tick();assert.equal(count(),2);assert.match(get('chartStatus').textContent,/66 mediciones/);
  assert.ok(presets.every(b=>b.getAttribute('aria-pressed')==='false'));
  // Consultar el día una vez permite redimensionar usando la copia local.
  presets[3].onclick();await new Promise(resolve=>setTimeout(resolve,210));await tick();
  assert.equal(count(),3);assert.equal(presets[3].getAttribute('aria-pressed'),'true');
  const before=count();
  find(svg,'end').onpointerdown(event({clientX:x(day.to)+5}));
  svg.onpointermove(event({clientX:x(day.from+11*HOUR)+5}));svg.onpointerup(event());await tick();
  assert.equal(count(),before);assert.match(get('chartRange').textContent,/00:00.*11:00.*660 min/);
  assert.equal(presets[3].getAttribute('aria-pressed'),'false');
  find(svg,'end').onkeydown(event({key:'ArrowRight'}));await tick();assert.equal(count(),before);
  assert.match(get('chartRange').textContent,/11:01.*661 min/);
  get('liveCharts').onclick();await tick();assert.equal(count(),before+1);
  assert.equal(get('liveCharts').getAttribute('aria-pressed'),'true');assert.equal(presets[0].getAttribute('aria-pressed'),'true');
});
