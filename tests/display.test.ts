import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({platform:vi.fn(()=> 'android'),begin:vi.fn(async()=>{}),end:vi.fn(async()=>{})}));
vi.mock('@capacitor/core',()=>({Capacitor:{getPlatform:mocks.platform},registerPlugin:()=>({begin:mocks.begin,end:mocks.end})}));
afterEach(()=>{vi.clearAllMocks();vi.resetModules();});
describe('Temporary screen brightness',()=>{
  it('restores after a pending native brightness boost in the original order',async()=>{
    mocks.platform.mockReturnValue('android');
    let release!:()=>void;
    mocks.begin.mockImplementationOnce(()=>new Promise<void>(resolve=>{release=resolve;}));
    const {setAlertBrightness}=await import('../src/core/display');
    setAlertBrightness(true);setAlertBrightness(false);
    await vi.waitFor(()=>expect(mocks.begin).toHaveBeenCalledTimes(1));expect(mocks.end).not.toHaveBeenCalled();
    release();await vi.waitFor(()=>expect(mocks.end).toHaveBeenCalledTimes(1));
  });
  it('does not pretend to control a browser screen brightness',async()=>{
    mocks.platform.mockReturnValue('web');const {setAlertBrightness}=await import('../src/core/display');
    setAlertBrightness(true);setAlertBrightness(false);await Promise.resolve();expect(mocks.begin).not.toHaveBeenCalled();expect(mocks.end).not.toHaveBeenCalled();
  });
});
