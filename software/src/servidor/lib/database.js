import pg from 'pg';
let pool;

// Aiven usa la CA del proyecto. Retirar las opciones SSL de la URL evita
// que pg sustituya la CA por una configuracion menos estricta al interpretarla.
export function connectionOptions(connectionString, { caCertificate = '', requireTLS = false } = {}) {
  let url;
  try { url = new URL(connectionString); } catch { throw new Error('Configura una URL PostgreSQL valida.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('Configura una URL PostgreSQL valida.');
  const aiven = url.hostname.endsWith('.aivencloud.com');
  const ca = caCertificate.replace(/\\n/g, '\n').trim();
  if (aiven && !ca) throw new Error('Configura DATABASE_CA_CERT con el certificado CA de Aiven.');
  const strict = Boolean(ca || requireTLS || aiven);
  const sslMode = url.searchParams.get('sslmode');
  if (sslMode === 'no-verify' || (strict && (sslMode === 'disable' || ['0', 'false'].includes(url.searchParams.get('ssl')))))
    throw new Error('La conexion debe mantener la verificacion TLS.');
  const config = { connectionString, max: 5,
    connectionTimeoutMillis: 15000, idleTimeoutMillis: 60000,
    statement_timeout: 20000, query_timeout: 25000 };
  if (strict) {
    if (ca && !/-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----/.test(ca))
      throw new Error('DATABASE_CA_CERT no contiene un certificado PEM valido.');
    for (const key of ['ssl', 'sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat']) url.searchParams.delete(key);
    // Host/port en los parametros podrian reemplazar el host verificado por TLS.
    if (url.searchParams.has('host') || url.searchParams.has('port')) throw new Error('Usa host y puerto en la URL, no en sus parametros.');
    config.connectionString = url.toString();
    config.ssl = { rejectUnauthorized: true, servername: url.hostname, ...(ca ? { ca } : {}) };
  }
  return config;
}
export function createPool(connectionString, options = {}) {
  const created = new pg.Pool(connectionOptions(connectionString, options));
  created.on('error', error => console.error('Conexion PostgreSQL interrumpida:', error.code || 'error'));
  return created;
}
export function getPool() { return pool ||= createPool(process.env.DATABASE_URL, {
  caCertificate: process.env.DATABASE_CA_CERT || '', requireTLS: process.env.DATABASE_REQUIRE_TLS === 'true'
}); }
export async function query(text, parameters = []) { return (await getPool().query(text, parameters)).rows; }
export async function closeDatabase() { const current = pool; pool = null; if (current) await current.end(); }
