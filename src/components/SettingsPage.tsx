import { useEffect, useState } from 'react';
import type { Settings } from '../core/types';
import { DEFAULT_SETTINGS } from '../core/types';
import { Volume2 } from './Icons';
import { vibrationCapability } from '../core/haptics';

export function SettingsPage({ settings, onChange, onTest, active }: { settings: Settings; onChange: (settings: Settings) => void; onTest: () => void; active: boolean }) {
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraError, setCameraError] = useState('');
  const [vibrationHint, setVibrationHint] = useState('Vérification du vibreur…');
  async function listCameras() {
    try { const devices = await navigator.mediaDevices?.enumerateDevices(); setCameras(devices?.filter(device => device.kind === 'videoinput') ?? []); setCameraError(''); }
    catch { setCameraError('Liste des caméras inaccessible. Vérifiez les autorisations.'); }
  }
  useEffect(() => { void listCameras(); }, []);
  useEffect(() => { let mounted=true; void vibrationCapability().then(hint=>{if(mounted)setVibrationHint(hint);}); return()=>{mounted=false;}; }, []);
  const change = (key: keyof Settings, value: Settings[keyof Settings]) => onChange({ ...settings, [key]: value });
  return <>
    <div className="page-heading"><h1>Réglages</h1><p>Caméra, détection et alertes.</p></div>
    <section className="settings-panel">
      <h2>Détection</h2>
      <label className="setting"><span><strong>Fermeture prolongée</strong><small>Durée avant l’alerte sonore répétée.</small></span><output>{settings.closureSeconds.toFixed(1)} s</output><input aria-label="Durée de fermeture avant alerte" type="range" min="1" max="4" step="0.1" value={settings.closureSeconds} onChange={event => change('closureSeconds', Number(event.target.value))} /><span className="range-labels"><small>1 s</small><small>4 s</small></span></label>
      <label className="setting"><span><strong>Fermetures cumulées</strong><small>Seuil d’avertissement sur une fenêtre de 30 secondes.</small></span><output>{Math.round(settings.perclosThreshold * 100)} %</output><input aria-label="Seuil PERCLOS" type="range" min="0.1" max="0.5" step="0.01" value={settings.perclosThreshold} onChange={event => change('perclosThreshold', Number(event.target.value))} /></label>
    </section>
    <section className="settings-panel">
      <h2>Alertes</h2>
      <p className="muted">Le son commence doucement et augmente sur 8 secondes, jusqu’au volume réglé.</p>
      <label className="setting"><span><strong>Volume</strong><small>Signal renforcé. Réglez aussi le volume média de l’appareil et testez à l’arrêt dans le véhicule.</small></span><output>{Math.round(settings.volume * 100)} %</output><input aria-label="Volume des alertes" type="range" min="0" max="1" step="0.05" value={settings.volume} onChange={event => change('volume', Number(event.target.value))} /></label>
      {settings.volume === 0 && <p className="inline-warning">Son coupé : alertes visuelles et vibration uniquement, si disponible.</p>}
      <label className="toggle-setting"><span><strong>Vibration</strong><small>{vibrationHint}</small></span><input type="checkbox" role="switch" checked={settings.vibration} onChange={event => change('vibration', event.target.checked)} /></label>
      <label className="toggle-setting"><span><strong>Alerte visuelle mobile</strong><small>Après 4 secondes d’alerte forte : pulsation lente de l’écran. Luminosité temporairement maximale sur Android.</small></span><input type="checkbox" role="switch" checked={settings.visualAlert} onChange={event=>change('visualAlert',event.target.checked)}/></label>
      <button className="button secondary" disabled={active} onClick={onTest}><Volume2 size={16} />Tester le son et la vibration</button>
    </section>
    <section className="settings-panel">
      <h2>Caméra</h2>
      <label className="select-label" htmlFor="camera-select">Source vidéo</label>
      <select id="camera-select" value={settings.cameraId} disabled={active} onChange={event => change('cameraId', event.target.value)}><option value="">Caméra automatique (frontale)</option>{cameras.filter(camera => camera.deviceId).map((camera, index) => <option value={camera.deviceId} key={camera.deviceId}>{camera.label || `Caméra ${index + 1}`}</option>)}</select>
      <p className="muted camera-help">{active ? 'Terminez la session pour changer de caméra.' : 'Les noms apparaissent après autorisation de la caméra.'}</p>
      <button className="text-button" onClick={() => void listCameras()}>Actualiser la liste</button>
      {cameraError && <p role="alert" className="inline-warning">{cameraError}</p>}
    </section>
    <div className="settings-end"><button className="text-button" onClick={() => onChange({ ...DEFAULT_SETTINGS })}>Rétablir les réglages par défaut</button><p className="footnote">Seuils expérimentaux. La calibration est refaite à chaque session. Gardez l’application visible pendant la surveillance.</p></div>
  </>;
}
