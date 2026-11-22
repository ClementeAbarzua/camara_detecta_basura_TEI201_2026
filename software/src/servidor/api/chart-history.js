import { reply, settings } from '../lib/config.js';
import { readChartHistory } from '../lib/store.js';

export function createChartHistoryHandler(read = readChartHistory, clock = Date.now) {
  return async (req, res) => {
    try {
      if (req.method !== 'GET') return reply(res, 405, { error: 'Usa GET.' });
      const params = new URL(req.url, 'http://localhost').searchParams;
      const now = clock(), minutes = Number(params.get('minutes') || 15), after = params.get('after');
      const explicit = params.has('from') || params.has('to');
      const from = Number(params.get('from')), to = Number(params.get('to'));
      if ((explicit ? (!params.has('from') || !params.has('to') || !/^\d+$/.test(params.get('from')) || !/^\d+$/.test(params.get('to')) ||
        !Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 0 || from >= to || to > now) :
        (!Number.isFinite(minutes) || minutes <= 0 || !Number.isSafeInteger(minutes * 60000) || minutes * 60000 > now)) || (after !== null &&
        (!/^(0|[1-9]\d{0,18})$/.test(after) || BigInt(after) > 9223372036854775807n)))
        return reply(res, 400, { error: 'Usa fechas validas (desde < hasta), no futuras, y un cursor valido.' });
      const staleMs = settings().staleMs;
      const data = await read({ ...(explicit ? { from, to } : { minutes }), after, now, staleMs });
      return reply(res, 200, { ...data, now, staleMs });
    } catch (error) {
      console.error('chart-history:', error.code || error.name);
      return reply(res, error.status || 503, { error: error.status ? error.message : 'No se pudieron consultar los graficos. Intenta nuevamente.' });
    }
  };
}
export default createChartHistoryHandler();
