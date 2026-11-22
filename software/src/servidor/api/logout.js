import { setSession, sameOrigin } from '../lib/auth.js';
import { reply } from '../lib/config.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return reply(res, 405, { error: 'Usa POST.' });
  if (!sameOrigin(req)) return reply(res, 403, { error: 'Origen no permitido.' });
  setSession(res, '', 0); reply(res, 200, { ok: true });
}
