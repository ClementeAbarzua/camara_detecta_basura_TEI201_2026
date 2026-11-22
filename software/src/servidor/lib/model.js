import * as tf from '@tensorflow/tfjs';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { LABELS } from './config.js';
import { DEFAULT_ROI, roiPixels, roiBounds } from '../public/roi-geometry.js';

let ready;
async function initialize() {
  await tf.setBackend('cpu'); await tf.ready();
  const root = new URL('../model/', import.meta.url);
  const json = JSON.parse(await readFile(new URL('model.json', root), 'utf8'));
  const metadata = JSON.parse(await readFile(new URL('metadata.json', root), 'utf8'));
  if (JSON.stringify(metadata.labels) !== JSON.stringify(LABELS) || metadata.imageSize !== 224) throw new Error('El modelo no coincide con las clases de este proyecto.');
  const specs = [], buffers = [];
  for (const group of json.weightsManifest) {
    specs.push(...group.weights);
    for (const file of group.paths) {
      if (file !== 'weights.bin') throw new Error('Nombre de pesos no esperado.');
      buffers.push(await readFile(new URL(file, root)));
    }
  }
  const weights = Buffer.concat(buffers);
  const model = await tf.loadLayersModel(tf.io.fromMemory({
    modelTopology: json.modelTopology, weightSpecs: specs,
    weightData: weights.buffer.slice(weights.byteOffset, weights.byteOffset + weights.byteLength)
  }));
  return model;
}
export async function loadModel() {
  if (!ready) ready = initialize().catch(error => { ready = null; throw error; });
  return ready;
}
// Serializar inferencias dentro de una instancia evita solapar tensores y cargas CPU.
let tail = Promise.resolve();
export function classify(jpeg, { rotation = 0, roi = DEFAULT_ROI } = {}) {
  const task = tail.then(() => infer(jpeg, rotation, roi)); tail = task.catch(() => {}); return task;
}
// La miniatura y los pixeles del modelo parten de la misma imagen orientada.
export async function prepareImage(jpeg, rotation = 0, roi = DEFAULT_ROI) {
  if (![0, 180].includes(rotation)) throw new Error('Orientacion invalida.');
  const image = sharp(jpeg, { limitInputPixels: 16000000, failOn: 'warning' });
  const meta = await image.metadata();
  if (meta.format !== 'jpeg' || !meta.width || !meta.height) throw Object.assign(new Error('Se requiere una foto JPEG valida.'), { status: 415 });
  image.rotate(rotation);
  const region=roiPixels(meta.width,meta.height,roi);
  const { data } = await image.clone().extract(region)
    .resize(224, 224, { kernel: 'linear' }).removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  const preview = await image.clone().resize({ width: 320, withoutEnlargement: true }).jpeg({ quality: 55 }).toBuffer();
  return { rgb:data, preview, imageWidth:meta.width,imageHeight:meta.height,analysisRegion:roiBounds(meta.width,meta.height,roi) };
}
async function infer(jpeg, rotation, roi) {
  const start = performance.now(), model = await loadModel();
  const { rgb, preview, ...geometry } = await prepareImage(jpeg, rotation, roi);
  const scores = await predictRGB(rgb, model);
  return { scores, preview:preview.toString('base64'),...geometry, analysisMs:Math.round(performance.now()-start) };
}
export async function predictRGB(rgb, model = null) {
  model ||= await loadModel();
  // Misma normalizacion de Teachable Machine: valores RGB entre -1 y 1.
  const input = tf.tidy(() => tf.tensor3d(new Uint8Array(rgb), [224, 224, 3], 'int32').toFloat().div(127).sub(1).expandDims());
  let output;
  try {
    output = model.predict(input);
    if (Array.isArray(output)) throw new Error('Se esperaba una sola salida del modelo.');
    const scores = Array.from(await output.data());
    if (scores.length !== LABELS.length) throw new Error('Salida incompatible.');
    return scores;
  } finally {
    input.dispose();
    if (Array.isArray(output)) output.forEach(x => x.dispose()); else output?.dispose();
  }
}
