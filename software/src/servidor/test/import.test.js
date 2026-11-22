import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createStore } from '../lib/store.js';
import { importHistory } from '../lib/import-history.js';

test('Importacion PostgreSQL conserva datos, ids y estado; rechaza destinos ocupados y revierte fallos', async () => {
  const source = new PGlite(), target = new PGlite(), rollback = new PGlite();
  try {
    const schema = await readFile(new URL('../database/schema.sql', import.meta.url), 'utf8');
    for (const db of [source,target,rollback]) await db.exec(schema);
    const store = db => createStore(async (sql, params) => (await db.query(sql, params)).rows);
    const frame = seq => ({ boot:'0123456789abcdef', seq, receivedAt:1700000000000+seq*15000,
      scores:[.05,.45,.4,.1],preview:'miniatura',analysisMs:120 });
    const config = { threshold:.8,staleMs:90000 };
    // El montaje ya usa 180 grados desde la creacion.
    // Mas de un lote: verifica paginacion de la copia y continuidad de identidad.
    for(let i=1;i<=253;i++) await store(source).saveReading({...frame(i),rotation:180,orientationVersion:'0'},config);
    const result = await importHistory(source,target);
    assert.deepEqual(result,{cameras:1,measurements:253,states:1});
    assert.deepEqual(await store(target).readState(),await store(source).readState());
    assert.deepEqual(await store(target).readCameraSettings(),{rotation:180,version:'0',threshold:null,paused:false,roi:{centerX:.5,centerY:.5,size:1}});
    assert.deepEqual(await target.query('SELECT * FROM mediciones ORDER BY id'),await source.query('SELECT * FROM mediciones ORDER BY id'));
    await store(target).saveReading({...frame(254),rotation:180,orientationVersion:'0'},config);
    assert.equal((await store(target).readHistory()).entries[0].id,'254');
    await assert.rejects(importHistory(source,target),/destino ya contiene/);
    assert.equal(Number((await target.query('SELECT count(*) AS n FROM mediciones')).rows[0].n),254);
    const ids=[];let cursor=null;
    do {
      const page=await store(target).readHistory({before:cursor,limit:50});
      ids.push(...page.entries.map(row=>row.id));cursor=page.nextCursor;
    }while(cursor);
    assert.deepEqual(ids,Array.from({length:254},(_,i)=>String(254-i)));
    let inserted = 0;
    const fault = {query:async(sql,params)=>{
      if(sql.startsWith('INSERT INTO mediciones') && ++inserted === 2) throw new Error('Fallo durante la copia');
      return rollback.query(sql,params);
    }};
    await assert.rejects(importHistory(source,fault),/Fallo durante la copia/);
    assert.equal(Number((await rollback.query('SELECT count(*) AS n FROM mediciones')).rows[0].n),0);
    assert.equal(Number((await source.query('SELECT count(*) AS n FROM mediciones')).rows[0].n),253);
  } finally {await Promise.all([source.close(),target.close(),rollback.close()]);}
});
