import { createHmac, timingSafeEqual } from 'node:crypto';

function required(name, minimum) {
  const value = process.env[name] || '';
  if (value.length < minimum || /CAMBIAR_POR/.test(value)) throw new Error('Configura ' + name + ' en Railway.');
  return value;
}
export function equal(a, b) {
  const aa = Buffer.from(String(a)), bb = Buffer.from(String(b));
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
export function cameraAuthorized(req) {
  return equal(req.headers.authorization || '', 'Bearer ' + required('CAMERA_TOKEN', 32));
}
export function passwordMatches(password) {
  return equal(password, required('DASHBOARD_PASSWORD', 12));
}
const sign = text => createHmac('sha256', required('SESSION_SECRET', 32)).update(text).digest('base64url');
export function createSession() {
  const value = String(Date.now() + 12 * 60 * 60 * 1000);
  return value + '.' + sign(value);
}
export function viewerAuthorized(req) {
  try {
  const match = (req.headers.cookie || '').match(/(?:^|;\s*)xiao_session=([^;]+)/);
  if (!match) return false;
  const [expires, signature] = match[1].split('.');
  return /^\d+$/.test(expires) && Number(expires) > Date.now() && equal(signature || '', sign(expires));
  } catch { return false; } // Sin administracion configurada, el monitor sigue siendo publico.
}
export function setSession(res, value, age = 43200) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `xiao_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${secure}`);
}
export function validateAuthConfig() {
  required('CAMERA_TOKEN', 32);
}
export function sameOrigin(req) {
  if (!req.headers.origin) return true;
  try { return new URL(req.headers.origin).host === req.headers.host; } catch { return false; }
}
