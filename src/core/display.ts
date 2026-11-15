import { Capacitor, registerPlugin } from '@capacitor/core';
const display = registerPlugin<{ begin(): Promise<void>; end(): Promise<void> }>('VigilanceDisplay');
let pending = Promise.resolve();
/** Serialize boost/restore so a delayed native reply cannot re-enable brightness
 * after recovery. The native plugin also restores independently on app pause. */
export function setAlertBrightness(enabled: boolean) {
  if (Capacitor.getPlatform() !== 'android') return;
  pending = pending.then(() => enabled ? display.begin() : display.end()).catch(() => undefined);
}
