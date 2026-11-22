// Ejecutar con la recepcion ya pausada. DATABASE_URL sigue apuntando al origen.
// El destino solo se configura con AIVEN_DATABASE_URL y AIVEN_CA_CERT.
import { createPool, getPool, closeDatabase } from '../lib/database.js';
import { migrate } from '../lib/migrate.js';
import { importHistory } from '../lib/import-history.js';

let targetPool, source, target;
try {
  if (process.env.INGEST_PAUSED !== 'true') throw new Error('PAUSE_REQUIRED');
  const targetURL = new URL(process.env.AIVEN_DATABASE_URL || '');
  if (!targetURL.hostname.endsWith('.aivencloud.com') || !process.env.AIVEN_CA_CERT || process.env.AIVEN_DATABASE_URL === process.env.DATABASE_URL)
    throw new Error('TARGET_CONFIG_REQUIRED');
  targetPool = createPool(process.env.AIVEN_DATABASE_URL, { caCertificate: process.env.AIVEN_CA_CERT, requireTLS: true });
  await migrate(targetPool);
  source = await getPool().connect(); target = await targetPool.connect();
  const result = await importHistory(source, target);
  console.log('COPIA_AIVEN_OK ' + JSON.stringify(result));
} catch (error) {
  console.error('Copia cancelada:', error.code || (['PAUSE_REQUIRED','TARGET_CONFIG_REQUIRED'].includes(error.message) ? error.message : 'Comprueba la configuracion y que el destino este vacio.'));
  process.exitCode = 1;
} finally {
  source?.release(); target?.release();
  await Promise.all([targetPool?.end(), closeDatabase()]);
}
