import { describe, expect, it } from 'vitest';
import { applyVisibility, classifyLight, enhanceLowLight, measureLight, suspectEyeOcclusion, type Pixels } from '../src/vision/visibility';
import type { Point } from '../src/core/geometry';
function frame(width=100,height=100,value=120):Pixels {
  const data=new Uint8ClampedArray(width*height*4);
  for(let i=0;i<data.length;i+=4){data[i]=data[i+1]=data[i+2]=value;data[i+3]=255;}
  return {width,height,data};
}
describe('Raw-frame visibility and bounded enhancement',()=>{
  it('distinguishes darkness from dim but usable image information',()=>{
    expect(classifyLight(measureLight(frame(100,100,0)))).toBe('dark');
    const image=frame();for(let i=0;i<image.data.length;i+=4) image.data[i]=image.data[i+1]=image.data[i+2]=20+(i/4)%50;
    expect(classifyLight(measureLight(image))).toBe('low');
    expect(classifyLight(measureLight(frame()))).toBe('normal');
  });
  it('brightens dim pixels without altering raw evidence or inventing black pixels',()=>{
    const image=frame();for(let i=0;i<image.data.length;i+=4) image.data[i]=image.data[i+1]=image.data[i+2]=20+(i/4)%50;
    const before=new Uint8ClampedArray(image.data),stats=measureLight(image);
    const output=enhanceLowLight(image,stats);
    expect(measureLight({...image,data:output}).mean).toBeGreaterThan(stats.mean*1.5);
    expect(image.data).toEqual(before);
    expect(enhanceLowLight(frame(10,10,0),measureLight(frame(10,10,0)))[0]).toBe(0);
  });
  it('does not modify a normally exposed image',()=>{
    const image=frame();expect(enhanceLowLight(image,measureLight(image))).toEqual(image.data);
  });
  it('suspects opaque eye patches but does not label a bare face as sunglasses',()=>{
    const image=frame(),points:Point[]=Array.from({length:468},()=>({x:0.5,y:0.5}));
    points[33]={x:0.25,y:0.35};points[133]={x:0.35,y:0.35};points[362]={x:0.65,y:0.35};points[263]={x:0.75,y:0.35};
    expect(suspectEyeOcclusion(image,points)).toBe(false);
    for(let y=30;y<40;y++)for(const [start,end]of [[22,38],[62,78]])for(let x=start;x<end;x++){const i=(y*100+x)*4;image.data[i]=image.data[i+1]=image.data[i+2]=8;}
    expect(suspectEyeOcclusion(image,points)).toBe(true);
  });
  it('never trusts model predictions on a near-black frame',()=>{
    const observation=applyVisibility({valid:true,faceValid:true,mouthValid:true,ear:0.3,mouth:0.8,headPitch:32},'dark',{mean:3,p05:0,p95:6},false,true);
    expect(observation.valid).toBe(false);expect(observation.faceValid).toBe(false);expect(observation.headPitch).toBeNull();expect(observation.mouthValid).toBe(false);
  });
  it('retains mouth and head while excluding obscured eyes',()=>{
    const observation=applyVisibility({valid:true,faceValid:true,mouthValid:true,ear:0.3,mouth:0.8,headPitch:24},'normal',{mean:120,p05:40,p95:180},true,false);
    expect(observation.valid).toBe(false);expect(observation.mouthValid).toBe(true);expect(observation.headPitch).toBe(24);
  });
});
