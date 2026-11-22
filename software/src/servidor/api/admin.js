import { body, reply, settings } from '../lib/config.js';
import { adminAuth } from '../lib/admin-auth.js';
import { readCameraSettings, setCameraSettings } from '../lib/store.js';
import { decisionPolicy } from '../lib/decision.js';
import { liveEvents } from '../lib/live-events.js';

async function jsonBody(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || ''))
    throw Object.assign(new Error('Se requiere JSON.'), {status:415});
  try { return JSON.parse((await body(req,4096)).toString('utf8')); }
  catch (error) { if (error.status) throw error; throw Object.assign(new Error('Datos no válidos.'), {status:400}); }
}
export function createAdminHandlers({ auth = adminAuth, read = readCameraSettings, save = setCameraSettings, publish = liveEvents.publish } = {}) {
  const wrap = action => async (req,res) => {
    try { await action(req,res); }
    catch (error) {
      if (!error.status) console.error('admin:', error.code || error.name);
      reply(res,error.status || 503,{error:error.status ? error.message : 'No se pudieron guardar o consultar los ajustes. Intenta nuevamente.'});
    }
  };
  const configuration = async () => {
    const config = settings(), camera = await read();
    return {camera:{...camera,threshold:camera.threshold ?? config.threshold},decision:decisionPolicy(config.decisionProfile)};
  };
  return {
    session:wrap(async(req,res)=>{
      if(req.method!=='GET')return reply(res,405,{error:'Usa GET.'});
      const session=auth.lookup(req);
      reply(res,200,{authenticated:!!session,configured:auth.configured(),...(session?{csrfToken:session.csrf,expiresAt:session.expiresAt}:{})});
    }),
    login:wrap(async(req,res)=>{
      if(req.method!=='POST')return reply(res,405,{error:'Usa POST.'});
      auth.requireOrigin(req);
      const input=await jsonBody(req);
      const session=auth.login(req,res,input?.password);
      reply(res,200,{authenticated:true,csrfToken:session.csrf,expiresAt:session.expiresAt});
    }),
    logout:wrap(async(req,res)=>{
      if(req.method!=='POST')return reply(res,405,{error:'Usa POST.'});
      auth.logout(req,res);reply(res,200,{authenticated:false});
    }),
    settings:wrap(async(req,res)=>{
      if(req.method==='GET'){auth.requireSession(req);return reply(res,200,await configuration());}
      if(req.method!=='PUT')return reply(res,405,{error:'Usa GET o PUT.'});
      auth.requireMutation(req);
      const input=await jsonBody(req);
      if (!input || typeof input!=='object' || Array.isArray(input) || Object.keys(input).some(key=>!['rotation','threshold','expectedVersion','roi'].includes(key)))
        return reply(res,400,{error:'Ajustes no válidos.'});
      const camera=await save(input);
      try {publish();}catch{console.error('No se pudo emitir el aviso de ajustes.');}
      reply(res,200,{camera,decision:decisionPolicy(settings().decisionProfile),message:'Ajustes guardados. Las próximas capturas iniciarán un promedio nuevo. El historial se conserva.'});
    })
  };
}
export const adminHandlers = createAdminHandlers();
