import { reply } from '../lib/config.js';

// La exportacion web se retiro al publicar el monitor, incluso para sesiones antiguas.
export function createExportHandler() {
  return async (_req, res) => reply(res, 404, { error: 'No encontrado.' });
}
export default createExportHandler();
