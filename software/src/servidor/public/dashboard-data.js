// Presentación de resultados existentes; no modifica el algoritmo ni sus umbrales.
export function decisionPresentation({state,fresh=false,paused=false,pending=false,error=false}){
  if(error)return {kind:'offline',badge:'Sin conexión',symbol:'—',action:'Comprueba la conexión con el servidor. La última lectura no confirma el estado actual.'};
  if(paused)return {kind:'paused',badge:'Detección en pausa',symbol:'Ⅱ',action:'El historial se conserva. El administrador puede reanudar las capturas.'};
  if(pending)return {kind:'pending',badge:'Actualizando ajustes',symbol:'…',action:'Espera las nuevas capturas antes de interpretar una conclusión.'};
  if(!state)return {kind:'waiting',badge:'Esperando datos',symbol:'…',action:'Enciende la cámara y verifica su conexión WiFi para iniciar el monitoreo.'};
  if(!fresh)return {kind:'offline',badge:'Sin datos recientes',symbol:'—',action:'Comprueba que la cámara esté conectada. No hay una conclusión actual disponible.'};
  if(state.conclusion==='Hay basura')return {kind:'trash',badge:'Hay basura confirmada',symbol:'!',action:'Revisa la zona monitoreada y evalúa si corresponde retirar los residuos.'};
  if(state.conclusion==='Sin basura')return {kind:'clear',badge:'Sin basura confirmada',symbol:'✓',action:'Mantén el monitoreo. El modelo no confirma presencia de residuos en la zona.'};
  return {kind:'unsure',badge:'Evaluación en curso',symbol:'?',action:'Espera la confirmación: todavía no hay evidencia estable para decidir.'};
}
export function createDecisionAlertTracker(){
  let latest=-Infinity,confirmed=null;
  return {
    observe(state,kind){
      if(!state||!Number.isFinite(state.receivedAt)||state.receivedAt<=latest)return null;
      const initial=latest===-Infinity;latest=state.receivedAt;
      if(!['trash','clear'].includes(kind))return null;
      const previous=confirmed;confirmed=kind;
      if(initial||previous===kind)return null; // Al abrir la página no crear un cambio ficticio.
      return {kind,receivedAt:state.receivedAt,conclusion:state.conclusion};
    }
  };
}
export function trendHours(data,day,now){
  const bins=new Map((data?.bins??[]).map(b=>[b.index,b]));
  return Array.from({length:Math.ceil((day.to-day.from)/3600000)},(_,index)=>{
    const from=day.from+index*3600000,to=Math.min(day.to,from+3600000),bin=bins.get(index);
    return {index,from,to,total:bin?.total??0,trash:bin?.trash??0,clear:bin?.clear??0,unsure:bin?.unsure??0,future:from>=now};
  });
}
export function peakTrashHour(hours){
  return hours.filter(h=>h.trash>0).sort((a,b)=>b.trash-a.trash||b.trash/b.total-a.trash/a.total||a.from-b.from)[0]??null;
}
