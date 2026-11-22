import { decide } from './decision.js';
import { query } from './database.js';
import { DEFAULT_ROI, validRoi, sameRoi } from '../public/roi-geometry.js';
const CAMERA_ID = 'camara-1';

// La revision evita carreras. El estado y la medicion se escriben juntos:
// si falla el registro, PostgreSQL revierte tambien el cambio de estado.
const SAVE = `
WITH configuracion_actual AS MATERIALIZED (
  SELECT id FROM camaras
  WHERE id = $1 AND orientacion_version = $4::bigint AND rotacion = $5::smallint AND NOT capturas_pausadas
  FOR UPDATE
), actualizado AS (
  INSERT INTO estado_camara (camara_id, revision, estado)
  SELECT $1, 1, $2::jsonb FROM configuracion_actual WHERE true
  ON CONFLICT (camara_id) DO UPDATE
  SET revision = estado_camara.revision + 1,
      estado = EXCLUDED.estado, actualizado_en = clock_timestamp()
  WHERE estado_camara.revision = $3::bigint
  RETURNING estado
), registrado AS (
  INSERT INTO mediciones (
    camara_id, recibido_en, arranque, secuencia, conclusion,
    p_sin_basura, p_botellas, p_papeles_cartones, p_bolsas,
    basura_actual, basura_promedio, umbral, capturas_promedio,
    confirmaciones, analisis_ms
  )
  SELECT $1, to_timestamp((estado->>'receivedAt')::double precision / 1000.0),
    estado->>'boot', (estado->>'seq')::bigint, estado->>'conclusion',
    (estado->'scores'->>0)::double precision, (estado->'scores'->>1)::double precision,
    (estado->'scores'->>2)::double precision, (estado->'scores'->>3)::double precision,
    (estado->>'trashNow')::double precision, (estado->>'trashAverage')::double precision,
    (estado->>'threshold')::double precision, jsonb_array_length(estado->'history'),
    (estado->>'streak')::smallint, (estado->>'analysisMs')::integer
  FROM actualizado
  RETURNING id
)
SELECT estado FROM actualizado CROSS JOIN registrado`;

// La misma implementacion funciona con pg en Railway y PostgreSQL local (PGlite).
export function createStore(execute) {
  const cameraColumns = 'rotacion AS rotation, orientacion_version::text AS version, umbral_decision AS threshold, zona_analisis AS roi, capturas_pausadas AS paused';
  async function readCameraSettings() {
    const rows = await execute('SELECT ' + cameraColumns + ' FROM camaras WHERE id = $1', [CAMERA_ID]);
    if (!rows.length) throw new Error('Camara no configurada.');
    return rows[0];
  }
  async function readCameraView() {
    const rows = await execute(`SELECT c.rotacion AS rotation, c.orientacion_version::text AS version, c.umbral_decision AS threshold, c.zona_analisis AS roi, c.capturas_pausadas AS paused, e.estado
      FROM camaras c LEFT JOIN estado_camara e ON e.camara_id = c.id WHERE c.id = $1`, [CAMERA_ID]);
    if (!rows.length) throw new Error('Camara no configurada.');
    const { estado, ...camera } = rows[0]; return { camera, state: estado };
  }
  async function setOrientation(rotation, expectedVersion) {
    if (![0, 180].includes(rotation) || !/^(0|[1-9]\d{0,18})$/.test(expectedVersion) || BigInt(expectedVersion) >= 9223372036854775807n)
      throw Object.assign(new Error('Orientacion o version invalida.'), { status: 400 });
    const rows = await execute(`UPDATE camaras SET rotacion = $2,
      orientacion_version = orientacion_version + CASE WHEN rotacion <> $2 THEN 1 ELSE 0 END
      WHERE id = $1 AND orientacion_version = $3::bigint RETURNING ` + cameraColumns,
    [CAMERA_ID, rotation, expectedVersion]);
    if (!rows.length) throw Object.assign(new Error('La orientacion cambio en otro dispositivo. Actualiza e intentalo nuevamente.'), { status: 409 });
    return rows[0];
  }
  async function setCameraSettings({ rotation, threshold, expectedVersion, roi }) {
    if (![0, 180].includes(rotation) || typeof threshold !== 'number' || !Number.isFinite(threshold) || threshold < .60 || threshold > .95 ||
        typeof expectedVersion !== 'string' || !/^(0|[1-9]\d{0,18})$/.test(expectedVersion) || BigInt(expectedVersion) >= 9223372036854775807n)
      throw Object.assign(new Error('Usa giro de 0 o 180 grados y exigencia entre 60 y 95 %.'), {status:400});
    if (roi !== undefined && !validRoi(roi)) throw Object.assign(new Error('Zona de análisis inválida. El tamaño debe estar entre 15 y 100 % del lado corto.'), {status:400});
    const rows = await execute(`UPDATE camaras SET rotacion=$2, umbral_decision=$3, zona_analisis=COALESCE($5::jsonb,zona_analisis),
      orientacion_version = orientacion_version + CASE WHEN rotacion <> $2 OR umbral_decision IS DISTINCT FROM $3::double precision
        OR ($5::jsonb IS NOT NULL AND zona_analisis <> $5::jsonb) THEN 1 ELSE 0 END
      WHERE id = $1 AND orientacion_version = $4::bigint RETURNING ` + cameraColumns,
    [CAMERA_ID, rotation, threshold, expectedVersion,roi === undefined ? null : JSON.stringify(roi)]);
    if (!rows.length) throw Object.assign(new Error('Los ajustes cambiaron en otra pestaña. Recarga los valores antes de guardar.'), {status:409});
    return rows[0];
  }
  async function readVersionedState() {
    const rows = await execute('SELECT revision, estado FROM estado_camara WHERE camara_id = $1', [CAMERA_ID]);
    return rows[0] || { revision: '0', estado: null };
  }
  async function readState() { return (await readVersionedState()).estado; }
  async function setCapturePaused({paused,expectedVersion}) {
    if(typeof paused!=='boolean' || typeof expectedVersion!=='string' || !/^(0|[1-9]\d{0,18})$/.test(expectedVersion) || BigInt(expectedVersion)>=9223372036854775807n)
      throw Object.assign(new Error('Pausa o versión inválida.'),{status:400});
    const rows=await execute(`UPDATE camaras SET capturas_pausadas=$2,
      orientacion_version=orientacion_version+CASE WHEN capturas_pausadas<>$2 THEN 1 ELSE 0 END
      WHERE id=$1 AND orientacion_version=$3::bigint RETURNING `+cameraColumns,[CAMERA_ID,paused,expectedVersion]);
    if(!rows.length)throw Object.assign(new Error('Los ajustes cambiaron. Recarga los valores antes de continuar.'),{status:409});
    return rows[0];
  }
  async function saveReading(reading, config) {
    reading = { ...reading, rotation:reading.rotation ?? 180,orientationVersion:reading.orientationVersion ?? '0',roi:reading.roi ?? DEFAULT_ROI };
    for (let attempt = 0; attempt < 5; attempt++) {
      const camera = await readCameraSettings();
      if(camera.paused)throw Object.assign(new Error('Capturas y análisis pausados por el administrador.'),{status:409});
      if (camera.version !== reading.orientationVersion || camera.rotation !== reading.rotation || !sameRoi(camera.roi,reading.roi))
        throw Object.assign(new Error('Los ajustes cambiaron durante el análisis. Espera una nueva captura.'), {status:409});
      const previous = await readVersionedState();
      const next = decide(previous.estado, reading, { ...config, threshold:camera.threshold ?? config.threshold });
      if (next === previous.estado) return previous.estado;
      const rows = await execute(SAVE, [CAMERA_ID, JSON.stringify(next), previous.revision, reading.orientationVersion, reading.rotation]);
      if (rows.length) return rows[0].estado;
    }
    throw new Error('Llegaron demasiadas capturas simultaneas.');
  }
  async function readHistory({ before = null, limit = 50 } = {}) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 250 ||
      (before !== null && (!/^[1-9]\d{0,18}$/.test(before) || BigInt(before) > 9223372036854775807n))) {
      throw Object.assign(new Error('Paginacion invalida.'), { status: 400 });
    }
    const rows = await execute(`
      SELECT id::text AS id, camara_id AS "cameraId",
        (extract(epoch FROM recibido_en) * 1000)::double precision AS "receivedAt",
        conclusion, ARRAY[p_sin_basura, p_botellas, p_papeles_cartones, p_bolsas] AS scores,
        basura_actual AS "trashNow", basura_promedio AS "trashAverage", umbral AS threshold,
        capturas_promedio AS readings, confirmaciones AS streak, analisis_ms AS "analysisMs"
      FROM mediciones
      WHERE camara_id = $1 AND ($2::bigint IS NULL OR id < $2::bigint)
      ORDER BY mediciones.id DESC LIMIT $3`, [CAMERA_ID, before, limit + 1]);
    const entries = rows.slice(0, limit);
    return { entries, nextCursor: rows.length > limit ? entries.at(-1).id : null };
  }
  // Ventana temporal libre. Cada respuesta queda acotada; nunca cargar toda la base en memoria.
  async function readChartHistory({ now = Date.now(), minutes = 15, from = now - minutes * 60000, to = now, after = null, staleMs = 90000 } = {}) {
    if (!Number.isSafeInteger(now) || now <= 0 || !Number.isSafeInteger(from) || !Number.isSafeInteger(to) ||
      from < 0 || from >= to || to > now || !Number.isSafeInteger(staleMs) || staleMs <= 0 ||
      (after !== null && (!/^(0|[1-9]\d{0,18})$/.test(after) || BigInt(after) > 9223372036854775807n)))
      throw Object.assign(new Error('Intervalo o cursor de graficos invalido.'), { status: 400 });
    const limit = 6000;
    const rows = await execute(`SELECT id::text AS id,
      (extract(epoch FROM recibido_en) * 1000)::double precision AS "receivedAt",
      conclusion, ARRAY[p_sin_basura, p_botellas, p_papeles_cartones, p_bolsas] AS scores,
      basura_actual AS "trashNow", basura_promedio AS "trashAverage", umbral AS threshold,
      capturas_promedio AS readings, confirmaciones AS streak
      FROM mediciones WHERE camara_id = $1
      AND recibido_en >= to_timestamp($2::double precision / 1000.0)
      AND recibido_en <= to_timestamp($3::double precision / 1000.0)
      AND ($4::bigint IS NULL OR id > $4::bigint)
      ORDER BY id DESC LIMIT 6001`, [CAMERA_ID, from, to, after]);
    // El limite inicial permite recorrer todos los dias guardados, sin un tope de 24 horas.
    // No repetir esta consulta en cada actualizacion incremental en vivo.
    const extent = after === null ? (await execute(`SELECT
      (extract(epoch FROM min(recibido_en)) * 1000)::double precision AS "earliestAt",
      (extract(epoch FROM max(recibido_en)) * 1000)::double precision AS "latestAt"
      FROM mediciones WHERE camara_id = $1`, [CAMERA_ID]))[0] : null;
    const context = (await execute(`SELECT
      (extract(epoch FROM recibido_en) * 1000)::double precision AS "receivedAt", conclusion
      FROM mediciones WHERE camara_id = $1
      AND recibido_en < to_timestamp($2::double precision / 1000.0)
      AND recibido_en >= to_timestamp($3::double precision / 1000.0)
      ORDER BY recibido_en DESC, id DESC LIMIT 1`, [CAMERA_ID, from, Math.max(0, from - staleMs)]))[0] ?? null;
    return { entries: rows.slice(0, limit).reverse(), cursor: rows[0]?.id ?? after ?? '0',
      from, to, ...(extent ? {earliestAt:extent.earliestAt,latestAt:extent.latestAt} : {}), context, truncated: rows.length > limit, limit };
  }
  async function readChartCoverage({ from, to, now = Date.now() }) {
    if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 0 || from >= to ||
      to > now || to - from > 26 * 3600000)
      throw Object.assign(new Error('Intervalo diario invalido.'), {status:400});
    // Agregar en PostgreSQL, sin cargar fotos ni limitarse a las ultimas 6000 filas.
    const bins = await execute(`SELECT
      floor(((extract(epoch FROM recibido_en) * 1000) - $2::double precision) / 60000)::integer AS index,
      count(*)::integer AS count,
      (extract(epoch FROM min(recibido_en)) * 1000)::double precision AS "firstAt",
      (extract(epoch FROM max(recibido_en)) * 1000)::double precision AS "lastAt",
      max(id)::text AS "lastId"
      FROM mediciones WHERE camara_id = $1
      AND recibido_en >= to_timestamp($2::double precision / 1000.0)
      AND recibido_en < to_timestamp($3::double precision / 1000.0)
      GROUP BY 1 ORDER BY 1`, [CAMERA_ID, from, to]);
    let cursor = '0'; for (const bin of bins) if (BigInt(bin.lastId) > BigInt(cursor)) cursor = bin.lastId;
    return {from,to,bins,cursor,total:bins.reduce((sum,bin)=>sum+bin.count,0),
      firstAt:bins[0]?.firstAt ?? null,lastAt:bins.at(-1)?.lastAt ?? null};
  }
  async function readDecisionTrends({from,to,now=Date.now()}) {
    if(!Number.isSafeInteger(from)||!Number.isSafeInteger(to)||from<0||from>=to||to>now||to-from>26*3600000)
      throw Object.assign(new Error('Intervalo diario inválido.'),{status:400});
    // Un solo snapshot: totales y cambios coinciden incluso si entra otra captura.
    const [row]=await execute(`WITH readings AS (
      SELECT id,recibido_en,conclusion,basura_promedio FROM mediciones
      WHERE camara_id=$1 AND recibido_en>=to_timestamp($2::double precision/1000.0)
      AND recibido_en<to_timestamp($3::double precision/1000.0)
    ), hourly AS (
      SELECT floor((extract(epoch FROM recibido_en)*1000-$2::double precision)/3600000)::integer AS index,
        count(*)::integer AS total,
        count(*) FILTER (WHERE conclusion='Hay basura')::integer AS trash,
        count(*) FILTER (WHERE conclusion='Sin basura')::integer AS clear,
        count(*) FILTER (WHERE conclusion='No seguro')::integer AS unsure
      FROM readings GROUP BY 1
    ), confirmed AS (
      SELECT *,lag(conclusion) OVER (ORDER BY recibido_en,id) AS previous,
        lag(recibido_en) OVER (ORDER BY recibido_en,id) AS previous_at
      FROM readings WHERE conclusion IN ('Hay basura','Sin basura')
    ), changes AS (
      SELECT (extract(epoch FROM recibido_en)*1000)::double precision AS "receivedAt",conclusion,
        CASE WHEN conclusion='Hay basura' THEN basura_promedio ELSE 1-basura_promedio END AS confidence
      FROM confirmed WHERE previous IS DISTINCT FROM conclusion OR recibido_en-previous_at>interval '90 seconds'
      ORDER BY recibido_en DESC,id DESC LIMIT 8
    ) SELECT (SELECT jsonb_agg(to_jsonb(hourly) ORDER BY index) FROM hourly) AS bins,
      (SELECT jsonb_agg(to_jsonb(changes) ORDER BY "receivedAt" DESC) FROM changes) AS events`,[CAMERA_ID,from,to]);
    const bins=row?.bins??[],events=row?.events??[];
    const totals=bins.reduce((sum,b)=>({total:sum.total+b.total,trash:sum.trash+b.trash,clear:sum.clear+b.clear,unsure:sum.unsure+b.unsure}),{total:0,trash:0,clear:0,unsure:0});
    return {from,to,bins,totals,events};
  }
  return { readState, saveReading, readHistory, readChartHistory, readChartCoverage, readDecisionTrends, readCameraSettings, readCameraView, setOrientation, setCameraSettings, setCapturePaused };
}
export const { readState, saveReading, readHistory, readChartHistory, readChartCoverage, readDecisionTrends, readCameraSettings, readCameraView, setOrientation, setCameraSettings, setCapturePaused } = createStore(query);
