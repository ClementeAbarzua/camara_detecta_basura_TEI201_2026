import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { decide, publicState } from '../lib/decision.js';
import { settings } from '../lib/config.js';
import { createStateHandler } from '../api/state.js';
const demo = {threshold:.8,staleMs:90000,decisionProfile:'demo'};
const frame = (seq, scores=[.05,.45,.4,.1]) => ({boot:'0123456789abcdef',seq,receivedAt:seq*5000,scores});

test('Demo: confirma por primera vez con la cuarta foto (15 s desde la primera), sin reaccionar a una sola imagen', () => {
  let state;
  for (let seq=1;seq<=4;seq++) {
    state=decide(state,frame(seq),demo);
    assert.equal(state.conclusion,seq<4?'No seguro':'Hay basura');
  }
  assert.equal(state.history.length,3);assert.equal(state.streak,2);
  const changed=decide(state,frame(5,[.98,.01,.005,.005]),demo);
  assert.notEqual(changed.conclusion,'Sin basura');
  let next=changed;
  for(let seq=6;seq<=8;seq++) next=decide(next,frame(seq,[.98,.01,.005,.005]),demo);
  assert.equal(next.conclusion,'Sin basura');assert.equal(next.streak,2);
});

test('Cambiar de perfil reinicia solo la ventana, y stable conserva la confirmacion original en cinco fotos', () => {
  const stable={...demo,decisionProfile:'stable'};let old;
  for(let seq=1;seq<=5;seq++) {old=decide(old,frame(seq),stable);assert.equal(old.conclusion,seq<5?'No seguro':'Hay basura');}
  assert.equal(old.history.length,5);assert.equal(old.streak,3);
  let state=decide(old,frame(6),demo);assert.equal(state.history.length,1);assert.equal(state.streak,0);
  for(let seq=7;seq<=9;seq++)state=decide(state,frame(seq),demo);
  assert.equal(state.conclusion,'Hay basura');
  const rollback=decide(state,frame(10),stable);assert.equal(rollback.history.length,1);assert.equal(rollback.conclusion,'No seguro');
  const legacy={...old};delete legacy.decisionProfile;
  assert.equal(decide(legacy,frame(6),stable).history.length,5);
  assert.equal(publicState(legacy,90000,legacy.receivedAt).state.confirmationsRequired,3);
  assert.equal(publicState(state,90000,state.receivedAt).state.confirmationsRequired,2);
  assert.equal(decide(state,frame(9),demo),state); // Repetir no suma confirmaciones.
});

test('Perfil de prueba predeterminado, restauracion por variable y rechazo de perfiles invalidos', () => {
  const previous=process.env.DETECTION_PROFILE;
  try {
    delete process.env.DETECTION_PROFILE;assert.equal(settings().decisionProfile,'demo');
    process.env.DETECTION_PROFILE='stable';assert.equal(settings().decisionProfile,'stable');
    process.env.DETECTION_PROFILE='incorrecto';assert.throws(()=>settings(),/DETECTION_PROFILE/);
  } finally {if(previous===undefined)delete process.env.DETECTION_PROFILE;else process.env.DETECTION_PROFILE=previous;}
});

test('La web informa el perfil y espera una captura nueva si el estado anterior usa otra regla', async () => {
  const previous=process.env.DETECTION_PROFILE;process.env.DETECTION_PROFILE='demo';
  try {
    let state;
    for(let seq=1;seq<=5;seq++)state=decide(state,{...frame(seq),receivedAt:Date.now()+seq},{...demo,decisionProfile:'stable'});
    const handler=createStateHandler(async()=>({camera:{rotation:180,version:'0'},state}));
    async function read(){let result;await handler({method:'GET'},{setHeader(){},end(text){result=JSON.parse(text);}});return result;}
    const old=await read();assert.equal(old.policyPending,true);assert.equal(old.state.conclusion,'No seguro');
    assert.equal(old.decision.windowSize,3);assert.equal(old.decision.confirmationsRequired,2);
    for(let seq=6;seq<=9;seq++)state=decide(state,{...frame(seq),receivedAt:Date.now()+seq},demo);
    const next=await read();assert.equal(next.policyPending,false);assert.equal(next.state.confirmationsRequired,2);
  } finally {if(previous===undefined)delete process.env.DETECTION_PROFILE;else process.env.DETECTION_PROFILE=previous;}
});

test('Planificador C++ de la XIAO: descuenta el trabajo de los 5 s, tolera sobretiempo y restaura la pausa estable', async t => {
  try { execFileSync('g++',['--version'],{stdio:'ignore'}); }
  catch(error) { if(error.code==='ENOENT'){t.skip('Requiere g++ para comprobar el helper del firmware.');return;} throw error; }
  const dir=await mkdtemp(join(tmpdir(),'xiao-schedule-'));
  try {
    const header=new URL('../../firmware/XIAO_Remota/capture-schedule.h',import.meta.url).pathname;
    const source=`#include <cassert>\n#include "${header}"\nint main(){
      assert(capturePauseMs(true,true,5000,1000)==4000);
      assert(capturePauseMs(true,true,5000,4999)==1);
      assert(capturePauseMs(true,true,5000,5000)==0);
      assert(capturePauseMs(true,true,5000,7000)==0);
      assert(capturePauseMs(true,false,15000,1000)==15000);
      assert(capturePauseMs(false,true,5000,1000)==30000);
      assert(capturePauseMs(false,false,45000,1000)==45000);
      uint32_t begin=0xfffffff0U, end=begin+1000U;
      assert(capturePauseMs(true,true,5000,end-begin)==4000);
    }`;
    await writeFile(join(dir,'check.cpp'),source);
    execFileSync('g++',['-std=c++11','-Wall','-Wextra','-Werror',join(dir,'check.cpp'),'-o',join(dir,'check')]);
    execFileSync(join(dir,'check'));
  } finally {await rm(dir,{recursive:true,force:true});}
});
