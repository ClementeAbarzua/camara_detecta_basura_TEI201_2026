import { reply } from '../lib/config.js';
import { readHistory } from '../lib/store.js';

export function createHistoryHandler(read = readHistory) {
return async function handler(req, res) {
  try {
    if (req.method !== 'GET') return reply(res, 405, { error: 'Usa GET.' });
    const url = new URL(req.url, 'http://localhost');
    const limit = Number(url.searchParams.get('limit') || 50);
    const before = url.searchParams.get('before');
    reply(res, 200, await read({ before, limit }));
  } catch (error) {
    console.error('history:', error.message);
    reply(res, error.status || 503, { error: error.status ? error.message : 'No se pudo consultar el historial. Intenta nuevamente.' });
  }
};
}
export default createHistoryHandler();
