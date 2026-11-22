import {localDayKey,localDayBounds} from './chart-data.js';
import {trendHours,peakTrashHour} from './dashboard-data.js';
export function createDecisionTrends({get,document:doc=globalThis.document,request=globalThis.fetch,onExplore=()=>{},now=Date.now,schedule=setTimeout,cancel=clearTimeout}){
  let selected=localDayKey(now()),active=false,controller=null,debounce,queued=false,generation=0;
  const pct=(value,total)=>total?(100*value/total).toFixed(1)+' %':'—';
  const time=t=>new Date(t).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit',hour12:false});
  const fullTime=t=>new Date(t).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit',hour12:false,timeZoneName:'shortOffset'});
  function element(tag,className,text){const e=doc.createElement(tag);e.className=className;if(text!==undefined)e.textContent=text;return e;}
  function clear(){
    for(const id of ['trendTrash','trendClear','trendUnsure','trendPeak'])get(id).textContent='—';
    for(const id of ['trendTrashCount','trendClearCount','trendUnsureCount','trendPeakCount'])get(id).textContent='Sin datos para este día';
    get('hourlyTrends').replaceChildren();get('trendEvents').replaceChildren();get('trendInsight').textContent='';get('trendEmpty').hidden=true;
  }
  function render(data,day){
    const hours=trendHours(data,day,data.now),totals=data.totals,peak=peakTrashHour(hours);
    for(const[key,name]of [['trash','Trash'],['clear','Clear'],['unsure','Unsure']]){
      get('trend'+name).textContent=pct(totals[key],totals.total);get('trend'+name+'Count').textContent=`${totals[key]} de ${totals.total} mediciones`;
    }
    get('trendPeak').textContent=peak?time(peak.from):'—';
    get('trendPeakCount').textContent=peak?`${peak.trash} mediciones con basura`:'Sin confirmaciones de basura';
    get('trendEmpty').hidden=totals.total>0;
    get('trendInsight').textContent=!totals.total?'':peak?
      `Entre ${fullTime(peak.from)} y ${fullTime(peak.to)} se registró el mayor número de resultados «Hay basura»: ${peak.trash}. ${pct(peak.trash,peak.total)} de las mediciones de esa franja.`:
      totals.clear?'En las mediciones de este día no hay conclusiones confirmadas de basura. Revisa también las franjas sin datos o sin confirmar.':'Las mediciones de este día todavía no tienen conclusiones confirmadas.';
    const tiles=hours.map(h=>{
      const tile=element('button','hourTile');tile.type='button';tile.disabled=h.future||!h.total;
      tile.dataset.state=!h.total?'missing':h.trash>h.clear&&h.trash>h.unsure?'trash':h.clear>h.trash&&h.clear>h.unsure?'clear':h.unsure>h.trash&&h.unsure>h.clear?'unsure':'mixed';
      const description=h.future?'Hora futura':h.total?`${h.total} mediciones. Hay basura ${pct(h.trash,h.total)} (${h.trash}); sin basura ${pct(h.clear,h.total)} (${h.clear}); no seguro ${pct(h.unsure,h.total)} (${h.unsure}). Pulsa para explorar esa hora.`:'Sin mediciones guardadas';
      tile.setAttribute('aria-label',`${fullTime(h.from)} a ${fullTime(h.to)}. ${description}`);tile.title=description;
      const bar=element('span','hourBar');for(const key of ['trash','clear','unsure']){const part=element('i',key);part.style.width=h.total?(100*h[key]/h.total)+'%':'0%';bar.append(part);}
      const value=h.future?'Por ocurrir':!h.total?'Sin datos':h.unsure>Math.max(h.trash,h.clear)?`${pct(h.unsure,h.total)} sin confirmar`:h.trash>h.clear?`${pct(h.trash,h.total)} con basura`:h.clear>h.trash?`${pct(h.clear,h.total)} sin basura`:'Resultados mixtos';
      tile.append(element('strong','hourLabel',time(h.from)),bar,element('span','hourValue',value),element('small','hourCount',h.total?`${h.total} mediciones`:'—'));
      tile.addEventListener('click',()=>{if(!tile.disabled)onExplore({from:h.from,to:h.to});});return tile;
    });get('hourlyTrends').replaceChildren(...tiles);
    const events=data.events.map(event=>{
      const li=element('li','trendEvent '+(event.conclusion==='Hay basura'?'trash':'clear'));
      li.append(element('time','',time(event.receivedAt)),element('strong','',event.conclusion),element('span','',`${(event.confidence*100).toFixed(1)} % de confianza`));return li;
    });
    if(!events.length)events.push(element('li','emptyEvents','No hay confirmaciones en este día.'));
    get('trendEvents').replaceChildren(...events);
    get('trendStatus').textContent=`${totals.total} mediciones · ${hours.filter(h=>h.total).length} franjas con registros · consultado a las ${time(data.now)}.`;
  }
  async function load(){
    cancel(debounce);if(!active||doc.hidden)return;if(controller){queued=true;return;}
    const key=selected,day=localDayBounds(key),to=Math.min(day.to,now()),expected=generation;
    get('trendDay').textContent=new Date(day.from).toLocaleDateString('es-CL',{day:'numeric',month:'long',year:'numeric'});
    if(to<=day.from){clear();get('trendStatus').textContent='Este día todavía no ocurre.';return;}
    const current=new AbortController();controller=current;get('refreshTrends').disabled=true;get('trendStatus').textContent='Consultando el resumen del día…';
    const timeout=schedule(()=>current.abort(),15000);
    try{
      const response=await request('/api/decision-trends?'+new URLSearchParams({from:String(day.from),to:String(to)}),{cache:'no-store',signal:current.signal});
      const data=await response.json();if(expected!==generation||!active)return;
      if(!response.ok)throw Error(data.error||'No se pudo consultar el resumen.');
      render(data,day);
    }catch(error){if(expected===generation&&active&&!doc.hidden){clear();get('trendStatus').textContent=error.name==='AbortError'?'La consulta tardó demasiado. Pulsa Actualizar resumen.':error.message||'No se pudo consultar el resumen. Pulsa Actualizar resumen.';}}
    finally{
      cancel(timeout);if(controller===current){controller=null;get('refreshTrends').disabled=false;if(queued&&active&&!doc.hidden){queued=false;debounce=schedule(load,0);}}
    }
  }
  get('refreshTrends').addEventListener('click',load);
  doc.addEventListener('visibilitychange',()=>{cancel(debounce);if(doc.hidden)controller?.abort();else if(active)load();});
  return {
    selectDay(key){if(key===selected||!localDayBounds(key))return;selected=key;generation++;controller?.abort();controller=null;queued=false;clear();if(active)load();},
    notify(){if(!active||doc.hidden||selected!==localDayKey(now()))return;cancel(debounce);debounce=schedule(load,700);},
    refresh:load,
    start(){if(!active){active=true;load();}},
    stop(){active=false;generation++;cancel(debounce);controller?.abort();controller=null;queued=false;}
  };
}
