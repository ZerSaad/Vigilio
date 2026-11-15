import { describe, expect, it } from 'vitest';
import { VigilanceEngine } from '../src/core/engine';
import { DEFAULT_SETTINGS, type Observation } from '../src/core/types';
import { observationFromLandmarks } from '../src/core/geometry';
const open: Observation={valid:true,ear:0.3,mouth:0.1};
const closed: Observation={valid:true,ear:0.08,mouth:0.1};
const lost: Observation={valid:false,ear:0,mouth:0,reason:'Visage absent'};
function rig(){const engine=new VigilanceEngine({...DEFAULT_SETTINGS});let t=0;return {engine, tick(o:Observation,ms:number){for(let n=0;n<ms;n+=100){t+=100;engine.update(o,t);}return engine.snapshot;},gap(ms:number){t+=ms;}};}
describe('Temporal vigilance decisions',()=>{
  it('does not silence an established strong alarm just because the image becomes unreadable',()=>{
    const r=rig();r.tick(open,4500);expect(r.tick(closed,2200).status).toBe('alert');
    const lostAlarm=r.tick(lost,2000);expect(lostAlarm.status).toBe('alert');expect(lostAlarm.monitoringMode).toBe('unavailable');
    expect(r.tick(open,1000).status).toBe('normal');
  });
  it('shows a mouth-cover warning without counting a guessed yawn or disabling eyes',()=>{
    const r=rig();r.tick({...open,headPitch:0},4500);
    const s=r.tick({...open,mouth:0.9,mouthValid:false,mouthCovered:true,headPitch:0},21000);
    expect(s.mouthCovered).toBe(true);expect(s.mouthWarning).toContain('baissez votre main');expect(s.status).toBe('limited');
    expect(s.yawns).toBe(0);expect(s.ear).toBe(0.3);expect(s.perclos).toBe(0);
    expect(r.tick({...open,headPitch:0},1000).mouthCovered).toBe(false);
  });
  it('still detects sustained eye closure while a hand masks the mouth',()=>{
    const r=rig();r.tick({...open,headPitch:0},4500);
    expect(r.tick({...closed,mouthCovered:true,mouthValid:false,headPitch:0},2200).status).toBe('alert');
    expect(r.engine.snapshot.reason).toContain('Yeux fermés');
  });
  it('prioritizes downward head movement when the mouth is covered',()=>{
    const r=rig();r.tick({...open,headPitch:0},4500);r.tick({...open,mouthCovered:true,mouthValid:false,headPitch:0},800);
    expect(r.tick({...open,mouthCovered:true,mouthValid:false,headPitch:22},1500).status).toBe('alert');
  });
  it('ignores a brief hand pass and never reassures when every channel is hidden',()=>{
    const r=rig();r.tick({...open,headPitch:0},4500);
    expect(r.tick({...open,mouthCovered:true,mouthValid:false,headPitch:0},200).mouthCovered).toBe(false);
    expect(r.tick(open,1000).status).toBe('normal');
    const s=r.tick({valid:false,faceValid:true,ear:0,mouth:0,mouthValid:false,mouthCovered:true,headPitch:null},1000);
    expect(s.status).toBe('unavailable');
  });
  it('calibrates posture with sunglasses from startup without inventing eye measurements',()=>{
    const settings={...DEFAULT_SETTINGS,sunglasses:true},engine=new VigilanceEngine(settings);
    for(let now=100;now<=7500;now+=100)engine.update({...open,ear:0.05,faceValid:true,mouthValid:true,headPitch:0},now);
    expect(engine.snapshot.status).toBe('limited');expect(engine.snapshot.headPoseReady).toBe(true);expect(engine.snapshot.eyesReady).toBe(false);
    expect(engine.snapshot.ear).toBeNull();expect(engine.snapshot.perclos).toBeNull();expect(engine.snapshot.closedSeconds).toBe(0);
  });
  it('counts yawns independently of hidden eyes and warns after two in limited mode',()=>{
    const engine=new VigilanceEngine({...DEFAULT_SETTINGS});let now=0;
    const tick=(mouth:number,ms:number)=>{for(let n=0;n<ms;n+=100){now+=100;engine.update({valid:false,faceValid:true,mouthValid:true,ear:0,mouth,headPitch:0,eyesOccluded:true},now);}};
    tick(0.1,4500);tick(0.8,2000);tick(0.1,800);expect(engine.snapshot.status).toBe('limited');
    tick(0.8,2000);expect(engine.snapshot.status).toBe('warning');expect(engine.snapshot.yawns).toBe(2);
  });
  it('uses more sensitive head thresholds in dim light without treating blindness as normal',()=>{
    const r=rig();r.tick({...open,headPitch:0},4500);
    expect(r.tick({...open,headPitch:18},2500).status).toBe('normal');
    r.tick({...open,headPitch:0},1000);
    expect(r.tick({...open,valid:false,faceValid:true,mouthValid:true,headPitch:18,lighting:'low'},1500).status).toBe('alert');
    expect(r.engine.snapshot.monitoringMode).toBe('limited');expect(r.engine.snapshot.ear).toBeNull();
  });
  it('uses 20 degrees normally and 17 only when the eyes cannot be used',()=>{
    const normal=rig();normal.tick({...open,headPitch:0},4500);
    expect(normal.tick({...open,headPitch:19},2000).status).toBe('normal');
    expect(normal.tick({...open,headPitch:20},1800).status).toBe('alert');
    const hidden=rig();hidden.tick({...open,headPitch:0},4500);
    const covered={...open,valid:false,faceValid:true,mouthValid:true,eyesOccluded:true};
    expect(hidden.tick({...covered,headPitch:16},2000).status).toBe('limited');
    expect(hidden.tick({...covered,headPitch:17},1500).status).toBe('alert');
    const mouthOnly=rig();mouthOnly.tick({...open,headPitch:0},4500);
    expect(mouthOnly.tick({...open,mouthCovered:true,mouthValid:false,headPitch:17},2500).status).toBe('limited');
    expect(mouthOnly.tick({...open,mouthCovered:true,mouthValid:false,headPitch:20},1500).status).toBe('alert');
  });
  it('rejects every visual channel in complete darkness even if a model guessed a face',()=>{
    const r=rig();r.tick({...open,headPitch:0},4500);
    expect(r.tick({...open,faceValid:true,mouthValid:true,mouth:0.8,headPitch:40,lighting:'dark'},10000).status).toBe('unavailable');
    expect(r.engine.snapshot.yawns).toBe(0);expect(r.engine.snapshot.headDropDegrees).toBeNull();
  });
  it('calibrates eyes after removing sunglasses and restores full surveillance',()=>{
    const engine=new VigilanceEngine({...DEFAULT_SETTINGS,sunglasses:true});
    for(let t=100;t<=4500;t+=100)engine.update({...open,headPitch:0},t);
    expect(engine.snapshot.status).toBe('limited');
    engine.updateSettings({...DEFAULT_SETTINGS,sunglasses:false});
    for(let t=4600;t<=10000;t+=100)engine.update({...open,headPitch:0},t);
    expect(engine.snapshot.status).toBe('normal');expect(engine.snapshot.monitoringMode).toBe('full');expect(engine.snapshot.eyesReady).toBe(true);
  });
  it('calibrates with open eyes and ignores ordinary blinks',()=>{const r=rig();expect(r.tick(open,4500).status).toBe('normal');expect(r.engine.snapshot.threshold).toBeCloseTo(0.204);expect(r.tick(closed,200).status).toBe('normal');expect(r.tick(open,100).blinks).toBe(1);});
  it('does not calibrate from closed eyes',()=>{const r=rig();expect(r.tick(closed,8000).status).toBe('calibrating');expect(r.engine.snapshot.calibration).toBe(0);});
  it('alerts for sustained closure and waits for stable reopening',()=>{const r=rig();r.tick(open,4500);expect(r.tick(closed,2100).status).toBe('alert');expect(r.tick(open,300).status).toBe('alert');expect(r.tick(open,600).status).toBe('normal');});
  it('breaks closure continuity when the face is lost',()=>{const r=rig();r.tick(open,4500);r.tick(closed,1500);expect(r.tick(lost,1000).status).toBe('unavailable');expect(r.tick(closed,1500).status).not.toBe('alert');});
  it('does not count missing frames as closed eyes or valid time',()=>{const r=rig();r.tick(open,4500);r.tick(open,5000);const valid=r.engine.snapshot.validMs;r.tick(lost,5000);expect(r.engine.snapshot.validMs).toBe(valid);expect(r.engine.snapshot.perclos).toBe(null);});
  it('does not bridge a stalled video stream',()=>{const r=rig();r.tick(open,4500);r.tick(closed,1500);r.gap(5000);expect(r.tick(closed,600).status).not.toBe('alert');});
  it('requires window coverage before reporting PERCLOS',()=>{const r=rig();r.tick(open,4500);expect(r.tick(open,10000).perclos).toBeNull();expect(r.tick(open,11000).perclos).toBe(0);});
  it('warns about repeated long closures',()=>{const r=rig();r.tick(open,4500);for(let i=0;i<3;i++){r.tick(closed,900);r.tick(open,300);}expect(r.engine.snapshot.status).toBe('warning');});
  it('counts each mouth opening once and does not alert for a yawn alone',()=>{const r=rig();r.tick(open,4500);const s=r.tick({...open,mouth:0.8},5000);expect(s.yawns).toBe(1);expect(s.status).toBe('normal');});
  it('invalidates insufficient landmarks',()=>{expect(observationFromLandmarks([],640,480).valid).toBe(false);});
  it('warns for three separate yawns without requiring eye closures',()=>{
    const r=rig();r.tick(open,4500);
    for(let i=0;i<3;i++){r.tick({...open,mouth:0.8},2000);r.tick(open,800);}
    expect(r.engine.snapshot.yawns).toBe(3);expect(r.engine.snapshot.status).toBe('warning');expect(r.engine.snapshot.reason).toContain('Bâillements');
    expect(r.tick(open,61000).status).toBe('normal');
  });
  it('does not split one yawn because of brief mouth or tracking flicker',()=>{
    const r=rig();r.tick(open,4500);r.tick({...open,mouth:0.8},2000);r.tick(open,200);r.tick({...open,mouth:0.8},2000);r.tick(lost,200);r.tick({...open,mouth:0.8},2000);
    expect(r.engine.snapshot.yawns).toBe(1);expect(r.engine.snapshot.status).toBe('normal');
  });
  it('detects sustained downward head pitch relative to the calibrated posture',()=>{
    const r=rig();r.tick({...open,headPitch:10},4500);
    expect(r.engine.snapshot.headPoseReady).toBe(true);
    expect(r.tick({...open,headPitch:40},1800).status).toBe('alert');
    expect(r.engine.snapshot.reason).toContain('Tête abaissée');
    expect(r.tick({...open,headPitch:10},1100).status).toBe('normal');
  });
  it('ignores a brief head nod and upward head rotation',()=>{
    const r=rig();r.tick({...open,headPitch:0},4500);
    expect(r.tick({...open,headPitch:32},800).status).toBe('normal');
    expect(r.tick({...open,headPitch:0},1200).status).toBe('normal');
    expect(r.tick({...open,headPitch:-32},3000).status).toBe('normal');
  });
  it('can warn for a visible head even if the eyes become unmeasurable',()=>{
    const r=rig();r.tick({...open,headPitch:0},4500);
    expect(r.tick({...lost,headPitch:32},1800).status).toBe('alert');
    expect(r.engine.snapshot.ear).toBeNull();
  });
  it('does not infer head drop from a lost face or bridge head measurements over gaps',()=>{
    const r=rig();r.tick({...open,headPitch:0},4500);r.tick({...open,headPitch:32},1000);
    expect(r.tick(lost,800).status).toBe('unavailable');
    expect(r.tick({...open,headPitch:32},1000).status).toBe('normal');
    r.gap(5000);expect(r.tick({...open,headPitch:32},600).status).toBe('normal');
  });
});
