import { reply } from '../lib/config.js';

// Ningun cliente, incluidas sesiones anteriores, puede cambiar el montaje fijo.
export function createCameraSettingsHandler() {
  return async (_req, res) => reply(res, 410, { error: 'La camara tiene una rotacion fija de 180 grados.' });
}
export default createCameraSettingsHandler();
