export type Status = 'idle' | 'calibrating' | 'normal' | 'limited' | 'warning' | 'alert' | 'unavailable';
export type Lighting = 'normal' | 'low' | 'dark';
export type Mode = 'camera' | 'simulation';
export type Scenario = 'normal' | 'blink' | 'closed' | 'yawn' | 'yawns' | 'head-down' | 'lost' | 'low-light' | 'dark' | 'covered-yawns' | 'hand-mouth' | 'hand-closed';
export interface Settings { closureSeconds: number; volume: number; vibration: boolean; perclosThreshold: number; cameraId: string; sunglasses: boolean; visualAlert: boolean }
export interface Observation {
  /** valid refers to usable EYE measurements, not face presence. */
  valid: boolean; ear: number; mouth: number; reason?: string; headPitch?: number | null;
  faceValid?: boolean; mouthValid?: boolean; lighting?: Lighting; eyesOccluded?: boolean;
  luminance?: number; enhanced?: boolean;
  mouthCovered?: boolean;
}
export interface Snapshot {
  status: Status; reason: string; ear: number | null; threshold: number;
  closedSeconds: number; perclos: number | null; coverage: number;
  calibration: number; yawns: number; blinks: number; validMs: number;
  recentYawns: number; headDropDegrees: number | null; headDownSeconds: number; headPoseReady: boolean;
  monitoringMode: 'full' | 'limited' | 'unavailable'; visibilityMessage: string;
  lighting: Lighting; luminance: number | null; enhanced: boolean; eyesReady: boolean;
  mouthCovered: boolean; mouthMeasured: boolean; mouthWarning: string;
}
export interface SessionEvent { at: number; status: Status; message: string }
export interface Session {
  id: string; startedAt: number; endedAt: number; durationMs: number; mode: Mode;
  alerts: number; warnings: number; validMs: number; blinks: number; yawns: number;
  events: SessionEvent[]; interrupted?: boolean;
}
export const DEFAULT_SETTINGS: Settings = { closureSeconds: 2, volume: 0.85, vibration: true, perclosThreshold: 0.2, cameraId: '', sunglasses: false, visualAlert: true };
export const EMPTY: Snapshot = { status: 'idle', reason: 'Prêt pour une nouvelle session', ear: null, threshold: 0.2, closedSeconds: 0, perclos: null, coverage: 0, calibration: 0, yawns: 0, blinks: 0, validMs: 0, recentYawns: 0, headDropDegrees: null, headDownSeconds: 0, headPoseReady: false, monitoringMode: 'full', visibilityMessage: '', lighting: 'normal', luminance: null, enhanced: false, eyesReady: false, mouthCovered: false, mouthMeasured: false, mouthWarning: '' };
