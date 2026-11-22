import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { reply } from './config.js';

const PUBLIC = new URL('../public/', import.meta.url);
const FILES = {
  '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'application/javascript'],
  '/charts.js': ['charts.js', 'application/javascript'], '/chart-data.js': ['chart-data.js', 'application/javascript'],
  '/chart-overview.js': ['chart-overview.js', 'application/javascript'],
  '/charts.css': ['charts.css', 'text/css'],
  '/admin': ['admin.html', 'text/html'], '/admin/': ['admin.html', 'text/html'],
  '/admin.js': ['admin.js', 'application/javascript'], '/admin-live.js':['admin-live.js','application/javascript'], '/admin-tools.js':['admin-tools.js','application/javascript'], '/admin.css': ['admin.css', 'text/css'],
  '/roi-geometry.js':['roi-geometry.js','application/javascript'], '/roi-editor.js':['roi-editor.js','application/javascript'],
  '/decision-progress.js':['decision-progress.js','application/javascript'],
  '/dashboard-data.js':['dashboard-data.js','application/javascript'],
  '/dashboard-live.js':['dashboard-live.js','application/javascript'],
  '/decision-trends.js':['decision-trends.js','application/javascript'],
  '/dashboard.css':['dashboard.css','text/css'],
  '/style.css': ['style.css', 'text/css'], '/history.css': ['history.css', 'text/css'],
  '/theme.js':['theme.js','application/javascript']
};
const CSP = "default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";

// Las rutas se inyectan para probar la misma capa HTTP con PostgreSQL local.
export function createServer({ routes, health }) {
  let draining = false, ingestBusy = false;
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', CSP);
    res.setHeader('Cache-Control', 'no-store');
    if (process.env.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security', 'max-age=31536000');
    try {
      const url = new URL(req.url, 'http://localhost');
      if (draining) { res.setHeader('Connection', 'close'); req.resume(); return reply(res, 503, { error: 'Servidor reiniciandose.' }); }
      if (url.pathname === '/healthz') {
        if (req.method !== 'GET') return reply(res, 405, { error: 'Usa GET.' });
        await health(); return reply(res, 200, { ok: true });
      }
      const handler = routes[url.pathname];
      if (handler) {
        // Una camara envia de forma secuencial. Evitar colas de fotos en memoria.
        if (url.pathname === '/api/ingest') {
          if (ingestBusy) { res.setHeader('Retry-After', '15'); req.resume(); return reply(res, 429, { error: 'Analisis en curso. Reintenta con una captura nueva.' }); }
          ingestBusy = true;
          try { await handler(req, res); } finally { ingestBusy = false; req.resume(); }
        } else { await handler(req, res); req.resume(); }
        return;
      }
      if (!['GET', 'HEAD'].includes(req.method)) { req.resume(); return reply(res, 405, { error: 'Metodo no permitido.' }); }
      const file = FILES[url.pathname];
      if (!file) return reply(res, 404, { error: 'No encontrado.' });
      const bytes = await readFile(new URL(file[0], PUBLIC));
      res.setHeader('Content-Type', file[1] + '; charset=utf-8');
      res.setHeader('Content-Length', bytes.length);
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch (error) {
      console.error('Solicitud fallida:', error.code || error.name);
      if (!res.headersSent) reply(res, error.status || 503, { error: 'Servicio no disponible. Revisa los registros del servidor.' });
      else res.destroy();
    }
  });
  server.requestTimeout = 60000; server.headersTimeout = 15000; server.keepAliveTimeout = 5000;
  return { server, drain() { draining = true; } };
}
