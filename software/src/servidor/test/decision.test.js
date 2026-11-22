import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, publicState } from '../lib/decision.js';
import { cameraAuthorized, passwordMatches, createSession, viewerAuthorized } from '../lib/auth.js';
const config = { threshold: .8, staleMs: 90000 };
const frame = (seq, scores = [.05, .45, .4, .1], extra = {}) => ({ seq, boot: '0123456789abcdef', receivedAt: seq * 15000, scores, analysisMs: 1, ...extra });
test('La alternancia de residuos confirma basura en la quinta captura', () => {
  let state;
  const examples = [[.05,.45,.4,.1],[.05,.25,.65,.05],[.05,.6,.15,.2],[.05,.15,.25,.55],[.05,.35,.5,.1]];
  examples.forEach((scores, i) => {
    state = decide(state, frame(i + 1, scores), config);
    assert.equal(state.conclusion, i < 4 ? 'No seguro' : 'Hay basura');
  });
  assert.equal(state.history.length, 5); assert.equal(state.streak, 3);
});
test('Confirma caja vacia y responde al retirar un residuo', () => {
  let state;
  for (let i = 1; i <= 5; i++) state = decide(state, frame(i), config);
  for (let i = 6; i <= 15; i++) state = decide(state, frame(i, [.98,.01,.005,.005]), config);
  assert.equal(state.conclusion, 'Sin basura');
});
test('Una foto repetida, una lectura de la web y una respuesta atrasada no suman confirmaciones', () => {
  const state = decide(null, frame(1), config);
  assert.equal(decide(state, frame(1), config), state);
  assert.equal(decide(state, frame(0), config), state);
  publicState(state, config.staleMs, state.receivedAt); assert.equal(state.history.length, 1);
});
test('Corte de red, reinicio o cambio de umbral reinician el historial', () => {
  let state; for (let i=1;i<=5;i++) state=decide(state,frame(i),config);
  for (const fresh of [frame(6,undefined,{receivedAt:999999}), frame(1,undefined,{boot:'ffffffffffffffff',receivedAt:80000})]) {
    const next=decide(state,fresh,config);assert.equal(next.history.length,1);assert.equal(next.conclusion,'No seguro');
  }
  assert.equal(decide(state,frame(6),{...config,threshold:.9}).history.length,1);
});
test('Los datos antiguos no se presentan como estado actual', () => {
  let state; for(let i=1;i<=5;i++)state=decide(state,frame(i),config);
  const visible=publicState(state,config.staleMs,state.receivedAt+90001);
  assert.equal(visible.online,false);assert.equal(visible.state.conclusion,'Sin datos recientes');assert.equal(visible.state.history,undefined);
});
test('Valores invalidos y resultados ambiguos no confirman basura', () => {
  assert.throws(()=>decide(null,frame(1,[1,1,1,1]),config));
  let state;for(let i=1;i<=8;i++)state=decide(state,frame(i,[.5,.2,.2,.1]),config);
  assert.equal(state.conclusion,'No seguro');assert.equal(state.streak,0);
});
test('Token de camara y sesion de consulta son independientes', () => {
  process.env.CAMERA_TOKEN='a'.repeat(48);process.env.DASHBOARD_PASSWORD='b'.repeat(24);process.env.SESSION_SECRET='c'.repeat(48);
  assert.equal(cameraAuthorized({headers:{authorization:'Bearer '+'a'.repeat(48)}}),true);
  assert.equal(cameraAuthorized({headers:{authorization:'Bearer incorrecto'}}),false);
  assert.equal(passwordMatches('b'.repeat(24)),true);
  const session=createSession();assert.equal(viewerAuthorized({headers:{cookie:'xiao_session='+session}}),true);
  assert.equal(viewerAuthorized({headers:{cookie:'xiao_session='+session+'x'}}),false);
});
