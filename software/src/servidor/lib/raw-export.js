// Lectura completa en una instantanea consistente. Solo mantiene un lote en RAM.
// Los BIGINT van como texto para no perder precision al leer el JSON en JavaScript.
// Las fechas conservan microsegundos y se expresan en UTC.
const SELECT = `SELECT id::text AS id, camara_id,
  to_char(recibido_en AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS recibido_en,
  arranque, secuencia::text AS secuencia, conclusion,
  p_sin_basura, p_botellas, p_papeles_cartones, p_bolsas,
  basura_actual, basura_promedio, umbral, capturas_promedio, confirmaciones, analisis_ms
  FROM public.mediciones WHERE id > $1::bigint ORDER BY mediciones.id ASC LIMIT $2`;

export async function* rawMeasurements(databasePool, { signal, batchSize = 500 } = {}) {
  const client = await databasePool.connect(); let open = false;
  try {
    signal?.throwIfAborted();
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'); open = true;
    let cursor = '0';
    for (;;) {
      signal?.throwIfAborted();
      const { rows } = await client.query(SELECT, [cursor, batchSize]);
      if (!rows.length) break;
      for (const row of rows) { signal?.throwIfAborted(); yield row; }
      cursor = rows.at(-1).id;
    }
    await client.query('COMMIT'); open = false;
  } finally {
    if (open) await client.query('ROLLBACK').catch(() => {});
    client.release();
  }
}
