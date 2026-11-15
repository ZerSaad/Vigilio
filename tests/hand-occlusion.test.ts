import { describe, expect, it } from 'vitest';
import { handCoversMouth } from '../src/vision/hand-occlusion';
import type { Point } from '../src/core/geometry';
const face:Point[]=Array.from({length:468},()=>({x:0.5,y:0.5}));
face[61]={x:0.45,y:0.6};face[291]={x:0.55,y:0.6};face[13]={x:0.5,y:0.59};face[14]={x:0.5,y:0.61};
const palm=():Point[]=>{
  const points=Array.from({length:21},()=>({x:0.5,y:0.5}));
  for(const [index,x,y]of [[0,.45,.73],[1,.43,.68],[2,.43,.61],[5,.45,.57],[9,.5,.55],[13,.55,.57],[17,.57,.65]])points[index]={x,y};
  return points;
};
describe('Projected hand/mouth overlap',()=>{
  it('detects a palm covering the lips',()=>{expect(handCoversMouth(face,[palm()],640,480)).toBe(true);});
  it('detects a finger crossing the mouth without a palm overlap',()=>{
    const hand=Array.from({length:21},()=>({x:.1,y:.8}));hand[7]={x:.4,y:.6};hand[8]={x:.6,y:.6};
    expect(handCoversMouth(face,[hand],640,480)).toBe(true);
  });
  it('ignores a hand beside the face and empty space inside a hand bounding box',()=>{
    expect(handCoversMouth(face,[palm().map(p=>({x:p.x-.4,y:p.y}))],640,480)).toBe(false);
    const hand=Array.from({length:21},()=>({x:.15,y:.2}));hand[0]={x:.15,y:.8};hand[4]={x:.85,y:.2};hand[5]={x:.15,y:.4};
    expect(handCoversMouth(face,[hand],640,480)).toBe(false);
  });
  it('does not claim occlusion without a face or usable hand landmarks',()=>{
    expect(handCoversMouth([], [palm()],640,480)).toBe(false);expect(handCoversMouth(face,[],640,480)).toBe(false);
  });
});
