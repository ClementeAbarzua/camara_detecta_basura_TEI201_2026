import {decisionPresentation,createDecisionAlertTracker} from './dashboard-data.js';
export function createLiveDecision({get,document:doc,Audio=globalThis.AudioContext??globalThis.webkitAudioContext,schedule=setTimeout,cancel=clearTimeout}){
  const tracker=createDecisionAlertTracker();let sound=false,audio=null,toastTimer;
  const time=t=>new Date(t).toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  get('toggleAlertSound').addEventListener('click',async()=>{
    try{
      if(!sound){if(!Audio)throw new Error();audio??=new Audio();await audio.resume();}
      sound=!sound;get('toggleAlertSound').setAttribute('aria-pressed',String(sound));get('toggleAlertSound').textContent=sound?'Sonido: activado':'Sonido: desactivado';
    }catch{sound=false;get('toggleAlertSound').textContent='Sonido no disponible';get('toggleAlertSound').setAttribute('aria-pressed','false');}
  });
  const hideToast=()=>{cancel(toastTimer);get('decisionToast').hidden=true;};
  get('closeDecisionToast').addEventListener('click',hideToast);
  doc.addEventListener('visibilitychange',()=>{if(doc.hidden)hideToast();});
  function chime(kind){
    if(!sound||!audio||audio.state!=='running')return;
    try{
      const start=audio.currentTime;for(let i=0;i<(kind==='trash'?2:1);i++){
        const oscillator=audio.createOscillator(),gain=audio.createGain(),at=start+i*.22;
        oscillator.frequency.value=kind==='trash'?660:440;gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(.07,at+.02);gain.gain.exponentialRampToValueAtTime(.0001,at+.17);
        oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(at);oscillator.stop(at+.18);
      }
    }catch{}
  }
  return {render(input){
    const view=decisionPresentation(input);get('result').setAttribute('data-state',view.kind);
    if(!['trash','clear'].includes(view.kind))hideToast();
    get('decisionBadge').textContent=view.badge;get('decisionSymbol').textContent=view.symbol;
    get('decisionAction').textContent=view.action;get('decisionConnectionMode').textContent=input.realtime?'En vivo':'Actualización automática';
    get('decisionConfirmedAt').textContent=input.fresh&&input.state?`Última medición: ${time(input.state.receivedAt)}`:'Sin una medición actual para confirmar';
    const alert=tracker.observe(input.state,view.kind);
    if(alert&&!doc.hidden){
      get('decisionToast').setAttribute('data-state',alert.kind);get('decisionToastText').textContent=`${alert.conclusion} · confirmado a las ${time(alert.receivedAt)}`;
      get('decisionToast').hidden=false;cancel(toastTimer);toastTimer=schedule(hideToast,8000);chime(alert.kind);
    }
    return view;
  }};
}
