// Cuenta capturas y evaluaciones reales; no convierte la espera en una probabilidad.
export function decisionProgress({state,online,configurationPending=false,policy}) {
  const requiredSamples=policy.minimumReadings ?? 3, requiredConfirmations=policy.confirmationsRequired;
  const base={samples:0,requiredSamples,confirmations:0,requiredConfirmations,target:null};
  if(configurationPending)return {...base,phase:'waiting',title:'Esperando capturas con los nuevos ajustes',detail:'La primera captura nueva reiniciará el promedio y sus confirmaciones.'};
  if(!state)return {...base,phase:'waiting',title:'Esperando la primera captura',detail:'El avance comenzará cuando la cámara envíe una medición.'};
  if(!online)return {...base,phase:'stale',title:'Sin capturas recientes',detail:'No se confirma un resultado con información antigua. El avance se reiniciará al recibir una captura nueva.'};
  const samples=Math.min(requiredSamples,state.readings);
  if(samples<requiredSamples)return {...base,samples,phase:'collecting',title:'Reuniendo capturas',detail:`${samples} de ${requiredSamples} capturas mínimas recibidas. Todavía no se evalúa una conclusión.`};
  const target=state.trashAverage>=state.threshold ? 'Hay basura' : 1-state.trashAverage>=state.threshold ? 'Sin basura' : null;
  if(!target)return {...base,samples,phase:'uncertain',title:'Evidencia no concluyente',detail:'La evidencia es ambigua: el promedio está entre los dos umbrales. No se acumulan confirmaciones hasta que apoye una conclusión.'};
  const confirmations=Math.min(requiredConfirmations,Math.max(0,state.streak || 0));
  const confirmed=state.conclusion===target && confirmations>=requiredConfirmations;
  return {...base,samples,target,confirmations,phase:confirmed?'confirmed':'confirming',
    title:confirmed?'Resultado confirmado':`Confirmando: ${target.toLowerCase()}`,
    detail:confirmed?`${target}. Se alcanzaron ${requiredConfirmations} evaluaciones consecutivas que apoyan el mismo resultado.`:
      `${confirmations} de ${requiredConfirmations} evaluaciones consecutivas apoyan «${target}». Cada captura nueva actualiza el promedio y vuelve a evaluarlo.`};
}
