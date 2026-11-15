import { describe, expect, it } from 'vitest';
import { headPitchFromMatrix } from '../src/core/head-pose';
function pitchMatrix(degrees: number) {
  const a=degrees*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  return {rows:4,columns:4,data:[1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,-40,1]};
}
describe('Head pose from canonical-to-camera matrices',()=>{
  it('distinguishes down from up in column-major transforms',()=>{
    expect(headPitchFromMatrix(pitchMatrix(30))).toBeCloseTo(30);
    expect(headPitchFromMatrix(pitchMatrix(-30))).toBeCloseTo(-30);
    expect(headPitchFromMatrix(pitchMatrix(0))).toBe(0);
  });
  it('does not mistake a side turn for a downward nod',()=>{
    const a=Math.PI/3,c=Math.cos(a),s=Math.sin(a);
    expect(headPitchFromMatrix({rows:4,columns:4,data:[c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,-40,1]})).toBeNull();
  });
  it('rejects missing, degenerate and non-finite pose estimates',()=>{
    expect(headPitchFromMatrix()).toBeNull();expect(headPitchFromMatrix({rows:4,columns:4,data:new Array(16).fill(0)})).toBeNull();
    const matrix=pitchMatrix(20);matrix.data[1]=NaN;expect(headPitchFromMatrix(matrix)).toBeNull();
  });
});
