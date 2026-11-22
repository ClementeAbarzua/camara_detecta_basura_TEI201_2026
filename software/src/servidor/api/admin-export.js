import {once} from 'node:events';
import {adminAuth} from '../lib/admin-auth.js';
import {getPool} from '../lib/database.js';
import {reply} from '../lib/config.js';
import {databaseExport} from '../lib/database-export.js';

export function exportOptions(url){
  const params=new URL(url,'http://localhost').searchParams;
  if([...params.keys()].some(k=>!['format','from','to'].includes(k)) || ['format','from','to'].some(k=>params.getAll(k).length>1))
    throw Object.assign(new Error('Parámetros de exportación inválidos.'),{status:400});
  const format=params.get('format')||'json',a=params.get('from'),b=params.get('to');
  if(!['json','csv'].includes(format)||(a===null)!==(b===null))throw Object.assign(new Error('Elige JSON o CSV y un intervalo completo.'),{status:400});
  const from=a===null?null:Number(a),to=b===null?null:Number(b);
  if(a!==null&&(!/^\d{1,16}$/.test(a)||!/^\d{1,16}$/.test(b)||!Number.isSafeInteger(from)||!Number.isSafeInteger(to)||from>=to||to>8640000000000000))
    throw Object.assign(new Error('Intervalo de fechas inválido.'),{status:400});
  return {format,from,to};
}
export function createAdminExportHandler({auth=adminAuth,pool=getPool,generate=databaseExport}={}){
  let active=false;
  return async(req,res)=>{
    let timer,controller,iterator;
    try{
      if(req.method!=='GET')return reply(res,405,{error:'Usa GET.'});
      auth.requireSession(req);
      const options=exportOptions(req.url);
      if(active)return reply(res,429,{error:'Ya hay una exportación en curso. Espera a que termine.'});
      active=true;controller=new AbortController();
      timer=setTimeout(()=>controller.abort(new Error('La exportación excedió dos minutos. Prueba un intervalo menor.')),120000);timer.unref?.();
      res.once('close',()=>controller.abort());
      iterator=generate(pool(),{...options,signal:controller.signal})[Symbol.asyncIterator]();
      let next=await iterator.next();auth.requireSession(req);
      res.setHeader('Content-Type',options.format==='json'?'application/json; charset=utf-8':'text/csv; charset=utf-8');
      res.setHeader('Cache-Control','private, no-store, max-age=0');
      res.setHeader('Content-Disposition',`attachment; filename="${options.format==='json'?'base':'mediciones'}-xiao-${new Date().toISOString().slice(0,10)}.${options.format}"`);
      res.statusCode=200;
      while(!next.done){
        controller.signal.throwIfAborted();auth.requireSession(req);
        if(!res.write(next.value))await once(res,'drain',{signal:controller.signal});
        next=await iterator.next();
      }
      res.end();
    }catch(e){
      if(!res.headersSent){res.removeHeader('Content-Disposition');reply(res,e.status||503,{error:e.status?e.message:'No se pudo exportar. Prueba un intervalo menor.'});}
      else res.destroy();
    }finally{
      if(controller){controller.abort();clearTimeout(timer);await iterator?.return?.().catch(()=>{});active=false;}
    }
  };
}
