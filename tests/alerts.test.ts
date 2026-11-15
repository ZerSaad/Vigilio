import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AlertService } from '../src/core/alerts';
import { DEFAULT_SETTINGS } from '../src/core/types';
const haptics=vi.hoisted(()=>({pulse:vi.fn(),cancel:vi.fn()}));
vi.mock('../src/core/haptics',()=>({pulseVibration:haptics.pulse,cancelVibration:haptics.cancel}));
let peaks:number[]=[];
let attacks:number[]=[];
class FakeContext {
  state='running';destination={};
  get currentTime(){return performance.now()/1000;}
  async resume(){}
  createOscillator(){return {type:'',frequency:{value:0},connect(){},disconnect(){},start(){},stop(){},onended:null};}
  createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(value:number,time:number){if(value>0){peaks.push(value);attacks.push(time);}}},connect(){},disconnect(){}};}
}
beforeEach(()=>{vi.useFakeTimers({toFake:['performance','setInterval','clearInterval','setTimeout','clearTimeout']});vi.stubGlobal('AudioContext',FakeContext);peaks=[];attacks=[];vi.clearAllMocks();});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
describe('Progressive alert delivery',()=>{
  it('starts softly, ramps over eight seconds and respects the volume ceiling',async()=>{
    const alert=new AlertService({...DEFAULT_SETTINGS});await alert.unlock();alert.setStatus('alert');
    const initial=peaks[0];expect(initial).toBeCloseTo(DEFAULT_SETTINGS.volume*0.65*0.15);expect(attacks[0]).toBeCloseTo(0.12);
    vi.advanceTimersByTime(9000);
    expect(Math.max(...peaks)).toBeGreaterThan(initial*5);expect(Math.max(...peaks)).toBeLessThanOrEqual(DEFAULT_SETTINGS.volume*0.65);
    expect(haptics.pulse.mock.calls.map(call=>call[0])).toContain(0);expect(haptics.pulse.mock.calls.map(call=>call[0])).toContain(2);
    alert.stop();
  });
  it('stops repeating audio and vibration after recovery',async()=>{
    const alert=new AlertService({...DEFAULT_SETTINGS});await alert.unlock();alert.setStatus('alert');vi.advanceTimersByTime(4000);alert.setStatus('normal');
    const count=peaks.length,calls=haptics.pulse.mock.calls.length;vi.advanceTimersByTime(12000);
    expect(peaks.length).toBe(count);expect(haptics.pulse.mock.calls.length).toBe(calls);expect(haptics.cancel).toHaveBeenCalled();
  });
  it('repeats a gentle warning for excessive yawning without using full alert volume',async()=>{
    const alert=new AlertService({...DEFAULT_SETTINGS});await alert.unlock();alert.setStatus('warning');vi.advanceTimersByTime(12000);
    expect(peaks.length).toBeGreaterThan(1);expect(Math.max(...peaks)).toBeLessThanOrEqual(DEFAULT_SETTINGS.volume*0.65*0.65);alert.stop();
  });
  it('honors vibration disabled and stops the preview automatically',async()=>{
    const alert=new AlertService({...DEFAULT_SETTINGS,vibration:false});await alert.unlock();alert.test();vi.advanceTimersByTime(8600);
    const count=peaks.length;vi.advanceTimersByTime(10000);expect(peaks.length).toBe(count);expect(haptics.pulse).not.toHaveBeenCalled();
  });
});

