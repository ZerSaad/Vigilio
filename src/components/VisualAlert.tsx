import { useEffect, useRef } from 'react';
import { AlertTriangle } from './Icons';
import { useVisualAlert } from '../hooks/useVisualAlert';
import type { Status } from '../core/types';

export function VisualAlert({ active, status, enabled }: { active: boolean; status: Status; enabled: boolean }) {
  const { visible, dismiss } = useVisualAlert(active, status, enabled);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (visible && !element.open) element.showModal();
    else if (!visible && element.open) element.close();
    return () => { if (element.open) element.close(); };
  }, [visible]);
  return <dialog ref={dialog} className="visual-alert" aria-labelledby="visual-alert-title" aria-describedby="visual-alert-description" onCancel={dismiss}>
    <div className="visual-alert-content">
      <AlertTriangle size={48} strokeWidth={1.5} aria-hidden="true" />
      <h2 id="visual-alert-title">Arrêtez-vous en sécurité</h2>
      <p id="visual-alert-description">Des signes persistants de somnolence sont détectés. Prévoyez une pause dans un endroit sûr.</p>
      <button className="visual-alert-dismiss" autoFocus onClick={dismiss}>Masquer l’alerte visuelle</button>
    </div>
  </dialog>;
}
