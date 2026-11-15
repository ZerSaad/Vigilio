import { useEffect, useState } from 'react';
import type { Snapshot } from '../core/types';

export function SignalChart({ snapshot, active }: { snapshot: Snapshot; active: boolean }) {
  const [samples, setSamples] = useState<(number | null)[]>([]);
  useEffect(() => {
    if (!active) { setSamples([]); return; }
    setSamples(previous => [...previous, snapshot.ear].slice(-80));
  }, [snapshot, active]);
  const segments: string[] = [];
  let part: string[] = [];
  samples.forEach((ear, index) => {
    if (ear === null) { if (part.length) segments.push(part.join(' ')); part = []; }
    else part.push(`${index * 600 / 79},${100 - Math.min(ear, 0.5) / 0.5 * 90}`);
  });
  if (part.length) segments.push(part.join(' '));
  const threshold = 100 - snapshot.threshold / 0.5 * 90;
  return <section className="signal-panel" aria-label="Signal des yeux">
    <div className="panel-heading"><h2>Signal des yeux</h2><span className="chart-legend"><i />Ouverture <b />Seuil de fermeture</span></div>
    <div className="chart-wrap">
      <div className="chart-y"><span>0,50</span><span>0,25</span><span>0,00</span></div>
      <svg viewBox="0 0 600 105" preserveAspectRatio="none" role="img" aria-label={active ? 'Évolution de l’ouverture des yeux : EAR' : 'Graphique en attente d’une session'}>
        <path d="M0 10H600 M0 55H600 M0 100H600" className="chart-grid" />
        <line x1="0" x2="600" y1={threshold} y2={threshold} className="chart-threshold" />
        {segments.map((points, index) => <polyline key={index} points={points} className="chart-signal" />)}
      </svg>
      {!active && <span className="chart-empty">En attente d’une session</span>}
    </div>
    <div className="chart-x"><span>Échantillons récents</span><span>Maintenant</span></div>
  </section>;
}
