import { coverageSessions, nearestCoverageTimestamp, extendCoverage, resizeDayWindow } from './chart-data.js';
const NS='http://www.w3.org/2000/svg';
const PAD=24;
const time=stamp=>new Date(stamp).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit',hour12:false});
function svgNode(tag,attrs={},text){const el=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);if(text!==undefined)el.textContent=text;return el;}

// El mapa diario tiene su propia consulta: nunca desaparece al cargar otro tramo.
export function createDayOverview({getDay,getView,getNow,onJump,onFit,onLastAvailable,onResize=()=>{}}) {
  const $=id=>document.getElementById(id),svg=$('coverageChart');
  let active=false,key='',data=null,request=null,timeout,latest=null,error='',width=0,viewport=null,selected=null,groups=[];
  let buffered=new Map(),sessionsKey='',handles=null,drag=null,suppressClick=false;
  function setLatest(stamp){
    if(Number.isFinite(stamp))latest=Math.max(latest ?? 0,stamp);
    $('lastAvailableChart').disabled=latest===null;
    $('lastAvailableChart').textContent=latest===null?'Ver últimos registros':'Últimos registros · '+new Date(latest).toLocaleDateString('es-CL',{day:'2-digit',month:'2-digit'});
  }
  function frame(){
    const day=getDay();width=Math.max(280,svg.getBoundingClientRect().width || 800);
    const x=stamp=>PAD+(stamp-day.from)/(day.to-day.from)*(width-2*PAD);
    return {day,x};
  }
  function drawViewport(){
    if(!viewport)return;
    const {x}=frame(),view=getView();
    viewport.setAttribute('x',x(view.from));viewport.setAttribute('width',Math.max(2,x(view.to)-x(view.from)));
    if(handles)for(const [edge,handle]of Object.entries(handles)){
      const value=edge==='start'?view.from:view.to,day=getDay(),minutes=(value-day.from)/60000;
      handle.setAttribute('transform',`translate(${x(value)},0)`);
      handle.setAttribute('aria-valuenow',minutes.toFixed(2));
      handle.setAttribute('aria-valuemin',edge==='start'?'0':String((view.from-day.from+60000)/60000));
      handle.setAttribute('aria-valuemax',edge==='end'?String((day.to-day.from)/60000):String(Math.max(0,(view.to-day.from-60000)/60000)));
      handle.setAttribute('aria-valuetext',`${edge==='start'?'Inicio':'Final'}: ${value===day.to?'24:00':time(value)}`);
    }
  }
  function timestampAt(event){
    const {day}=frame(),box=svg.getBoundingClientRect();
    const px=(event.clientX-box.left)/box.width*width;
    return day.from+(px-PAD)/(width-2*PAD)*(day.to-day.from);
  }
  function describeSelection(view){
    $('coverageHint').textContent=`Intervalo: ${time(view.from)} — ${view.to===getDay().to?'24:00':time(view.to)}. Suelta el extremo para cargar los datos.`;
  }
  function finishResize(event){
    if(!drag || (event?.pointerId!==undefined && event.pointerId!==drag.id))return;
    const finished=drag;drag=null;suppressClick=true;
    if(svg.hasPointerCapture?.(finished.id))svg.releasePointerCapture(finished.id);
    onResize(finished.view,{commit:true});
    $('coverageHint').textContent='Intervalo ajustado. Arrastra sus extremos para cambiarlo; con el extremo enfocado, las flechas ajustan un minuto (Mayús: 15 minutos).';
  }
  function handle(edge){
    const start=edge==='start';
    const group=svgNode('g',{class:'overviewHandle','data-resize-edge':edge,role:'slider',tabindex:0,
      'aria-label':start?'Inicio del intervalo visible':'Final del intervalo visible','aria-orientation':'horizontal'});
    // Áreas de agarre hacia afuera: no se superponen aunque la ventana sea de 5 minutos.
    group.append(svgNode('rect',{x:start?-24:0,y:8,width:24,height:48,fill:'transparent',class:'overviewHandleHit'}),
      svgNode('rect',{x:start?-10:0,y:13,width:10,height:40,rx:4,class:'overviewHandleTab'}),
      svgNode('path',{d:`M${start?-5:5},25v16`,class:'overviewHandleGrip'}));
    group.append(svgNode('title',{},start?'Arrastra para cambiar la hora de inicio':'Arrastra para cambiar la hora final'));
    group.onpointerdown=event=>{
      if(event.button!==0 || drag)return;
      event.preventDefault();event.stopPropagation();suppressClick=true;
      const view={...getView()};drag={id:event.pointerId,edge,day:{...getDay()},original:view,view,anchor:timestampAt(event)};
      svg.setPointerCapture(event.pointerId);group.focus?.({preventScroll:true});
      onResize(view,{commit:false});describeSelection(view);
    };
    group.onkeydown=event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();event.stopPropagation();
      const day=getDay(),view=getView(),value=start?view.from:view.to,step=event.shiftKey?900000:60000;
      const target=event.key==='Home'?day.from:event.key==='End'?day.to:value+(event.key==='ArrowLeft'?-step:step);
      onResize(resizeDayWindow(day,view,edge,target),{commit:true});
      $('coverageHint').textContent='Intervalo ajustado con el teclado. Mayús + flecha permite avanzar de 15 en 15 minutos.';
    };
    return group;
  }
  function draw(){
    if(!active)return;
    const {day,x}=frame();svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${width} 78`);
    svg.append(svgNode('title',{},'Registros de todo el día. Verde: hay mediciones. Azul: intervalo visible.'));
    svg.append(svgNode('rect',{x:PAD,y:22,width:width-2*PAD,height:22,rx:3,fill:'var(--chart-map)'}));
    if(day.to>getNow())svg.append(svgNode('rect',{x:x(Math.max(day.from,getNow())),y:22,width:Math.max(0,x(day.to)-x(Math.max(day.from,getNow()))),height:22,fill:'var(--chart-future)'}));
    for(const bin of data?.bins ?? []) {
      const mark=svgNode('rect',{x:x(bin.firstAt),y:22,width:Math.max(2,x(Math.min(day.to,day.from+(bin.index+1)*60000))-x(bin.firstAt)),height:22,rx:1,fill:'var(--chart-mark)',class:'coverageMark'});
      mark.append(svgNode('title',{},`${time(bin.firstAt)} — ${time(bin.lastAt)} · ${bin.count} mediciones`));svg.append(mark);
    }
    viewport=svgNode('rect',{y:16,height:34,rx:4,fill:'var(--chart-viewport-fill)',stroke:'var(--chart-viewport)','stroke-width':2,'pointer-events':'none',class:'overviewWindow'});svg.append(viewport);
    handles={start:handle('start'),end:handle('end')};svg.append(handles.start,handles.end);drawViewport();
    const base=new Date(day.from);
    for(const hour of width<450?[0,12,24]:[0,6,12,18,24]){
      const stamp=new Date(base.getFullYear(),base.getMonth(),base.getDate(),hour).getTime();
      svg.append(svgNode('text',{x:x(stamp),y:68,'text-anchor':hour===0?'start':hour===24?'end':'middle',class:'chartAxis'},String(hour).padStart(2,'0')+':00'));
    }
    const has=!!data?.total;
    for(const id of ['firstRecordChart','lastRecordChart','fitRecordsChart'])$(id).disabled=!has;
    $('coverageStatus').textContent=error || (data ? has?`${data.total} mediciones · ${time(data.firstAt)} — ${time(data.lastAt)}`:'Sin mediciones en esta fecha':'Consultando el día…');
    $('coverageStatus').classList.toggle('chartFailure',!!error);
    groups=coverageSessions(data?.bins ?? []);
    const optionsKey=groups.map(g=>g.from).join(',');
    const options=[['','Elige un tramo con datos'],...groups.map(g=>[String(g.from),`${time(g.from)} — ${time(g.to)} · ${g.count} mediciones`])];
    if(optionsKey!==sessionsKey || $('chartSessions').options.length!==options.length){
      $('chartSessions').replaceChildren(...options.map(([value,text])=>{const option=document.createElement('option');option.value=value;option.textContent=text;return option;}));sessionsKey=optionsKey;
    } else options.forEach(([,text],i)=>{$('chartSessions').options[i].textContent=text;});
    $('chartSessions').disabled=!has;
  }
  function accept(rows){
    const day=getDay();
    for(const row of rows)if(row.receivedAt>=day.from && row.receivedAt<day.to && (!data || BigInt(row.id)>BigInt(data.cursor)))buffered.set(row.id,row);
    if(buffered.size>6000)buffered=new Map([...buffered].slice(-6000));
    if(data){const next=extendCoverage(data,rows,day);if(next.cursor!==data.cursor || next.total!==data.total){data=next;setLatest(data.lastAt);draw();}else drawViewport();}
  }
  async function load(force=false){
    if(!active || document.hidden || (request && !force))return;
    const old=request;request=null;old?.abort();clearTimeout(timeout);
    const day=getDay(),expected=key,to=Math.floor(Math.min(day.to,getNow()));
    if(day.from>=to){data={bins:[],cursor:'0',total:0,firstAt:null,lastAt:null};draw();return;}
    const controller=new AbortController();request=controller;timeout=setTimeout(()=>controller.abort(),20000);
    try{
      const params=new URLSearchParams({from:String(day.from),to:String(to)});
      const response=await fetch('/api/chart-coverage?'+params,{cache:'no-store',signal:controller.signal});
      const result=await response.json();
      if(request!==controller || key!==expected || !active)return;
      if(!response.ok)throw new Error(result.error);
      data=extendCoverage(result,[...buffered.values()],day);error='';setLatest(data.lastAt);draw();
    }catch(cause){if(request===controller && active){error='No se pudo actualizar el mapa. Pulsa Actualizar gráficos.';draw();}}
    finally{if(request===controller){request=null;clearTimeout(timeout);}}
  }
  function render(){
    if(!active)return;
    const day=getDay(),next=day.from+':'+day.to;
    if(next!==key){
      if(drag){const id=drag.id;drag=null;if(svg.hasPointerCapture?.(id))svg.releasePointerCapture(id);}
      key=next;request?.abort();request=null;clearTimeout(timeout);data=null;buffered.clear();error='';selected=null;draw();load();
    }else if(Math.max(280,svg.getBoundingClientRect().width || 800)!==width)draw();else drawViewport();
  }
  function inspect(event,jump=false){
    if(!data?.bins.length)return;
    selected=nearestCoverageTimestamp(data.bins,timestampAt(event));
    $('coverageHint').textContent=`Registro cercano: ${time(selected)}. Pulsa para centrar los gráficos en esa medición.`;
    if(jump)onJump(selected);
  }
  svg.onpointerdown=()=>{if(!drag)suppressClick=false;};
  svg.onpointermove=event=>{
    if(drag){
      if(event.pointerId!==drag.id)return;
      event.preventDefault();
      const initial=drag.edge==='start'?drag.original.from:drag.original.to;
      drag.view=resizeDayWindow(drag.day,drag.original,drag.edge,initial+timestampAt(event)-drag.anchor);
      onResize(drag.view,{commit:false});describeSelection(drag.view);
    }else inspect(event);
  };
  svg.onpointerup=finishResize;svg.onpointercancel=finishResize;svg.onlostpointercapture=finishResize;
  svg.onclick=event=>{if(!drag&&!suppressClick)inspect(event,true);};
  svg.onkeydown=event=>{
    if(event.target && event.target!==svg)return;
    if(!['Home','End','ArrowLeft','ArrowRight','Enter',' '].includes(event.key) || !data?.bins.length)return;
    event.preventDefault();const stamps=[...new Set(data.bins.flatMap(bin=>[bin.firstAt,bin.lastAt]))].sort((a,b)=>a-b);
    let i=Math.max(0,stamps.indexOf(selected));
    if(event.key==='Home')i=0;else if(event.key==='End')i=stamps.length-1;else if(event.key==='ArrowLeft')i=Math.max(0,i-1);else if(event.key==='ArrowRight')i=Math.min(stamps.length-1,i+1);
    selected=stamps[i];onJump(selected);$('coverageHint').textContent='Mostrando una medición de las '+time(selected)+'.';
  };
  $('firstRecordChart').onclick=()=>{if(data?.total)onJump(data.firstAt);};
  $('lastRecordChart').onclick=()=>{if(data?.total)onJump(data.lastAt);};
  $('fitRecordsChart').onclick=()=>{if(data?.total)onFit(data.firstAt,data.lastAt);};
  $('lastAvailableChart').onclick=()=>{if(latest!==null)onLastAvailable(latest);};
  $('chartSessions').onchange=()=>{const group=groups.find(g=>String(g.from)===$('chartSessions').value);if(group)onJump(group.from);};
  document.addEventListener('visibilitychange',()=>{if(document.hidden){finishResize();request?.abort();request=null;clearTimeout(timeout);}else if(active)load();});
  return {start(){active=true;render();},render,accept,setLatest,reload(force=true){load(force);},
    stop(){active=false;const id=drag?.id;drag=null;if(id!==undefined&&svg.hasPointerCapture?.(id))svg.releasePointerCapture(id);request?.abort();request=null;clearTimeout(timeout);buffered.clear();data=null;key='';viewport=null;handles=null;svg.replaceChildren();}};
}
