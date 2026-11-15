import type { Settings, Status } from './types';
import { cancelVibration, pulseVibration } from './haptics';

export class AlertService {
  private context: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private preview: ReturnType<typeof setTimeout> | null = null;
  private active: OscillatorNode[] = [];
  private lastStatus: Status = 'idle';
  private startedAt = 0;
  constructor(private settings: Settings) {}

  async unlock() {
    this.context ??= new AudioContext();
    if (this.context.state === 'suspended') await this.context.resume();
    if (this.context.state !== 'running') throw new Error('Le son est bloqué. Touchez « Tester le son » puis réessayez.');
  }
  configure(settings: Settings) {
    this.settings = settings;
    if (!settings.vibration) cancelVibration();
    if (settings.volume === 0) this.stopTones();
  }
  setStatus(status: Status) {
    if (status === this.lastStatus) return;
    this.stop();
    this.lastStatus = status;
    if (status !== 'alert' && status !== 'warning') return;
    this.startedAt = performance.now();
    this.beep();
    this.timer = setInterval(() => this.beep(), status === 'alert' ? 1800 : 3000);
  }
  test() {
    this.setStatus('alert');
    this.preview = setTimeout(() => this.stop(), 8500);
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    if (this.preview) clearTimeout(this.preview);
    this.timer = null; this.preview = null;
    this.stopTones(); cancelVibration(); this.lastStatus = 'idle';
  }
  private stopTones() {
    for (const oscillator of this.active) { try { oscillator.stop(); } catch { /* Already ended. */ } }
    this.active = [];
  }
  private beep() {
    const elapsed = Math.max(0, performance.now() - this.startedAt);
    const urgent = this.lastStatus === 'alert';
    // Soft onset; reach the user-selected ceiling over eight seconds, never exceed it.
    const fraction = Math.min(urgent ? 1 : 0.65, 0.15 + elapsed / 8000 * 0.85);
    const level = urgent ? (elapsed >= 6000 ? 2 : elapsed >= 3000 ? 1 : 0) : 0;
    if (this.context?.state === 'running' && this.settings.volume > 0) {
      const context = this.context;
      for (let index = 0; index < level + 1; index++) {
        const oscillator = context.createOscillator(), gain = context.createGain();
        const time = context.currentTime + index * 0.48;
        oscillator.type = 'triangle'; oscillator.frequency.value = 880 + level * 100;
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(this.settings.volume * 0.65 * fraction, time + 0.12);
        gain.gain.setValueAtTime(this.settings.volume * 0.65 * fraction, time + 0.2);
        gain.gain.linearRampToValueAtTime(0, time + 0.42);
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.start(time); oscillator.stop(time + 0.43);
        this.active.push(oscillator);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); this.active = this.active.filter(item => item !== oscillator); };
      }
    }
    if (this.settings.vibration) pulseVibration(level);
  }
}
