import {test} from 'node:test';
import assert from 'node:assert/strict';
import {decide,publicState,decisionPolicy} from '../lib/decision.js';
import {decisionProgress} from '../public/decision-progress.js';
const config={threshold:.8,staleMs:90000,decisionProfile:'demo'};
const frame=(seq,scores=[.05,.45,.4,.1])=>({boot:'0123456789abcdef',seq,receivedAt:seq*5000,scores});
const show=(state,extra={})=>decisionProgress({state:state?publicState(state,90000,state.receivedAt).state:null,online:!!state,policy:decisionPolicy('demo'),...extra});

test('Avance real: reunir 3 capturas, confirmar en la cuarta y reiniciar confirmaciones al cambiar la evidencia',()=>{
  let state;assert.equal(show().phase,'waiting');
  for(let seq=1;seq<=4;seq++){
    state=decide(state,frame(seq),config);const p=show(state);
    assert.equal(p.phase,seq<3?'collecting':seq===3?'confirming':'confirmed');
    assert.equal(p.samples,Math.min(seq,3));assert.equal(p.confirmations,seq<3?0:seq-2);
  }
  assert.equal(show(state).target,'Hay basura');
  for(let seq=5;seq<=8;seq++){
    state=decide(state,frame(seq,[.98,.01,.005,.005]),config);const p=show(state);
    if(seq<=6){assert.equal(p.phase,'uncertain');assert.equal(p.confirmations,0);}
    if(seq===7){assert.equal(p.phase,'confirming');assert.equal(p.target,'Sin basura');assert.equal(p.confirmations,1);}
    if(seq===8){assert.equal(p.phase,'confirmed');assert.equal(p.target,'Sin basura');}
  }
  assert.equal(show(state,{online:false}).phase,'stale');assert.equal(show(state,{online:false}).confirmations,0);
  assert.equal(show(state,{configurationPending:true}).samples,0);
  assert.equal(show(state,{configurationPending:true}).phase,'waiting');
});

test('El perfil estable usa 3 confirmaciones y un cambio de zona vuelve a reunir capturas',()=>{
  let state;
  for(let seq=1;seq<=5;seq++)state=decide(state,frame(seq),{...config,decisionProfile:'stable'});
  const p=show(state,{policy:decisionPolicy('stable')});assert.equal(p.phase,'confirmed');assert.equal(p.requiredConfirmations,3);
  const changed=decide(state,{...frame(6),roi:{centerX:.4,centerY:.4,size:.5}},{...config,decisionProfile:'stable'});
  assert.equal(changed.history.length,1);assert.equal(changed.streak,0);assert.equal(show(changed,{policy:decisionPolicy('stable')}).phase,'collecting');
});
