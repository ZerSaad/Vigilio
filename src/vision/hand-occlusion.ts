import type { Point } from '../core/geometry';

const bones = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
const cross = (a: Point, b: Point, c: Point) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
function hull(points: Point[]) {
  const sorted=[...points].sort((a,b)=>a.x-b.x||a.y-b.y),lower:Point[]=[],upper:Point[]=[];
  for(const p of sorted){while(lower.length>1&&cross(lower[lower.length-2],lower[lower.length-1],p)<=0)lower.pop();lower.push(p);}
  for(const p of [...sorted].reverse()){while(upper.length>1&&cross(upper[upper.length-2],upper[upper.length-1],p)<=0)upper.pop();upper.push(p);}
  return [...lower.slice(0,-1),...upper.slice(0,-1)];
}
function inside(point: Point, polygon: Point[]) {
  let result=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[i],b=polygon[j];
    if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)result=!result;
  }
  return result;
}
function distanceToSegment(p: Point,a: Point,b: Point) {
  const dx=b.x-a.x,dy=b.y-a.y;
  const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/Math.max(dx*dx+dy*dy,1e-8)));
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
}
/** Test actual palm/finger geometry, not just an oversized hand bounding box.
 * This detects projected overlap; temporal confirmation is handled by the engine. */
export function handCoversMouth(face: Point[], hands: Point[][], width: number, height: number): boolean {
  if(face.length<468||!width||!height)return false;
  const pixel=(p:Point):Point=>({x:p.x*width,y:p.y*height});
  const lips=[61,291,13,14].map(i=>face[i]);
  if(lips.some(p=>!p||![p.x,p.y].every(Number.isFinite)))return false;
  const center=pixel({x:(face[61].x+face[291].x)/2,y:(face[13].y+face[14].y)/2});
  const mouthWidth=Math.hypot((face[61].x-face[291].x)*width,(face[61].y-face[291].y)*height);
  if(mouthWidth<width*0.02)return false;
  const probes=[center,{x:center.x-mouthWidth*0.22,y:center.y},{x:center.x+mouthWidth*0.22,y:center.y}];
  return hands.some(hand=>{
    if(hand.length!==21||hand.some(p=>![p.x,p.y].every(Number.isFinite)))return false;
    const points=hand.map(pixel),palm=hull([0,1,2,5,9,13,17].map(i=>points[i]));
    if(probes.some(p=>inside(p,palm)))return true;
    const radius=Math.max(3,Math.min(mouthWidth*0.3,Math.hypot(points[5].x-points[17].x,points[5].y-points[17].y)*0.12));
    return bones.some(([a,b])=>probes.some(p=>distanceToSegment(p,points[a],points[b])<radius));
  });
}
