import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const digest = value => createHash('sha256').update(value).digest('hex');
const matches = (a, b) => timingSafeEqual(Buffer.from(digest(a)), Buffer.from(digest(b)));
const credentials = () => ({ password:process.env.ADMIN_PASSWORD || process.env.DASHBOARD_PASSWORD || '', secret:process.env.SESSION_SECRET || '' });

// Sesiones de administrador independientes de las antiguas cookies de consulta.
// Solo se conserva el hash del token en memoria; reiniciar exige iniciar sesión otra vez.
export function createAdminAuth({ now = Date.now, readCredentials = credentials, production = () => process.env.NODE_ENV === 'production' } = {}) {
  const sessions = new Map(), failures = new Map();
  const ttl = 8 * 3600000, attemptWindow = 15 * 60000;
  const cookieName = () => production() ? '__Host-xiao_admin' : 'xiao_admin';
  function configured() {
    const { password, secret } = readCredentials();
    return password.length >= 12 && secret.length >= 32 && !/CAMBIAR_POR/.test(password + secret);
  }
  function credentialVersion() { const c = readCredentials(); return digest(c.secret + '\0' + c.password); }
  function prune() {
    const time = now();
    for (const [key, value] of sessions) if (value.expiresAt <= time) sessions.delete(key);
    for (const [key, value] of failures) if (value.until <= time) failures.delete(key);
  }
  function cookie(res, token, maxAge) {
    res.setHeader('Set-Cookie', `${cookieName()}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${production() ? '; Secure' : ''}`);
  }
  function lookup(req) {
    prune();
    if (!configured()) return null;
    const cookies = (req.headers.cookie || '').split(';').map(value => value.trim());
    const token = cookies.find(value => value.startsWith(cookieName() + '='))?.slice(cookieName().length + 1);
    if (!/^[a-f0-9]{64}$/.test(token || '')) return null;
    const key = digest(token), session = sessions.get(key);
    if (!session) return null;
    if (session.credentialVersion !== credentialVersion()) { sessions.delete(key); return null; }
    return { ...session, key };
  }
  function requireSession(req) {
    const session = lookup(req);
    if (!session) throw Object.assign(new Error('Inicia sesión como administrador.'), {status:401});
    return session;
  }
  function requireOrigin(req) {
    const expected = `${production() ? 'https' : req.socket?.encrypted ? 'https' : 'http'}://${req.headers.host}`;
    if (!req.headers.origin || req.headers.origin !== expected)
      throw Object.assign(new Error('Origen de la solicitud no permitido.'), {status:403});
  }
  function requireMutation(req) {
    const session = requireSession(req); requireOrigin(req);
    const csrf = req.headers['x-csrf-token'];
    if (typeof csrf !== 'string' || csrf.length !== 64 || !matches(csrf, session.csrf))
      throw Object.assign(new Error('La sesión cambió. Vuelve a entrar al panel.'), {status:403});
    return session;
  }
  function login(req, res, password) {
    prune();
    if (!configured()) throw Object.assign(new Error('Configura DASHBOARD_PASSWORD (12 caracteres o más) y SESSION_SECRET (32 o más) en Railway.'), {status:503});
    // Usar la dirección de la conexión, sin confiar en cabeceras enviadas por el cliente.
    const ip = req.socket?.remoteAddress || 'unknown', bucket = failures.get(ip);
    if ((bucket?.count || 0) >= 5 || (!bucket && failures.size >= 1000)) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil(((bucket?.until ?? now()+attemptWindow)-now())/1000))));
      throw Object.assign(new Error('Demasiados intentos. Espera 15 minutos antes de intentarlo otra vez.'), {status:429});
    }
    if (typeof password !== 'string' || !matches(password, readCredentials().password)) {
      failures.set(ip, {count:(bucket?.count || 0)+1,until:bucket?.until || now()+attemptWindow});
      throw Object.assign(new Error('Contraseña incorrecta.'), {status:401});
    }
    failures.delete(ip);
    if (sessions.size >= 1000) throw Object.assign(new Error('Demasiadas sesiones activas. Intenta más tarde.'), {status:503});
    // Rotar el token y revocar la sesión anterior de este navegador.
    const previous = lookup(req); if (previous) sessions.delete(previous.key);
    const token = randomBytes(32).toString('hex');
    const session = {csrf:randomBytes(32).toString('hex'),expiresAt:now()+ttl,credentialVersion:credentialVersion()};
    sessions.set(digest(token),session); cookie(res,token,ttl/1000);
    return session;
  }
  function logout(req, res) {
    const session = requireMutation(req); sessions.delete(session.key); cookie(res,'',0);
  }
  return { configured, lookup, requireSession, requireOrigin, requireMutation, login, logout };
}
export const adminAuth = createAdminAuth();
