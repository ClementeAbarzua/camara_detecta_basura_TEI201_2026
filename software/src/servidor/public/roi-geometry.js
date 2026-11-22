// Coordenadas relativas a la imagen completa, después del giro. Compartido con el servidor.
export const DEFAULT_ROI = Object.freeze({centerX:.5,centerY:.5,size:1});
export const MIN_ROI_SIZE = .15;
const clamp = (n,min,max) => Math.min(max,Math.max(min,n));
export function validRoi(roi) {
  return !!roi && typeof roi==='object' && !Array.isArray(roi) &&
    Object.keys(roi).length===3 && ['centerX','centerY','size'].every(key=>typeof roi[key]==='number' && Number.isFinite(roi[key])) &&
    roi.centerX>=0 && roi.centerX<=1 && roi.centerY>=0 && roi.centerY<=1 && roi.size>=MIN_ROI_SIZE && roi.size<=1;
}
export function sameRoi(a=DEFAULT_ROI,b=DEFAULT_ROI) {
  return ['centerX','centerY','size'].every(key=>a[key]===b[key]);
}
export function roiPixels(width,height,roi=DEFAULT_ROI) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width<1 || height<1 || !validRoi(roi)) throw new Error('Zona de análisis inválida.');
  const edge=Math.max(1,Math.floor(Math.min(width,height)*roi.size));
  return {left:clamp(Math.floor(roi.centerX*width-edge/2),0,width-edge),
    top:clamp(Math.floor(roi.centerY*height-edge/2),0,height-edge),width:edge,height:edge};
}
export function roiBounds(width,height,roi=DEFAULT_ROI) {
  const p=roiPixels(width,height,roi);
  return {x:p.left/width,y:p.top/height,width:p.width/width,height:p.height/height};
}
export function constrainRoi(roi,width,height) {
  const size=clamp(roi.size,MIN_ROI_SIZE,1),edge=Math.min(width,height)*size;
  return {centerX:clamp(roi.centerX,edge/(2*width),1-edge/(2*width)),
    centerY:clamp(roi.centerY,edge/(2*height),1-edge/(2*height)),size};
}
