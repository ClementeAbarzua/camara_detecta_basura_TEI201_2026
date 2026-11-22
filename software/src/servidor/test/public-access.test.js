import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAuthConfig, createSession, cameraAuthorized } from '../lib/auth.js';
import { createStateHandler } from '../api/state.js';

test('El monitor no exige clave: cookies invalidas o administracion sin configurar no bloquean la consulta publica', async () => {
  process.env.CAMERA_TOKEN = 'public-camera-test-'.repeat(3);
  delete process.env.DASHBOARD_PASSWORD; delete process.env.SESSION_SECRET;
  assert.doesNotThrow(validateAuthConfig);
  const handler = createStateHandler(async () => ({ camera:{rotation:0,version:'0'},state:null }));
  const request = async (cookie = '', method = 'GET') => {
    let data; const res = { setHeader() {},end(value) { data = JSON.parse(value); } };
    await handler({method,headers:{cookie}},res); return { status:res.statusCode,data };
  };
  const forged = 'xiao_session=' + (Date.now() + 999999) + '.firma-invalida';
  for (const cookie of ['',forged]) {
    const result = await request(cookie); assert.equal(result.status,200);
    assert.equal(result.data.canManageCamera,false); assert.equal(result.data.state,null);
  }
  assert.equal((await request('', 'POST')).status,405);
  assert.equal(cameraAuthorized({headers:{}}),false);
  assert.equal(cameraAuthorized({headers:{authorization:'Bearer ' + process.env.CAMERA_TOKEN}}),true);
  process.env.DASHBOARD_PASSWORD = 'private-owner-password';
  process.env.SESSION_SECRET = 'public-owner-session-test-'.repeat(3);
  validateAuthConfig();
  const owner = await request('xiao_session=' + createSession());
  assert.equal(owner.data.canManageCamera,false);
  assert.equal((await request(forged)).data.canManageCamera,false);
});
