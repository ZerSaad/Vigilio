import { Capacitor, registerPlugin } from '@capacitor/core';

interface NativeHaptics {
  capability(): Promise<{ available: boolean; amplitudeControl: boolean }>;
  pulse(options: { level: number }): Promise<{ available: boolean }>;
  cancel(): Promise<void>;
}
const native = registerPlugin<NativeHaptics>('VigilanceHaptics');
let pending = Promise.resolve();
const android = () => Capacitor.getPlatform() === 'android';
function enqueue(action: () => Promise<unknown>) { pending = pending.then(action).then(() => undefined).catch(() => undefined); }

export function pulseVibration(level: number) {
  if (android()) { enqueue(() => native.pulse({ level })); return; }
  try { navigator.vibrate?.(level === 0 ? [40] : level === 1 ? [80, 120, 80] : [120, 140, 120, 140, 120]); } catch { /* Unsupported browser: audio and visual alerts continue. */ }
}
export function cancelVibration() {
  if (android()) { enqueue(() => native.cancel()); return; }
  try { navigator.vibrate?.(0); } catch { /* No vibration device/API. */ }
}
export async function vibrationCapability(): Promise<string> {
  if (android()) {
    try { const info = await native.capability(); return info.available ? (info.amplitudeControl ? 'Vibreur Android disponible, intensité progressive.' : 'Vibreur Android disponible, impulsions de durée progressive.') : 'Cet appareil ne possède pas de vibreur.'; }
    catch { return 'Vibreur Android non vérifié. Testez sur le téléphone.'; }
  }
  return typeof navigator.vibrate === 'function' ? 'Vibration via le navigateur, à vérifier sur votre téléphone.' : 'Vibration non disponible dans ce navigateur.';
}
