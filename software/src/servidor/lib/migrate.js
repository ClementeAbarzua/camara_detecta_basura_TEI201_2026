import { readFile } from 'node:fs/promises';
// Una conexion dedicada mantiene el bloqueo entre BEGIN y COMMIT.
export async function migrate(databasePool) {
  const schema = await readFile(new URL('../database/schema.sql', import.meta.url), 'utf8');
  const client = await databasePool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(172035001)');
    try { await client.query(schema); }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { await client.query('SELECT pg_advisory_unlock(172035001)'); }
  } finally { client.release(); }
}
