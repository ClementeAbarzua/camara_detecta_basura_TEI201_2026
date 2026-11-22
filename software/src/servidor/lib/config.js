export const LABELS = ['Sin basura', 'Botellas', 'Papeles y Cartones', 'Bolsas'];
export function settings() {
  const threshold = Number(process.env.THRESHOLD || 0.8);
  const staleMs = Number(process.env.STALE_AFTER_SECONDS || 90) * 1000;
  const decisionProfile = process.env.DETECTION_PROFILE || 'demo';
  if (!['demo', 'stable'].includes(decisionProfile)) throw new Error('DETECTION_PROFILE debe ser demo o stable.');
  if (!(threshold >= 0.6 && threshold <= 0.95) || !(staleMs >= 30000 && staleMs <= 3600000)) {
    throw new Error('THRESHOLD o STALE_AFTER_SECONDS fuera de rango.');
  }
  return { threshold, staleMs, decisionProfile };
}
export function reply(res, status, data) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.statusCode = status;
  res.end(JSON.stringify(data));
}
export async function body(req, limit) {
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > limit) throw Object.assign(new Error('Archivo demasiado grande.'), { status: 413 });
  // Algunos adaptadores Node de hosting entregan el cuerpo ya decodificado.
  if (req.body !== undefined && req.body !== null) {
    const value = Buffer.isBuffer(req.body) ? req.body : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    if (value.length > limit) throw Object.assign(new Error('Archivo demasiado grande.'), { status: 413 });
    return value;
  }
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('Archivo demasiado grande.'), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
