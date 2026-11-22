import { createPool, getPool, closeDatabase } from '../lib/database.js';
import { migrate } from '../lib/migrate.js';
import { importHistory } from '../lib/import-history.js';

let sourcePool, source, target;
try {
  if (!process.env.SOURCE_DATABASE_URL || process.env.SOURCE_DATABASE_URL === process.env.DATABASE_URL)
    throw new Error('Configura SOURCE_DATABASE_URL del origen y DATABASE_URL de un destino distinto y vacio.');
  sourcePool = createPool(process.env.SOURCE_DATABASE_URL, { caCertificate: process.env.SOURCE_DATABASE_CA_CERT || '' });
  await migrate(getPool());
  source = await sourcePool.connect(); target = await getPool().connect();
  const result = await importHistory(source, target);
  console.log('Importacion completada:', result);
} catch (error) {
  // No imprimir cadenas de conexion ni mensajes SQL que incluyan datos privados.
  console.error('Importacion cancelada:', error.code || (error.message?.startsWith('El destino') ? error.message : 'Revisa las conexiones y que el destino este vacio.'));
  process.exitCode = 1;
} finally {
  source?.release(); target?.release();
  await Promise.all([sourcePool?.end(), closeDatabase()]);
}
