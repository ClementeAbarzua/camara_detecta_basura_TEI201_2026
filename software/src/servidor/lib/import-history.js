// Copia completa y atomica a un destino vacio. Nunca modifica el origen.
const COLUMNS = ['id','camara_id','recibido_en','arranque','secuencia','conclusion',
  'p_sin_basura','p_botellas','p_papeles_cartones','p_bolsas','basura_actual',
  'basura_promedio','umbral','capturas_promedio','confirmaciones','analisis_ms'];

export async function importHistory(source, target) {
  let sourceOpen = false, targetOpen = false;
  try {
    await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'); sourceOpen = true;
    await target.query('BEGIN'); targetOpen = true;
    // Mismo orden que las escrituras de la aplicacion para evitar interbloqueos.
    await target.query('LOCK TABLE camaras IN SHARE ROW EXCLUSIVE MODE');
    await target.query('LOCK TABLE estado_camara IN ACCESS EXCLUSIVE MODE');
    await target.query('LOCK TABLE mediciones IN ACCESS EXCLUSIVE MODE');
    const occupied = await target.query('SELECT (SELECT count(*) FROM mediciones) + (SELECT count(*) FROM estado_camara) AS n');
    if (Number(occupied.rows[0].n) !== 0) throw new Error('El destino ya contiene datos. La importacion requiere una base nueva; no se ha borrado nada.');
    // to_jsonb permite leer tambien origenes anteriores que no tenian orientacion.
    const cameras = (await source.query(`SELECT id, nombre, ubicacion, creada_en::text AS creada_en,
      COALESCE((to_jsonb(c)->>'rotacion')::smallint, 0) AS rotacion,
      COALESCE(to_jsonb(c)->>'orientacion_version', '0') AS orientacion_version
      FROM camaras c ORDER BY id`)).rows;
    for (const row of cameras) {
      await target.query(`INSERT INTO camaras (id,nombre,ubicacion,creada_en,rotacion,orientacion_version) VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, ubicacion=EXCLUDED.ubicacion,
          creada_en=EXCLUDED.creada_en, rotacion=EXCLUDED.rotacion, orientacion_version=EXCLUDED.orientacion_version`,
        [row.id,row.nombre,row.ubicacion,row.creada_en,180,
          String(BigInt(row.orientacion_version) + (row.rotacion === 180 ? 0n : 1n))]);
    }
    let cursor = '0', measurements = 0;
    for (;;) {
      const selection = COLUMNS.map(key => key === 'recibido_en' ? 'recibido_en::text AS recibido_en' : key).join(',');
      const rows = (await source.query(`SELECT ${selection} FROM mediciones WHERE id > $1 ORDER BY id LIMIT 250`, [cursor])).rows;
      if (!rows.length) break;
      const values = [], groups = rows.map(row => '(' + COLUMNS.map(key => {
        values.push(row[key]); return '$' + values.length;
      }).join(',') + ')');
      await target.query(`INSERT INTO mediciones (${COLUMNS.join(',')}) OVERRIDING SYSTEM VALUE VALUES ${groups.join(',')}`, values);
      cursor = String(rows.at(-1).id); measurements += rows.length;
    }
    const states = (await source.query('SELECT camara_id, revision, estado, actualizado_en::text AS actualizado_en FROM estado_camara ORDER BY camara_id')).rows;
    for (const row of states) await target.query('INSERT INTO estado_camara (camara_id,revision,estado,actualizado_en) VALUES ($1,$2,$3::jsonb,$4)',
      [row.camara_id,row.revision,JSON.stringify(row.estado),row.actualizado_en]);
    const counts = (await target.query('SELECT count(*) AS n FROM mediciones')).rows;
    if (Number(counts[0].n) !== measurements) throw new Error('El conteo final no coincide. Importacion cancelada.');
    // setval se deja al final: las secuencias de PostgreSQL no revierten con ROLLBACK.
    await target.query("SELECT setval(pg_get_serial_sequence('mediciones','id'), COALESCE(max(id),1), count(*)>0) FROM mediciones");
    await source.query('COMMIT'); sourceOpen = false;
    await target.query('COMMIT'); targetOpen = false;
    return { cameras: cameras.length, measurements, states: states.length };
  } catch (error) {
    if (targetOpen) await target.query('ROLLBACK').catch(() => {});
    if (sourceOpen) await source.query('ROLLBACK').catch(() => {});
    throw error;
  }
}
