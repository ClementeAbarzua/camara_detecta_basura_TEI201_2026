import { test } from 'node:test';
import assert from 'node:assert/strict';
import { historyCSV } from '../public/history-format.js';

test('CSV exporta cada fila cargada, porcentajes y fechas UTC', () => {
  const row = { id: '1', cameraId: 'camara-1', receivedAt: 1700000000000, scores: [.05,.45,.4,.1], trashNow:.95, trashAverage:.95, conclusion:'Hay basura', threshold:.8, readings:5, streak:3, analysisMs:120 };
  const csv = historyCSV([row]);
  assert.ok(csv.startsWith('\uFEFF'));assert.equal(csv.trim().split('\r\n').length, 2);
  assert.ok(csv.includes('"2023-11-14T22:13:20.000Z"'));
  assert.ok(csv.includes('"95,000"'));assert.ok(csv.includes('"45,000"'));
  assert.equal(csv.split('\r\n')[0].split(';').length, csv.split('\r\n')[1].split(';').length);
  assert.equal(historyCSV([]).trim().split('\r\n').length, 1);
});
