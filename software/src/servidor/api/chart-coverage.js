import { reply } from '../lib/config.js';
import { readChartCoverage } from '../lib/store.js';

export function createChartCoverageHandler(read = readChartCoverage, clock = Date.now) {
  return async (req,res) => {
    try {
      if (req.method !== 'GET') return reply(res,405,{error:'Usa GET.'});
      const p = new URL(req.url,'http://localhost').searchParams;
      const from=Number(p.get('from')),to=Number(p.get('to')),now=clock();
      if (!/^\d+$/.test(p.get('from') ?? '') || !/^\d+$/.test(p.get('to') ?? '') ||
        !Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from<0 || from>=to || to>now || to-from>26*3600000)
        return reply(res,400,{error:'Elige un intervalo diario valido, no futuro.'});
      return reply(res,200,{...await read({from,to,now}),now});
    } catch(error) {
      console.error('chart-coverage:',error.code || error.name);
      return reply(res,error.status || 503,{error:'No se pudo consultar el mapa del dia. Pulsa Actualizar graficos para reintentar.'});
    }
  };
}
export default createChartCoverageHandler();
