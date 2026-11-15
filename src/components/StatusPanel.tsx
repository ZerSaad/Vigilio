import { BellRing, Eye, EyeOff, ScanFace, AlertTriangle } from './Icons';
import type { Snapshot, Status } from '../core/types';

export const STATUS_LABEL: Record<Status, string> = {
  idle: 'Prêt à démarrer', calibrating: 'Calibration en cours', normal: 'Surveillance normale',
  limited: 'Surveillance limitée',
  warning: 'Vigilance requise', alert: 'Pause nécessaire', unavailable: 'Surveillance indisponible',
};
const icons = { idle: ScanFace, calibrating: ScanFace, normal: Eye, limited: EyeOff, warning: AlertTriangle, alert: BellRing, unavailable: EyeOff };

export function StatusPanel({ snapshot, active }: { snapshot: Snapshot; active: boolean }) {
  const Icon = icons[snapshot.status];
  return (
    <div className={`session-status state-${snapshot.status}`} aria-label="État de vigilance">
      <span className="status-icon"><Icon size={23} strokeWidth={1.7} /></span>
      <div className="status-copy" role="status" aria-live="polite">
        <h2>{STATUS_LABEL[snapshot.status]}</h2>
        <p>{active ? snapshot.reason : 'La calibration est automatique au démarrage.'}</p>
        {snapshot.status === 'calibrating' && <div className="calibration-progress">
          <progress max="1" value={snapshot.calibration} aria-label="Progression de la calibration" />
          <span>{Math.round(snapshot.calibration * 100)} %</span>
        </div>}
      </div>
    </div>
  );
}
