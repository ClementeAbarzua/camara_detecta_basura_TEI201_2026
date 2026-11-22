import { cameraAuthorized } from '../lib/auth.js';
import { body, reply, settings } from '../lib/config.js';
import { classify } from '../lib/model.js';
import { saveReading, readCameraSettings } from '../lib/store.js';
import { liveEvents } from '../lib/live-events.js';
import { DEFAULT_ROI } from '../public/roi-geometry.js';
import {livePreview} from '../lib/live-preview.js';
import {deviceStatus} from '../lib/device-status.js';

export function createIngestHandler(analyze = classify, save = saveReading, readCamera = readCameraSettings, publish = liveEvents.publish) {
return async function handler(req, res) {
  try {
    if (req.method !== 'POST') return reply(res, 405, { error: 'Usa POST.' });
    if (!cameraAuthorized(req)) return reply(res, 401, { error: 'Token de camara incorrecto.' });
    if (process.env.INGEST_PAUSED === 'true') return reply(res, 503, { error: 'Recepcion pausada por mantenimiento. Se conserva el historial.' });
    if (!/^(?:image\/jpeg|application\/octet-stream)(?:;|$)/i.test(req.headers['content-type'] || '')) return reply(res, 415, { error: 'Envio JPEG requerido.' });
    const boot = req.headers['x-camera-boot'], seqText = req.headers['x-frame-seq'];
    if (!/^[a-f0-9]{16}$/.test(boot || '') || !/^\d{1,10}$/.test(seqText || '')) return reply(res, 400, { error: 'Identificador de captura invalido.' });
    const receivedAt = Date.now();
    deviceStatus.note(req);
    const camera = await readCamera();
    res.setHeader('X-Preview-Active',req.headers['x-control-protocol']==='3'&&livePreview.active()?'1':'0');
    res.setHeader('X-Capture-Paused',camera.paused?'1':'0');
    res.setHeader('X-Control-Version',camera.version);
    if(camera.paused)return reply(res,200,{ok:true,paused:true,message:'Capturas y análisis pausados. No se guardó una medición.'});
    const jpeg = await body(req, 1000000);
    if (jpeg.length < 4 || jpeg[0] !== 255 || jpeg[1] !== 216) return reply(res, 415, { error: 'JPEG invalido.' });
    if (![0, 180].includes(camera.rotation)) throw new Error('Orientacion de camara invalida.');
    const roi=camera.roi ?? DEFAULT_ROI;
    const result = await analyze(jpeg, { rotation:camera.rotation,roi });
    const state = await save({ ...result, boot, seq: Number(seqText), receivedAt,
      rotation:camera.rotation,roi,orientationVersion:camera.version }, settings());
    // Avisar despues del commit. Un fallo del aviso no deshace una escritura correcta.
    try { publish(); } catch { console.error('No se pudo emitir el aviso de nueva medicion.'); }
    return reply(res, 200, { ok: true, conclusion: state.conclusion, analysisMs: result.analysisMs });
  } catch (error) {
    console.error('ingest:', error.code || error.name);
    reply(res, error.status || 503, { error: error.status ? error.message : 'No se pudo analizar o guardar. Revisa los registros y las variables de Railway.' });
  }
}
}
export default createIngestHandler();
