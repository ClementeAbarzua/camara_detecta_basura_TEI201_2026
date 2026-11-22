import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import sharp from 'sharp';
import {DEFAULT_ROI,validRoi,roiPixels,roiBounds,constrainRoi} from '../public/roi-geometry.js';
import {prepareImage,classify,predictRGB} from '../lib/model.js';
import {createStore} from '../lib/store.js';
import {createAdminAuth} from '../lib/admin-auth.js';
import {createAdminHandlers} from '../api/admin.js';
import {createServer} from '../lib/http-server.js';
import {createStateHandler} from '../api/state.js';
import {createIngestHandler} from '../api/ingest.js';

test('Geometría: cuadrado central original, límites, retrato y rechazo de zonas inválidas',()=>{
  assert.deepEqual(roiPixels(800,600),{left:100,top:0,width:600,height:600});
  assert.deepEqual(roiPixels(600,800),{left:0,top:100,width:600,height:600});
  assert.deepEqual(roiPixels(800,600,{centerX:0,centerY:1,size:.5}),{left:0,top:300,width:300,height:300});
  for(const roi of [null,[],{}, {...DEFAULT_ROI,size:.14},{...DEFAULT_ROI,size:1.1},{...DEFAULT_ROI,centerX:-.1},
    {...DEFAULT_ROI,centerY:Infinity},{...DEFAULT_ROI,size:'1'},{...DEFAULT_ROI,extra:1}])assert.equal(validRoi(roi),false);
  for(const [w,h]of [[800,600],[600,800],[801,599],[224,224]]){
    const bounded=constrainRoi({centerX:-1,centerY:5,size:.5},w,h),p=roiPixels(w,h,bounded),r=roiBounds(w,h,bounded);
    assert.equal(p.width,p.height);assert.ok(p.left>=0&&p.top>=0&&p.left+p.width<=w&&p.top+p.height<=h);
    assert.equal(r.width*w,p.width);assert.equal(r.height*h,p.height);
  }
});

test('Recorte real fuera del centro: RGB, miniatura completa y giro coinciden con la zona elegida',async()=>{
  const width=800,height=600,pixels=Buffer.alloc(width*height*3),colors=[[230,20,20],[20,220,20],[20,20,230],[230,220,20]];
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const color=colors[(y>=300?2:0)+(x>=400?1:0)];for(let c=0;c<3;c++)pixels[(y*width+x)*3+c]=color[c];
  }
  const jpeg=await sharp(pixels,{raw:{width,height,channels:3}}).jpeg({quality:95}).toBuffer(),roi={centerX:.25,centerY:.25,size:.5};
  const normal=await prepareImage(jpeg,0,roi),rotated=await prepareImage(jpeg,180,roi);
  const sample=rgb=>[...rgb.subarray((112*224+112)*3,(112*224+112)*3+3)];
  assert.ok(sample(normal.rgb).every((value,i)=>Math.abs(value-colors[0][i])<10));
  assert.ok(sample(rotated.rgb).every((value,i)=>Math.abs(value-colors[3][i])<10));
  assert.deepEqual(rotated.analysisRegion,{x:.0625,y:0,width:.375,height:.5});
  assert.equal(rotated.imageWidth,800);assert.equal(rotated.imageHeight,600);
  const preview=await sharp(rotated.preview).metadata();assert.equal(preview.width,320);assert.equal(preview.height,240);
  const result=await classify(jpeg,{rotation:180,roi});
  assert.deepEqual(result.scores,await predictRGB(rotated.rgb));assert.deepEqual(result.analysisRegion,rotated.analysisRegion);
  assert.deepEqual((await prepareImage(jpeg)).rgb,(await prepareImage(jpeg,0,DEFAULT_ROI)).rgb);
});

test('Zona privada: CSRF, persistencia, reinicio sin borrar historial y descarte de inferencias anteriores',async()=>{
  process.env.CAMERA_TOKEN='roi-test-camera-token-'.repeat(3);
  const db=new PGlite();let app,changeDuringAnalysis=false;let camera,seen;
  const config={threshold:.8,staleMs:90000,decisionProfile:'demo'},roi={centerX:.3,centerY:.65,size:.4};
  try{
    const schema=await readFile(new URL('../database/schema.sql',import.meta.url),'utf8');await db.exec(schema);
    const store=createStore(async(sql,args)=>(await db.query(sql,args)).rows);
    const frame=seq=>({boot:'0123456789abcdef',seq,receivedAt:Date.now()+seq,scores:[.05,.45,.4,.1],analysisMs:1,rotation:camera.rotation,orientationVersion:camera.version,roi:camera.roi});
    camera=await store.readCameraSettings();for(let seq=1;seq<=4;seq++)await store.saveReading(frame(seq),config);
    const history=(await store.readHistory()).entries;
    const auth=createAdminAuth({readCredentials:()=>({password:'test-only-roi-password',secret:'test-roi-session-secret-'.repeat(3)}),production:()=>false});
    const handlers=createAdminHandlers({auth,read:store.readCameraSettings,save:store.setCameraSettings,publish(){}});
    const routes={'/api/state':createStateHandler(store.readCameraView),'/api/ingest':createIngestHandler(async(_jpeg,options)=>{
      seen=options;
      if(changeDuringAnalysis)camera=await store.setCameraSettings({rotation:180,threshold:.8,expectedVersion:camera.version,roi:{...roi,size:.6}});
      return {scores:[.05,.45,.4,.1],analysisMs:1,imageWidth:800,imageHeight:600,analysisRegion:roiBounds(800,600,options.roi)};
    },store.saveReading,store.readCameraSettings)};
    for(const[name,handler]of Object.entries(handlers))routes['/api/admin/'+name]=handler;
    app=createServer({routes,health:async()=>{}});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
    const base='http://127.0.0.1:'+app.server.address().port;
    const input={rotation:180,threshold:.8,expectedVersion:camera.version,roi};
    const write=(headers,value=input)=>fetch(base+'/api/admin/settings',{method:'PUT',headers:{'content-type':'application/json',...headers},body:JSON.stringify(value)});
    assert.equal((await write({origin:base})).status,401);
    const login=await fetch(base+'/api/admin/login',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({password:'test-only-roi-password'})});
    assert.equal(login.status,200);const session=await login.json();
    const headers={origin:base,cookie:login.headers.get('set-cookie').split(';')[0],'x-csrf-token':session.csrfToken};
    assert.equal((await write({...headers,'x-csrf-token':''})).status,403);
    for(const bad of [null,{...roi,centerX:2},{...roi,size:.01},{...roi,size:'0.4'},{centerX:.3,centerY:.5},{...roi,other:0}])
      assert.equal((await write(headers,{...input,roi:bad})).status,400);
    const saved=await write(headers);assert.equal(saved.status,200);camera=(await saved.json()).camera;
    assert.deepEqual(camera.roi,roi);assert.equal(camera.version,'1');
    assert.equal((await write(headers)).status,409);
    assert.deepEqual((await store.readHistory()).entries,history);
    const pending=await(await fetch(base+'/api/state')).json();assert.equal(pending.policyPending,true);assert.deepEqual(pending.camera.roi,roi);
    await db.exec(schema);await db.exec(schema);assert.deepEqual(await store.readCameraSettings(),camera);
    const cachedClient=await store.setCameraSettings({rotation:180,threshold:.8,expectedVersion:camera.version});assert.deepEqual(cachedClient,camera);
    for(const invalid of [{},null,{centerX:1,centerY:1,size:0},{...roi,extra:1}])
      await assert.rejects(db.query('UPDATE camaras SET zona_analisis=$1::jsonb',[JSON.stringify(invalid)]));
    const send=seq=>fetch(base+'/api/ingest',{method:'POST',headers:{authorization:'Bearer '+process.env.CAMERA_TOKEN,'content-type':'image/jpeg','x-camera-boot':'0123456789abcdef','x-frame-seq':String(seq)},body:Buffer.from([255,216,255,217])});
    assert.equal((await send(5)).status,200);assert.deepEqual(seen.roi,roi);
    const first=await store.readState();assert.equal(first.history.length,1);assert.equal(first.streak,0);assert.deepEqual(first.roi,roi);
    assert.deepEqual(first.analysisRegion,roiBounds(800,600,roi));
    changeDuringAnalysis=true;assert.equal((await send(6)).status,409);
    assert.equal((await store.readHistory()).entries.length,5);
    assert.equal((await store.readState()).seq,5);
    assert.deepEqual((await store.readHistory()).entries.slice(1),history);
    assert.equal((await fetch(base+'/api/camera-settings',{method:'PUT'})).status,405);
    const html=await(await fetch(base+'/')).text();assert.doesNotMatch(html,/id="roiBox"|id="roiSize"|id="roiX"|id="roiY"/);
    assert.match(html,/id="captureProgress"/);assert.match(html,/id="confirmationProgress"/);
    for(const path of ['/roi-geometry.js','/roi-editor.js','/decision-progress.js'])assert.equal((await fetch(base+path)).status,200);
  }finally{if(app)await new Promise(resolve=>{app.server.close(resolve);app.server.closeAllConnections();});await db.close();}
});
