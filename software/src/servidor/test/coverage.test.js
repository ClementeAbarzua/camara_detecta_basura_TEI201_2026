import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createStore} from '../lib/store.js';
import {createChartCoverageHandler} from '../api/chart-coverage.js';
import {coverageSessions,nearestCoverageTimestamp,extendCoverage} from '../public/chart-data.js';

test('Mapa diario: resumen completo con mas de 6000 registros, sin fotos y sin incluir la medianoche siguiente',async()=>{
  const db=new PGlite(),from=1700006400000,to=1700092800000;
  try{
    await db.exec(await readFile(new URL('../database/schema.sql',import.meta.url),'utf8'));
    await db.query(`INSERT INTO mediciones(camara_id,recibido_en,arranque,secuencia,conclusion,p_sin_basura,p_botellas,p_papeles_cartones,p_bolsas,basura_actual,basura_promedio,umbral,capturas_promedio,confirmaciones,analisis_ms)
      SELECT 'camara-1',to_timestamp(($1::double precision+n*5000)/1000),'0123456789abcdef',n,'Hay basura',.1,.3,.3,.3,.9,.9,.8,3,2,25 FROM generate_series(1,6205) AS n`,[from]);
    await db.query(`INSERT INTO mediciones(camara_id,recibido_en,arranque,secuencia,conclusion,p_sin_basura,p_botellas,p_papeles_cartones,p_bolsas,basura_actual,basura_promedio,umbral,capturas_promedio,confirmaciones,analisis_ms)
      VALUES('camara-1',to_timestamp($1::double precision/1000),'0123456789abcdef',6206,'Hay basura',.1,.3,.3,.3,.9,.9,.8,3,2,25)`,[to]);
    const store=createStore(async(sql,params)=>(await db.query(sql,params)).rows);
    const summary=await store.readChartCoverage({from,to,now:to+1000});
    assert.equal(summary.total,6205);assert.equal(summary.firstAt,from+5000);assert.equal(summary.lastAt,from+6205*5000);
    assert.equal(summary.bins.length,518);assert.equal(summary.cursor,'6205');assert.equal(summary.bins[0].count,11);
    assert.ok(summary.bins.every(bin=>bin.lastAt<to && !('scores' in bin) && !('preview' in bin)));
    const graph=await store.readChartHistory({from,to,now:to+1000});assert.equal(graph.entries.length,6000);assert.equal(graph.truncated,true);
    assert.equal(graph.latestAt,to);
    await assert.rejects(store.readChartCoverage({from,to:to+10000000,now:to+10000000}),e=>e.status===400);
  }finally{await db.close();}
});

test('API del mapa: solo lectura, fechas validas, sin consultas enormes o futuras',async()=>{
  let calls=0;const now=1700100000000;
  const handler=createChartCoverageHandler(async query=>{calls++;return{...query,bins:[],total:0,cursor:'0'};},()=>now);
  const request=async(url,method='GET')=>{let data;const res={setHeader(){},end(text){data=JSON.parse(text);}};await handler({method,url},res);return{status:res.statusCode,data};};
  for(const query of ['', 'from=1', 'from=10&to=1','from=-1&to=10','from=1&to=99999999999999999','from=1&to=100000000','from=1e3&to=2000',`from=${now-10}&to=${now+1}`])
    assert.equal((await request('/api/chart-coverage?'+query)).status,400);
  assert.equal((await request('/api/chart-coverage','POST')).status,405);assert.equal(calls,0);
  const result=await request(`/api/chart-coverage?from=${now-86400000}&to=${now}`);assert.equal(result.status,200);assert.equal(calls,1);
});

test('Marcas permanentes: separan tramos, encuentran tiempos reales y agregan IDs grandes sin duplicarlos',()=>{
  const bins=[{index:0,count:2,firstAt:1000,lastAt:10000,lastId:'9007199254740993'},
    {index:1,count:1,firstAt:70000,lastAt:70000,lastId:'9007199254740994'},
    {index:60,count:1,firstAt:3600000,lastAt:3600000,lastId:'9007199254740995'}];
  assert.deepEqual(coverageSessions(bins),[{from:1000,to:70000,count:3},{from:3600000,to:3600000,count:1}]);
  assert.equal(nearestCoverageTimestamp(bins,3500000),3600000);assert.equal(nearestCoverageTimestamp([],0),null);
  const coverage={bins,cursor:'9007199254740995',total:4,firstAt:1000,lastAt:3600000};
  const row={id:'9007199254740996',receivedAt:3605000};
  const next=extendCoverage(coverage,[row,row,{id:'9007199254740995',receivedAt:3600000},{id:'9007199254740997',receivedAt:86400000}],{from:0,to:86400000});
  assert.equal(next.total,5);assert.equal(next.cursor,row.id);assert.equal(next.bins[2].count,2);
  assert.equal(extendCoverage(next,[row],{from:0,to:86400000}).total,5);
  assert.equal(coverage.total,4);assert.equal(bins[2].count,1);
});
