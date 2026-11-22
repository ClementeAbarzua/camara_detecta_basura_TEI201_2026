import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createStore} from '../lib/store.js';
import {createDecisionTrendsHandler} from '../api/decision-trends.js';
import {trendHours,peakTrashHour,decisionPresentation,createDecisionAlertTracker} from '../public/dashboard-data.js';
import {localDayBounds} from '../public/chart-data.js';

test('Tendencias SQL: todas las mediciones, categorías separadas, un solo snapshot y cambios confirmados',async()=>{
  const db=new PGlite(),from=1700006400000,to=from+86400000;
  try{
    await db.exec(await readFile(new URL('../database/schema.sql',import.meta.url),'utf8'));
    await db.query(`INSERT INTO mediciones(camara_id,recibido_en,arranque,secuencia,conclusion,p_sin_basura,p_botellas,p_papeles_cartones,p_bolsas,basura_actual,basura_promedio,umbral,capturas_promedio,confirmaciones,analisis_ms)
      SELECT 'camara-1',to_timestamp(($1::double precision+n*5000)/1000),'0123456789abcdef',n,'Hay basura',.1,.3,.3,.3,.9,.9,.8,3,2,25 FROM generate_series(1,6205) n`,[from]);
    for(const[conclusion,offset,count,seq]of [['Sin basura',9*3600000,100,7000],['No seguro',10*3600000,50,7200],['Hay basura',86400000,1,8000]]){
      await db.query(`INSERT INTO mediciones(camara_id,recibido_en,arranque,secuencia,conclusion,p_sin_basura,p_botellas,p_papeles_cartones,p_bolsas,basura_actual,basura_promedio,umbral,capturas_promedio,confirmaciones,analisis_ms)
        SELECT 'camara-1',to_timestamp(($1::double precision+$2::double precision+(n-1)*1000)/1000),'0123456789abcdef',$4::integer+n,$3,.1,.3,.3,.3,.9,CASE WHEN $3='Sin basura' THEN .1 ELSE .9 END,.8,3,2,25 FROM generate_series(1,$5::integer) n`,[from,offset,conclusion,seq,count]);
    }
    let calls=0;const store=createStore(async(sql,args)=>{calls++;return(await db.query(sql,args)).rows;});
    const data=await store.readDecisionTrends({from,to,now:to+1});
    assert.equal(calls,1);assert.deepEqual(data.totals,{total:6355,trash:6205,clear:100,unsure:50});
    assert.equal(data.bins[0].total,719);assert.equal(data.bins.find(b=>b.index===9).clear,100);
    assert.equal(data.events.length,2);assert.equal(data.events[0].conclusion,'Sin basura');assert.equal(data.events[0].confidence,.9);
    assert.ok(data.events.every(e=>e.receivedAt<to&&!('preview'in e)));assert.ok(!JSON.stringify(data).includes('scores'));
    const hours=trendHours(data,{from,to},to);assert.equal(hours.length,24);assert.equal(hours[20].total,0);assert.equal(hours[20].future,false);assert.ok(peakTrashHour(hours).trash>0);
    const empty=await store.readDecisionTrends({from:to+1,to:to+1000,now:to+1000});assert.equal(empty.totals.total,0);assert.deepEqual(empty.events,[]);
  }finally{await db.close();}
});

test('API de tendencias: intervalo diario acotado, fechas futuras rechazadas y solo lectura',async()=>{
  let calls=0;const now=1700100000000,handler=createDecisionTrendsHandler(async args=>{calls++;return{...args,bins:[],totals:{total:0},events:[]};},()=>now);
  const request=async(url,method='GET')=>{let data;const res={setHeader(){},end(s){data=JSON.parse(s);}};await handler({method,url},res);return{status:res.statusCode,data};};
  for(const p of ['', 'from=1','from=20&to=10','from=-1&to=10','from=1e3&to=3000','from=0&to=99999999999999999',`from=${now+1}&to=${now+100}`,`from=${now-27*3600000}&to=${now}`])assert.equal((await request('/api/decision-trends?'+p)).status,400);
  assert.equal((await request('/api/decision-trends','POST')).status,405);assert.equal(calls,0);
  assert.equal((await request(`/api/decision-trends?from=${now-86400000}&to=${now}`)).status,200);assert.equal(calls,1);
  const today=await request(`/api/decision-trends?from=${now-3600000}&to=${now+3600000}`);assert.equal(today.status,200);assert.equal(today.data.to,now);
});

test('Las tendencias distinguen horas vacías, futuras y los días de 23 o 25 horas',()=>{
  const prior=process.env.TZ;process.env.TZ='America/New_York';
  try{
    for(const[key,length]of [['2026-03-08',23],['2026-11-01',25]]){
      const day=localDayBounds(key),hours=trendHours({bins:[]},day,day.to);assert.equal(hours.length,length);assert.ok(hours.every(h=>h.total===0&&!h.future));
      if(length===25)assert.equal(hours.filter(h=>new Date(h.from).getHours()===1).length,2);
    }
    const day=localDayBounds('2026-11-02'),hours=trendHours({bins:[]},day,day.from+1800000);assert.equal(hours[0].future,false);assert.equal(hours[1].future,true);assert.equal(peakTrashHour(hours),null);
  }finally{if(prior===undefined)delete process.env.TZ;else process.env.TZ=prior;}
});

test('La presentación y los avisos nunca confunden pausa, falta de datos o incertidumbre con un resultado confirmado',()=>{
  const state={receivedAt:1000,conclusion:'Hay basura'};
  assert.equal(decisionPresentation({state,fresh:false}).kind,'offline');assert.equal(decisionPresentation({state,fresh:true,paused:true}).kind,'paused');
  assert.equal(decisionPresentation({state,fresh:true,pending:true}).kind,'pending');assert.equal(decisionPresentation({state,fresh:true,error:true}).kind,'offline');
  assert.equal(decisionPresentation({state:{...state,conclusion:'No seguro'},fresh:true}).kind,'unsure');
  const alerts=createDecisionAlertTracker();assert.equal(alerts.observe(state,'trash'),null);assert.equal(alerts.observe(state,'trash'),null);
  alerts.observe({...state,receivedAt:2000,conclusion:'No seguro'},'unsure');assert.equal(alerts.observe({...state,receivedAt:1500,conclusion:'Sin basura'},'clear'),null);
  assert.equal(alerts.observe({...state,receivedAt:3000,conclusion:'Sin basura'},'clear').kind,'clear');assert.equal(alerts.observe({...state,receivedAt:4000,conclusion:'Sin basura'},'clear'),null);
  const first=createDecisionAlertTracker();first.observe({...state,conclusion:'No seguro'},'unsure');assert.equal(first.observe({...state,receivedAt:2000},'trash').kind,'trash');
});
