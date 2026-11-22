import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {databaseExport,EXPORT_COLUMNS} from '../lib/database-export.js';
import {createAdminExportHandler,exportOptions} from '../api/admin-export.js';
import {createAdminAuth} from '../lib/admin-auth.js';
import {createAdminHandlers} from '../api/admin.js';
import {createServer} from '../lib/http-server.js';
const collect=async generator=>{let result='';for await(const piece of generator)result+=piece;return result;};

test('Exportación por lotes: JSON fiel, BIGINT, precisión temporal, CSV y filtro exclusivo de término',async()=>{
  const db=new PGlite();let releases=0,rollbacks=0;
  const pool={connect:async()=>({query:async(sql,args)=>{if(sql==='ROLLBACK')rollbacks++;return db.query(sql,args);},release(){releases++;}})};
  try{
    await db.exec(await readFile(new URL('../database/schema.sql',import.meta.url),'utf8'));
    await db.query('UPDATE camaras SET nombre=$1,orientacion_version=9007199254740993',[`Cámara, "principal"\nnorte`]);
    await db.exec(`INSERT INTO estado_camara(camara_id,revision,estado) VALUES('camara-1',9007199254740993,'{"history":[0.9],"preview":"jpeg"}');
      INSERT INTO mediciones(camara_id,recibido_en,arranque,secuencia,conclusion,p_sin_basura,p_botellas,p_papeles_cartones,p_bolsas,basura_actual,basura_promedio,umbral,capturas_promedio,confirmaciones,analisis_ms)
      SELECT 'camara-1','2026-11-20 00:00:00.123456+00'::timestamptz+i*interval '1 hour','0123456789abcdef',9007199254740993+i,'Hay basura',.1,.4,.3,.2,.9,.9,.8,3,2,377 FROM generate_series(0,22) i;
      ALTER TABLE mediciones ALTER COLUMN id RESTART WITH 9007199254740993;
      INSERT INTO mediciones(camara_id,recibido_en,arranque,secuencia,conclusion,p_sin_basura,p_botellas,p_papeles_cartones,p_bolsas,basura_actual,basura_promedio,umbral,capturas_promedio,confirmaciones,analisis_ms)
      VALUES('camara-1','2026-11-21 00:00:00+00','0123456789abcdef',77,'No seguro',.1,.4,.3,.2,.9,.9,.8,1,0,1);`);
    const data=JSON.parse(await collect(databaseExport(pool,{batchSize:2})));
    assert.equal(data.format,'xiao-database');assert.equal(data.version,1);assert.equal(data.tables.camaras[0].nombre,`Cámara, "principal"\nnorte`);
    assert.equal(data.tables.camaras[0].orientacion_version,'9007199254740993');assert.equal(data.tables.estado_camara[0].revision,'9007199254740993');
    assert.equal(data.tables.mediciones.length,24);
    assert.deepEqual(data.tables.mediciones.map(r=>r.id),[...Array.from({length:23},(_,i)=>String(i+1)),'9007199254740993']);
    assert.equal(data.tables.mediciones[0].secuencia,'9007199254740993');assert.equal(data.tables.mediciones[0].recibido_en,'2026-11-20T00:00:00.123456Z');
    assert.equal(data.tables.mediciones[0].p_papeles_cartones,.3);assert.equal(data.tables.mediciones[0].analisis_ms,377);
    const from=Date.parse('2026-11-20T00:00:00Z'),to=Date.parse('2026-11-21T00:00:00Z');
    const csv=await collect(databaseExport(pool,{format:'csv',from,to,batchSize:3}));
    assert.equal(csv.charCodeAt(0),0xfeff);assert.equal(csv.split('\r\n')[0].slice(1),EXPORT_COLUMNS.join(','));assert.equal(csv.split('\r\n').length,25);
    assert.doesNotMatch(csv,/2026-11-21/);assert.match(csv,/9007199254740993/);
    const empty=JSON.parse(await collect(databaseExport(pool,{from:to,to:to+1,batchSize:2})));assert.equal(empty.tables.mediciones.length,1);
    const controller=new AbortController(),iterator=databaseExport(pool,{signal:controller.signal});
    await iterator.next();controller.abort();await assert.rejects(iterator.next());assert.equal(rollbacks,1);assert.equal(releases,4);
  }finally{await db.close();}
});

test('Parámetros de exportación: formato y fechas validados sin SQL interpolado',()=>{
  assert.deepEqual(exportOptions('/api/admin/export'),{format:'json',from:null,to:null});
  for(const query of ['format=sql','format=json&format=csv','from=1','from=2&to=1','from=0&to=9999999999999999','from=NaN&to=5','table=users','from=0%3BDROP&to=7'])assert.throws(()=>exportOptions('/api/admin/export?'+query),e=>e.status===400);
});

test('Descarga HTTP: privada, revocable, una a la vez, sin exportaciones públicas',async()=>{
  let app,allowed=true,finish,released=0,poolCalls=0;
  const password='export-test-password',auth=createAdminAuth({readCredentials:()=>({password,secret:'export-test-secret-'.repeat(3)}),production:()=>false});
  const generate=async function*(){try{yield '{"ok":true';await new Promise(r=>{finish=r;});yield '}';}finally{released++;}};
  try{
    const handler=createAdminExportHandler({auth,pool:()=>{poolCalls++;return {};},generate});
    const routes={'/api/admin/export':handler};
    for(const[name,h]of Object.entries(createAdminHandlers({auth})))routes['/api/admin/'+name]=h;
    app=createServer({routes,health:async()=>{}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
    const base='http://127.0.0.1:'+app.server.address().port;
    for(const headers of [{},{authorization:'Bearer camera'},{cookie:'xiao_session=old'}])assert.equal((await fetch(base+'/api/admin/export',{headers})).status,401);
    assert.equal(poolCalls,0);
    for(const path of ['/api/export.json','/api/export.csv'])assert.equal((await fetch(base+path)).status,404);
    const login=await fetch(base+'/api/admin/login',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({password})});const session=await login.json();
    const headers={cookie:login.headers.get('set-cookie').split(';')[0]};
    assert.equal((await fetch(base+'/api/admin/export?format=sql',{headers})).status,400);
    const first=await fetch(base+'/api/admin/export',{headers});assert.equal(first.status,200);assert.match(first.headers.get('content-disposition'),/attachment.*\.json/);assert.match(first.headers.get('cache-control'),/private, no-store/);
    assert.equal((await fetch(base+'/api/admin/export',{headers})).status,429);
    finish();assert.deepEqual(await first.json(),{ok:true});assert.equal(released,1);
    const second=await fetch(base+'/api/admin/export',{headers});
    await fetch(base+'/api/admin/logout',{method:'POST',headers:{...headers,origin:base,'content-type':'application/json','x-csrf-token':session.csrfToken},body:'{}'});
    finish();await assert.rejects(second.text());assert.equal(released,2);
    assert.equal((await fetch(base+'/api/admin/export',{headers})).status,401);
  }finally{finish?.();if(app)await new Promise(r=>{app.server.close(r);app.server.closeAllConnections();});}
});
