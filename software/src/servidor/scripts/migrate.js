import { getPool, closeDatabase } from '../lib/database.js';
import { migrate } from '../lib/migrate.js';
try { await migrate(getPool()); console.log('Tablas PostgreSQL preparadas.'); }
catch (error) { console.error('No se pudo preparar la base:', error.code || 'error de conexion o esquema'); process.exitCode = 1; }
finally { await closeDatabase(); }
