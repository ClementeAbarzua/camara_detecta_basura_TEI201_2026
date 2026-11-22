import {reply} from '../lib/config.js';
import {readDecisionTrends} from '../lib/store.js';
export function createDecisionTrendsHandler(read=readDecisionTrends,clock=Date.now){
  return async(req,res)=>{
    try{
      if(req.method!=='GET')return reply(res,405,{error:'Usa GET.'});
      const p=new URL(req.url,'http://localhost').searchParams,from=Number(p.get('from')),to=Number(p.get('to')),now=clock();
      if(!/^\d+$/.test(p.get('from')??'')||!/^\d+$/.test(p.get('to')??'')||!Number.isSafeInteger(from)||!Number.isSafeInteger(to)||from<0||from>=to||from>=now||to-from>26*3600000)
        return reply(res,400,{error:'Elige un intervalo diario válido, no futuro.'});
      // Acotar al reloj del servidor: hoy incluye horas aún no ocurridas y el cliente puede tener desfase.
      return reply(res,200,{...await read({from,to:Math.min(to,now),now}),now});
    }catch(e){console.error('decision-trends:',e.code||e.name);return reply(res,e.status||503,{error:'No se pudieron consultar las tendencias. Pulsa Actualizar resumen para reintentar.'});}
  };
}
export default createDecisionTrendsHandler();
