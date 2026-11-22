// Exportación consistente, por lotes: no carga todo el historial en memoria.
export const EXPORT_COLUMNS=['id','camara_id','recibido_en','arranque','secuencia','conclusion','p_sin_basura','p_botellas','p_papeles_cartones','p_bolsas','basura_actual','basura_promedio','umbral','capturas_promedio','confirmaciones','analisis_ms'];
const SELECT=`SELECT id::text AS id, camara_id,
  to_char(recibido_en AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS recibido_en,
  arranque,secuencia::text AS secuencia,conclusion,p_sin_basura,p_botellas,p_papeles_cartones,p_bolsas,
  basura_actual,basura_promedio,umbral,capturas_promedio,confirmaciones,analisis_ms
  FROM public.mediciones WHERE id>$1::bigint
  AND ($3::double precision IS NULL OR recibido_en>=to_timestamp($3::double precision/1000))
  AND ($4::double precision IS NULL OR recibido_en<to_timestamp($4::double precision/1000))
  ORDER BY mediciones.id LIMIT $2`;
const csv=value=>{const text=value===null||value===undefined?'':String(value);return /[",\r\n]/.test(text)?'"'+text.replaceAll('"','""')+'"':text;};
export async function* databaseExport(pool,{format='json',from=null,to=null,signal,batchSize=500}={}){
  const client=await pool.connect();let open=false;
  try{
    signal?.throwIfAborted();await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');open=true;
    if(format==='json'){
      const cameras=(await client.query(`SELECT to_jsonb(c)||jsonb_build_object('orientacion_version',c.orientacion_version::text) AS row FROM public.camaras c ORDER BY id`)).rows.map(r=>r.row);
      const states=(await client.query(`SELECT to_jsonb(e)||jsonb_build_object('revision',e.revision::text) AS row FROM public.estado_camara e ORDER BY camara_id`)).rows.map(r=>r.row);
      const metadata={format:'xiao-database',version:1,exportedAt:new Date().toISOString(),filter:{from,to}};
      yield JSON.stringify(metadata).slice(0,-1)+',"tables":{"camaras":'+JSON.stringify(cameras)+',"estado_camara":'+JSON.stringify(states)+',"mediciones":[';
    }else yield '\ufeff'+EXPORT_COLUMNS.join(',')+'\r\n';
    let cursor='0',first=true;
    for(;;){
      signal?.throwIfAborted();
      const {rows}=await client.query(SELECT,[cursor,batchSize,from,to]);
      if(!rows.length)break;
      for(const row of rows){
        signal?.throwIfAborted();
        yield format==='json'?(first?'':',')+JSON.stringify(row):EXPORT_COLUMNS.map(k=>csv(row[k])).join(',')+'\r\n';
        first=false;
      }
      cursor=rows.at(-1).id;
    }
    if(format==='json')yield ']}}\n';
    await client.query('COMMIT');open=false;
  }finally{
    if(open)await client.query('ROLLBACK').catch(()=>{});
    client.release();
  }
}
