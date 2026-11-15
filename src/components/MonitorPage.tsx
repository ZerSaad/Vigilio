import { useState } from 'react';
import { ArrowRight, Camera, Clock3, Eye, EyeOff, LoaderCircle, LockKeyhole, Play, ScanFace, Square, Volume2 } from './Icons';
import { StatusPanel } from './StatusPanel';
import { SignalChart } from './SignalChart';
import { duration } from './HistoryPage';
import type { useMonitor } from '../hooks/useMonitor';
import type { Scenario, Session, Settings } from '../core/types';

type Monitor = ReturnType<typeof useMonitor>;
const scenarios: { id: Scenario; label: string }[] = [
  { id: 'normal', label: 'Yeux ouverts' }, { id: 'blink', label: 'Clignements' },
  { id: 'closed', label: 'Yeux fermés' }, { id: 'yawn', label: 'Bâillement' },
  { id: 'yawns', label: 'Bâillements répétés' }, { id: 'head-down', label: 'Tête abaissée' }, { id: 'lost', label: 'Visage absent' },
  { id: 'low-light', label: 'Faible lumière' }, { id: 'dark', label: 'Obscurité' }, { id: 'covered-yawns', label: 'Yeux masqués + bâillements' },
  { id: 'hand-mouth', label: 'Main devant la bouche' }, { id: 'hand-closed', label: 'Main + yeux fermés' },
];

function CameraView({ monitor: m }: { monitor: Monitor }) {
  const simulated = m.active && m.mode === 'simulation';
  const simulatedLabel = scenarios.find(item => item.id === m.scenario)?.label;
  const Icon = simulated ? (m.scenario === 'lost' ? ScanFace : m.scenario === 'closed' ? EyeOff : Eye) : Camera;
  return (
    <div className={`camera-view${m.active ? ' is-active' : ''}`}>
      <video ref={m.videoRef} autoPlay playsInline muted className={m.active && !simulated ? 'visible-video' : ''} />
      <canvas ref={m.canvasRef} aria-hidden="true" />
      {m.active && <div className="camera-topline">
        <span className="camera-source"><span className="record-dot" />{simulated ? 'Simulation' : 'Caméra en direct'}</span>
        <span className="elapsed"><Clock3 size={14} />{duration(m.elapsed)}</span>
      </div>}
      {(!m.active || simulated) && <div className="camera-placeholder">
        {m.loading ? <LoaderCircle className="spinning" size={36} strokeWidth={1.4} /> : <Icon size={38} strokeWidth={1.3} />}
        <h2>{m.loading ? 'Préparation de la session' : simulated ? simulatedLabel : 'Caméra en veille'}</h2>
        <p>{m.loading || (simulated ? 'Scénario simulé, sans accès à la caméra.' : 'Votre caméra s’activera au démarrage.')}</p>
      </div>}
    </div>
  );
}

export function MonitorPage({ monitor: m, sessions, settings, onSunglasses, onHistory }: { monitor: Monitor; sessions: Session[]; settings:Settings; onSunglasses:(enabled:boolean)=>void; onHistory: () => void }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const s = m.snapshot;
  const last = sessions[0];
  return (
    <>
      <div className="page-heading"><h1>Surveillance</h1><p>Placez votre appareil face à vous, dans un endroit éclairé.</p></div>
      {m.error && <div className="error-banner" role="alert"><EyeOff size={20} /><div><strong>Session indisponible</strong><p>{m.error}</p></div></div>}
      {m.active && s.visibilityMessage && <div className="visibility-banner" role="status"><EyeOff size={18}/><p>{s.visibilityMessage}{s.enhanced&&m.mode==='camera'?' Correction de l’image active.':''}</p></div>}
      {m.active && s.mouthWarning && <div className="visibility-banner mouth-warning" role="status"><EyeOff size={18}/><p>{s.mouthWarning}</p></div>}
      <section className={`camera-panel state-${s.status}`} aria-label="Surveillance caméra">
        <CameraView monitor={m} />
        <div className="monitor-controls">
          <StatusPanel snapshot={s} active={m.active} />
          {m.loading ? <button className="button secondary" onClick={m.cancel}>Annuler</button>
            : m.active ? <button className="button stop" onClick={() => m.stop()}><Square size={15} />Terminer</button>
              : <button className="button primary" onClick={() => void m.start('camera')}><Play size={15} fill="currentColor" />Démarrer la session</button>}
        </div>
        {m.active && <dl className="session-metrics" aria-label="Chiffres de la session">
          <div><dt>Durée</dt><dd>{duration(m.elapsed)}</dd></div>
          <div><dt>Fermeture des yeux</dt><dd>{s.eyesReady&&s.ear!==null?<>{s.closedSeconds.toFixed(1)} <small>s</small></>:'Non mesurée'}</dd></div>
          <div><dt>Alertes</dt><dd>{m.alertCount}</dd></div>
        </dl>}
      </section>
      <div className="session-tools">
        <span className="privacy-note"><LockKeyhole size={14} />Analyse locale, sans enregistrement vidéo.</span>
        <div className="button-group">
          <button className="text-button" disabled={m.active || !!m.loading} onClick={() => void m.testSound()}><Volume2 size={16} />Tester le son</button>
          {!m.active && <button className="text-button" disabled={!!m.loading} onClick={() => void m.start('simulation')}>Essayer la simulation<ArrowRight size={14} /></button>}
        </div>
      </div>
      <label className="eyewear-toggle"><input type="checkbox" role="switch" aria-label="Lunettes de soleil" checked={settings.sunglasses} onChange={event=>onSunglasses(event.target.checked)}/><span>Je porte des lunettes de soleil</span></label>
      {m.active && m.mode === 'simulation' && <section className="simulation-panel" aria-label="Scénarios de simulation">
        <h2>Scénarios de test</h2>
        {s.calibration < 1 && <p>Attendez la fin de la calibration pour choisir un scénario.</p>}
        <div className="scenario-buttons">{scenarios.map(item => (
          <button key={item.id} disabled={s.calibration < 1} className={`button small ${m.scenario === item.id ? 'selected' : 'secondary'}`} aria-pressed={m.scenario === item.id} onClick={() => m.setScenario(item.id)}>{item.label}</button>
        ))}</div>
      </section>}
      <details className="analysis-details" onToggle={event => setDetailsOpen(event.currentTarget.open)}>
        <summary>Détails de l’analyse</summary>
        {detailsOpen && <div className="analysis-content">
          <dl className="analysis-metrics">
            <div><dt>Ouverture des yeux (EAR)</dt><dd>{s.ear === null ? 'Non mesurée' : s.ear.toFixed(2)}</dd><small>Seuil : {s.threshold.toFixed(2)}</small></div>
            <div><dt>Fermetures cumulées</dt><dd>{s.perclos === null ? 'En attente' : Math.round(s.perclos * 100) + ' %'}</dd><small>Fenêtre de 30 secondes, au moins 20 secondes valides.</small></div>
            <div><dt>Fréquence d’analyse</dt><dd>{m.active ? `${m.fps} images/s` : 'Inactive'}</dd><small>{m.active && m.mode === 'camera' ? `${m.latency} ms par analyse` : m.active ? 'Données simulées' : 'Traitement sur cet appareil'}</small></div>
            <div><dt>Bâillements possibles</dt><dd>{s.yawns}</dd><small>{!s.mouthMeasured?'Analyse suspendue : bouche non exploitable.':`${s.recentYawns} en une minute ; avertissement à partir de ${s.ear===null||!s.eyesReady?2:3}.`}</small></div>
            <div><dt>Abaissement de la tête</dt><dd>{s.headDropDegrees === null ? 'Non mesuré' : `${Math.round(s.headDropDegrees)}°`}</dd><small>{s.headPoseReady ? `Écart par rapport à la calibration : seuil de ${s.ear===null||!s.eyesReady?17:20}° pendant ${s.monitoringMode==='limited'?'1,2':'1,5'} s.` : 'Gardez la tête droite pendant la calibration.'}</small></div>
            <div><dt>Éclairage du visage</dt><dd>{s.luminance===null?'Non mesuré':s.lighting==='dark'?'Insuffisant':s.lighting==='low'?'Faible':'Suffisant'}</dd><small>{s.enhanced?'Correction gamma et contraste active.':'Mesure sur l’image brute, avant correction.'}</small></div>
          </dl>
          <SignalChart snapshot={s} active={m.active} />
        </div>}
      </details>
      {last && !m.active && <button className="last-session" onClick={onHistory}>
        <span>Dernière session <small>{last.mode === 'simulation' ? 'Simulation' : 'Caméra'} · {duration(last.durationMs)} · {last.alerts} alerte{last.alerts > 1 ? 's' : ''}</small></span><ArrowRight size={17} />
      </button>}
      <p className="safety-note">En cas de fatigue, arrêtez-vous dans un endroit sûr. Testez uniquement à l’arrêt.</p>
    </>
  );
}
