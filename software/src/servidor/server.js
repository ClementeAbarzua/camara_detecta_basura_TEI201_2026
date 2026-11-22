import { createServer } from './lib/http-server.js';
import { getPool, query, closeDatabase } from './lib/database.js';
import { migrate } from './lib/migrate.js';
import { loadModel, predictRGB } from './lib/model.js';
import { settings } from './lib/config.js';
import ingest from './api/ingest.js';
import state from './api/state.js';
import history from './api/history.js';
import chartHistory from './api/chart-history.js';
import chartCoverage from './api/chart-coverage.js';
import decisionTrends from './api/decision-trends.js';
import cameraSettings from './api/camera-settings.js';
import { adminHandlers } from './api/admin.js';
import {livePreviewHandlers} from './api/live-preview.js';
import {livePreview} from './lib/live-preview.js';
import {attachDeviceVideo} from './lib/device-video.js';
import {operationHandlers} from './api/operations.js';
import {createAdminExportHandler} from './api/admin-export.js';
import { validateAuthConfig } from './lib/auth.js';
import { liveEvents } from './lib/live-events.js';

let server, deviceVideo, shutdownStarted = false;
async function shutdown() {
  if (shutdownStarted) return; shutdownStarted = true;
  console.log('Cerrando servidor y conexiones PostgreSQL...');
  if (!server) { await closeDatabase(); return; }
  server.drain(); liveEvents.close(); livePreview.clear(); deviceVideo?.close();
  const timeout = setTimeout(() => { server.server.closeAllConnections(); process.exit(1); }, 25000); timeout.unref();
  await new Promise(resolve => server.server.close(resolve));
  await closeDatabase(); clearTimeout(timeout);
}

try {
  validateAuthConfig(); settings();
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT invalido.');
  console.log('Preparando tablas PostgreSQL...'); await migrate(getPool());
  console.log('Cargando y preparando el modelo...'); await loadModel();
  await predictRGB(new Uint8Array(224 * 224 * 3));
  const routes = { '/api/events':liveEvents.subscribe, '/api/ingest': ingest, '/api/state': state, '/api/history': history, '/api/chart-history': chartHistory, '/api/chart-coverage':chartCoverage, '/api/camera-settings': cameraSettings };
  for (const [name, handler] of Object.entries(adminHandlers)) routes['/api/admin/' + name] = handler;
  routes['/api/admin/operations']=operationHandlers.operations;
  routes['/api/device/control']=operationHandlers.control;
  routes['/api/admin/export']=createAdminExportHandler();
  routes['/api/decision-trends']=decisionTrends;
  routes['/api/admin/live']=livePreviewHandlers.control;
  routes['/api/admin/live/stream']=livePreviewHandlers.stream;
  routes['/api/device/preview']=livePreviewHandlers.upload;
  server = createServer({ routes, health: () => query('SELECT 1') });
  deviceVideo = attachDeviceVideo(server.server);
  await new Promise((resolve, reject) => { server.server.once('error', reject); server.server.listen(port, '0.0.0.0', resolve); });
  console.log('Servidor listo. Puerto ' + port + '. Modelo cargado y PostgreSQL conectado.');
  if (process.env.INGEST_PAUSED === 'true') console.log('Recepcion de capturas pausada por mantenimiento.');
  process.once('SIGTERM', () => shutdown().catch(() => process.exit(1)));
  process.once('SIGINT', () => shutdown().catch(() => process.exit(1)));
} catch (error) {
  console.error('No se pudo iniciar:', error.message?.replace(/postgres(?:ql)?:\/\/[^\s]+/g, '[conexion privada]'));
  await closeDatabase(); process.exitCode = 1;
}
