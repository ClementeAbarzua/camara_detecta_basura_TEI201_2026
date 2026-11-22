import {DEFAULT_ROI,MIN_ROI_SIZE,roiPixels,roiBounds,constrainRoi} from './roi-geometry.js';

// El recuadro y los deslizadores editan un borrador; este módulo nunca escribe al servidor.
export function createRoiEditor({stage,box,handle,sizeInput,xInput,yInput,reset,readSize,onChange,isDisabled}) {
  let roi={...DEFAULT_ROI},drag=null,available=false;
  function imageSize(){return readSize();}
  function render(){
    const {width,height}=imageSize(),bounds=roiBounds(width,height,roi);
    stage.style.aspectRatio=width+'/'+height;
    box.hidden=!available;reset.disabled=isDisabled();
    for(const input of [sizeInput,xInput,yInput])input.disabled=isDisabled();
    handle.disabled=isDisabled()||!available;
    box.setAttribute('aria-disabled',String(isDisabled()||!available));
    box.style.left=bounds.x*100+'%';box.style.top=bounds.y*100+'%';
    box.style.width=bounds.width*100+'%';box.style.height=bounds.height*100+'%';
    sizeInput.value=String(Math.round(roi.size*100));xInput.value=String(Math.round(roi.centerX*100));yInput.value=String(Math.round(roi.centerY*100));
    box.setAttribute('aria-label',`Zona de análisis. Centro horizontal ${Math.round(roi.centerX*100)} %, vertical ${Math.round(roi.centerY*100)} %, tamaño ${Math.round(roi.size*100)} %. Usa las flechas para mover.`);
  }
  function commit(next){const {width,height}=imageSize();roi=constrainRoi(next,width,height);render();onChange({...roi});}
  function set(next=DEFAULT_ROI){roi={...next};render();}
  function setAvailable(value){available=value;render();}
  for(const [input,key]of [[sizeInput,'size'],[xInput,'centerX'],[yInput,'centerY']])input.addEventListener('input',()=>{
    if(!isDisabled())commit({...roi,[key]:Number(input.value)/100});
  });
  reset.addEventListener('click',()=>{if(!isDisabled())commit(DEFAULT_ROI);});
  box.addEventListener('pointerdown',event=>{
    if(isDisabled()||!available||event.button!==0)return;
    const rect=stage.getBoundingClientRect(),{width,height}=imageSize(),pixels=roiPixels(width,height,roi);
    const start={centerX:(pixels.left+pixels.width/2)/width,centerY:(pixels.top+pixels.height/2)/height,size:roi.size};
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,rect,width,height,start,resize:event.target===handle};
    box.setPointerCapture(event.pointerId);event.preventDefault();
  });
  box.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.id||isDisabled())return;
    const dx=(event.clientX-drag.x)/drag.rect.width,dy=(event.clientY-drag.y)/drag.rect.height;
    if(drag.resize){
      const delta=Math.abs(dx*drag.width)>Math.abs(dy*drag.height)?dx*drag.width:dy*drag.height;
      commit({...drag.start,size:Math.max(MIN_ROI_SIZE,Math.min(1,drag.start.size+2*delta/Math.min(drag.width,drag.height)))});
    }else commit({...drag.start,centerX:drag.start.centerX+dx,centerY:drag.start.centerY+dy});
  });
  const stop=event=>{if(drag?.id===event.pointerId){drag=null;render();}};
  box.addEventListener('pointerup',stop);box.addEventListener('pointercancel',stop);box.addEventListener('lostpointercapture',()=>{drag=null;});
  box.addEventListener('keydown',event=>{
    if(isDisabled()||!available||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
    event.preventDefault();const step=event.shiftKey ? .05 : .01;
    commit({...roi,centerX:roi.centerX+(event.key==='ArrowRight'?step:event.key==='ArrowLeft'?-step:0),centerY:roi.centerY+(event.key==='ArrowDown'?step:event.key==='ArrowUp'?-step:0)});
  });
  return {set,get:()=>({...roi}),render,setAvailable};
}
