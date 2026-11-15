import { DEFAULT_SETTINGS, type Session, type Settings } from './types';
import { Capacitor, registerPlugin } from '@capacitor/core';
const nativeExport=registerPlugin<{save(options:{name:string;mime:string;content:string}):Promise<void>}>('SessionExport');
const SESSIONS = 'veille.sessions.v1', SETTINGS = 'veille.settings.v1', DRAFT = 'veille.active.v1';
export function loadSettings(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS) || '{}');
    const clamp = (n: unknown, fallback: number, min: number, max: number) => typeof n === 'number' && Number.isFinite(n) ? Math.max(min,Math.min(max,n)) : fallback;
    return { closureSeconds: clamp(s.closureSeconds,2,1,4), volume: clamp(s.volume,DEFAULT_SETTINGS.volume,0,1), perclosThreshold: clamp(s.perclosThreshold,0.2,0.1,0.5), vibration: typeof s.vibration === 'boolean' ? s.vibration : true, cameraId: typeof s.cameraId === 'string' ? s.cameraId : '', sunglasses: s.sunglasses === true, visualAlert: s.visualAlert !== false };
  } catch { return { ...DEFAULT_SETTINGS }; }
}
export function saveSettings(s: Settings) { localStorage.setItem(SETTINGS, JSON.stringify(s)); }
export function loadSessions(): Session[] {
  try { const a = JSON.parse(localStorage.getItem(SESSIONS) || '[]'); return Array.isArray(a) ? a.filter(s => s && typeof s.id === 'string' && Number.isFinite(s.startedAt) && Number.isFinite(s.durationMs) && Array.isArray(s.events)).slice(0,100) : []; } catch { return []; }
}
export function saveSession(s: Session) { const sessions = [s,...loadSessions().filter(x=>x.id!==s.id)].slice(0,100); localStorage.setItem(SESSIONS, JSON.stringify(sessions)); return sessions; }
export function saveDraft(s: Session) { localStorage.setItem(DRAFT, JSON.stringify(s)); }
export function clearDraft() { localStorage.removeItem(DRAFT); }
export function recoverDraft() {
  try { const s = JSON.parse(localStorage.getItem(DRAFT) || 'null'); if (s && typeof s.id === 'string' && Number.isFinite(s.durationMs) && Array.isArray(s.events)) { saveSession({...s, interrupted:true}); clearDraft(); return true; } } catch { /* Storage may be unavailable; live detection still works. */ }
  return false;
}
export function clearSessions() { localStorage.removeItem(SESSIONS); }
export async function downloadSessions(sessions: Session[], format: 'json' | 'csv') {
  const body = format === 'json' ? JSON.stringify(sessions,null,2) : '\uFEFFDate;Mode;Durée (s);Alertes;Avertissements;Surveillance valide (s);Clignements;Bâillements possibles\n' + sessions.map(s=>[new Date(s.startedAt).toISOString(),s.mode,Math.round(s.durationMs/1000),s.alerts,s.warnings,Math.round(s.validMs/1000),s.blinks,s.yawns].join(';')).join('\n');
  const mime=format==='json'?'application/json':'text/csv';
  if(Capacitor.isNativePlatform()){await nativeExport.save({name:`vigilio-sessions.${format}`,mime,content:body});return;}
  const url = URL.createObjectURL(new Blob([body], {type:mime+';charset=utf-8'}));
  const a = document.createElement('a'); a.href=url; a.download=`vigilio-sessions.${format}`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
