import { classify } from '../lib/model.js';
import sharp from 'sharp';
const jpeg = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#b89f78' } }).jpeg().toBuffer();
const result = await classify(jpeg);
console.log(JSON.stringify({ scores: result.scores, sum: result.scores.reduce((a,b)=>a+b,0), analysisMs: result.analysisMs }));
console.log('Esta imagen sintetica comprueba ejecucion, no precision con basura real.');
