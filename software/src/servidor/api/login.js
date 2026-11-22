import { passwordMatches, createSession, setSession, sameOrigin } from '../lib/auth.js';
import { body, reply } from '../lib/config.js';
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return reply(res, 405, { error: 'Usa POST.' });
    if (!sameOrigin(req)) return reply(res, 403, { error: 'Origen no permitido.' });
    const { password } = JSON.parse((await body(req, 2048)).toString());
    if (typeof password !== 'string' || !passwordMatches(password)) return reply(res, 401, { error: 'Clave incorrecta.' });
    setSession(res, createSession()); reply(res, 200, { ok: true });
  } catch (error) {
    console.error('login:', error.message);
    reply(res, error instanceof SyntaxError ? 400 : 503, { error: 'No se pudo iniciar sesion. Revisa la configuracion.' });
  }
}
