import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import sharp from 'sharp';
import { createServer } from '../lib/http-server.js';
import { createStore } from '../lib/store.js';
import { createIngestHandler } from '../api/ingest.js';
import { createStateHandler } from '../api/state.js';
import { createHistoryHandler } from '../api/history.js';
import { createChartHistoryHandler } from '../api/chart-history.js';
import { createChartCoverageHandler } from '../api/chart-coverage.js';
import {createDecisionTrendsHandler} from '../api/decision-trends.js';
import { classify } from '../lib/model.js';

test('Servidor HTTP: foto real, modelo, PostgreSQL, autenticacion, historial y salud', async () => {
  process.env.CAMERA_TOKEN='test-camera-token-'.repeat(3);
  process.env.DASHBOARD_PASSWORD='test-dashboard-password';
  process.env.SESSION_SECRET='test-session-secret-'.repeat(3);
  process.env.NODE_ENV='production';
  const db = new PGlite(); let app;
  try {
    await db.exec(await readFile(new URL('../database/schema.sql',import.meta.url),'utf8'));
    const store = createStore(async(sql,params)=>(await db.query(sql,params)).rows);
    let healthy = true;
    const routes = {'/api/ingest':createIngestHandler(classify,store.saveReading,store.readCameraSettings),
      '/api/state':createStateHandler(store.readCameraView),'/api/history':createHistoryHandler(store.readHistory),
      '/api/chart-history':createChartHistoryHandler(store.readChartHistory),'/api/chart-coverage':createChartCoverageHandler(store.readChartCoverage),'/api/decision-trends':createDecisionTrendsHandler(store.readDecisionTrends)};
    app=createServer({routes,health:async()=>{if(!healthy)throw new Error('test-health');await db.query('SELECT 1');}});
    await new Promise((resolve,reject)=>{app.server.once('error',reject);app.server.listen(0,'127.0.0.1',resolve);});
    const base='http://127.0.0.1:'+app.server.address().port;
    const request=(path,options)=>fetch(base+path,options);
    assert.equal((await request('/healthz')).status,200);
    const page=await request('/');const pageText=await page.text();assert.match(pageText,/Monitor de basura/);
    for(const id of ['chartDate','decisionChart','coverageChart','chartSessions','lastAvailableChart'])assert.ok(pageText.includes(`id="${id}"`));
    assert.match(pageText,/data-chart-minutes="5"/);
    assert.ok(page.headers.get('content-security-policy'));
    for(const path of ['/model/weights.bin','/.env','/server.js','/../package.json'])assert.equal((await request(path)).status,404);
    assert.equal((await request('/api/state')).status,200);
    assert.equal((await request('/api/history')).status,200);
    assert.equal((await request('/api/chart-history')).status,200);
    for(const path of ['/admin','/admin/','/admin.js','/admin.css','/charts.js','/chart-overview.js','/chart-data.js','/charts.css']) assert.equal((await request(path)).status,200);
    for(const path of ['/dashboard.css','/dashboard-data.js','/dashboard-live.js','/decision-trends.js'])assert.equal((await request(path)).status,200);
    for(const id of ['decisionBadge','decisionAction','toggleAlertSound','decisionTrends','hourlyTrends','trendEvents'])assert.ok(pageText.includes(`id="${id}"`));
    assert.equal((await request('/api/ingest',{method:'POST'})).status,401);
    for(const path of ['/api/export.json','/api/export.csv','/history-format.js']) assert.equal((await request(path)).status,404);
    assert.doesNotMatch(await(await request('/')).text(),/type="password"|Descargar|exportJSON|exportHistory/);
    const cookie='xiao_session=sesion-anterior';
    const jpeg=await sharp({create:{width:800,height:600,channels:3,background:'#8f7357'}}).jpeg().toBuffer();
    for(let seq=1;seq<=5;seq++){
      const result=await request('/api/ingest',{method:'POST',headers:{authorization:'Bearer '+process.env.CAMERA_TOKEN,
        'content-type':'image/jpeg','x-camera-boot':'0123456789abcdef','x-frame-seq':String(seq)},body:jpeg});
      assert.equal(result.status,200,await result.text());
    }
    const state=await(await request('/api/state',{headers:{cookie}})).json();
    assert.equal(state.canManageCamera,false);assert.equal(state.online,true);assert.equal(state.state.scores.length,4);assert.equal(state.state.readings,3);
    assert.equal(state.state.decisionProfile,'demo');assert.equal(state.decision.confirmationsRequired,2);
    const publicState=await(await request('/api/state')).json();assert.equal(publicState.canManageCamera,false);assert.equal(publicState.state.scores.length,4);
    const history=await(await request('/api/history?limit=2')).json();
    assert.equal(history.entries.length,2);assert.ok(history.nextCursor);
    const graph=await(await request('/api/chart-history?minutes=15')).json();
    assert.equal(graph.entries.length,5);assert.equal(graph.entries[0].scores.length,4);
    const now=Date.now(),summary=await(await request(`/api/chart-coverage?from=${now-3600000}&to=${now}`)).json();
    const trends=await(await request(`/api/decision-trends?from=${now-3600000}&to=${now}`)).json();
    assert.equal(trends.totals.total,5);assert.equal(trends.totals.trash+trends.totals.clear+trends.totals.unsure,5);
    assert.ok(Array.isArray(trends.events));assert.ok(!JSON.stringify(trends).includes('preview'));
    assert.equal(summary.total,5);assert.equal(summary.bins[0].preview,undefined);
    assert.equal(Number((await db.query('SELECT count(*) AS n FROM mediciones')).rows[0].n),5);
    healthy=false;assert.equal((await request('/healthz')).status,503);
    assert.equal((await request('/api/logout',{method:'POST',headers:{cookie}})).status,405);
    app.drain();assert.equal((await request('/healthz')).status,503);
  } finally {
    if(app)await new Promise(resolve=>{app.server.close(resolve);app.server.closeAllConnections();});
    await db.close();
  }
});

test('Recepcion limita analisis simultaneos sin acumular imagenes', async()=>{
  let release,entered; const waiting=new Promise(resolve=>{entered=resolve;});
  const gate=new Promise(resolve=>{release=resolve;});
  const app=createServer({health:async()=>{},routes:{'/api/ingest':async(req,res)=>{entered();await gate;res.end('ok');}}});
  try{
    await new Promise((resolve,reject)=>{app.server.once('error',reject);app.server.listen(0,'127.0.0.1',resolve);});
    const url='http://127.0.0.1:'+app.server.address().port+'/api/ingest';
    const first=fetch(url,{method:'POST'});await waiting;
    const second=await fetch(url,{method:'POST'});assert.equal(second.status,429);assert.equal(second.headers.get('retry-after'),'15');
    release();assert.equal((await first).status,200);
  }finally{release();await new Promise(resolve=>{app.server.close(resolve);app.server.closeAllConnections();});}
});
