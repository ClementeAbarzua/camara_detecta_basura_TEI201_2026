import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRoiEditor} from '../public/roi-editor.js';
import {DEFAULT_ROI,roiPixels} from '../public/roi-geometry.js';

class Element{
  constructor(){this.style={};this.value='';this.handlers={};this.attributes={};}
  addEventListener(name,fn){this.handlers[name]=fn;}
  setAttribute(name,value){this.attributes[name]=value;}
  getBoundingClientRect(){return {left:20,top:30,width:400,height:300};}
  setPointerCapture(id){this.pointer=id;}
  event(name,event={}){return this.handlers[name]?.({preventDefault(){},...event});}
}
test('Editor real: deslizar, mover con ratón o teclado, redimensionar y bloquear controles sin escribir al servidor',()=>{
  const stage=new Element(),box=new Element(),handle=new Element(),sizeInput=new Element(),xInput=new Element(),yInput=new Element(),reset=new Element();
  let disabled=false,changes=[];
  const editor=createRoiEditor({stage,box,handle,sizeInput,xInput,yInput,reset,readSize:()=>({width:800,height:600}),onChange:roi=>changes.push(roi),isDisabled:()=>disabled});
  editor.set();editor.setAvailable(true);assert.equal(box.style.left,'12.5%');assert.equal(box.style.width,'75%');assert.equal(changes.length,0);
  sizeInput.value='50';sizeInput.event('input');assert.equal(editor.get().size,.5);assert.equal(box.style.width,'37.5%');
  box.event('pointerdown',{button:0,pointerId:1,clientX:220,clientY:180,target:box});
  box.event('pointermove',{pointerId:1,clientX:260,clientY:180});box.event('pointerup',{pointerId:1});
  assert.equal(editor.get().centerX,.6);assert.equal(box.pointer,1);
  box.event('keydown',{key:'ArrowDown'});assert.equal(editor.get().centerY,.51);
  const before=editor.get();box.event('pointerdown',{button:0,pointerId:2,clientX:300,clientY:250,target:handle});
  box.event('pointermove',{pointerId:2,clientX:330,clientY:250});box.event('pointerup',{pointerId:2});
  assert.ok(editor.get().size>before.size);
  xInput.value='100';xInput.event('input');const p=roiPixels(800,600,editor.get());assert.ok(p.left+p.width<=800);
  disabled=true;editor.render();assert.equal(handle.disabled,true);assert.equal(sizeInput.disabled,true);
  const count=changes.length;reset.event('click');box.event('keydown',{key:'ArrowLeft'});assert.equal(changes.length,count);
  disabled=false;reset.event('click');assert.deepEqual(editor.get(),DEFAULT_ROI);
  editor.setAvailable(false);assert.equal(box.hidden,true);
});
