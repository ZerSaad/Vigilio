import { useState } from 'react';
import { ArrowDownToLine, ChevronRight, History, Trash2 } from './Icons';
import { downloadSessions } from '../core/storage';
import type { Session } from '../core/types';
import { STATUS_LABEL } from './StatusPanel';

export const duration = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};

export function HistoryPage({ sessions, onClear, notify }: { sessions: Session[]; onClear: () => void; notify: (message: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const cameraSessions = sessions.filter(session => session.mode === 'camera');
  function exportData(format: 'json' | 'csv') {
    void downloadSessions(sessions, format).catch(() => notify('Export impossible. Vérifiez l’espace disponible et réessayez.'));
  }
  return <>
    <div className="page-heading"><h1>Historique</h1><p>Les sessions enregistrées sur cet appareil.</p></div>
    {sessions.length > 0 && <dl className="summary-strip">
      <div><dt>Sessions caméra</dt><dd>{cameraSessions.length}</dd></div>
      <div><dt>Durée totale</dt><dd>{duration(cameraSessions.reduce((sum, session) => sum + session.durationMs, 0))}<small> min:s</small></dd></div>
      <div><dt>Alertes</dt><dd>{cameraSessions.reduce((sum, session) => sum + session.alerts, 0)}</dd></div>
    </dl>}
    <section className="history-panel">
      <div className="panel-heading"><h2>Sessions <span className="count">{sessions.length}</span></h2>
        <div className="button-group">
          <button className="button small secondary" disabled={!sessions.length} onClick={() => exportData('csv')}><ArrowDownToLine size={15} />CSV</button>
          <button className="button small secondary" disabled={!sessions.length} onClick={() => exportData('json')}>JSON</button>
          <button className="icon-button" aria-label="Effacer l’historique" disabled={!sessions.length} onClick={onClear}><Trash2 size={17} /></button>
        </div>
      </div>
      {!sessions.length ? <div className="empty-state"><History size={28} strokeWidth={1.5} /><h2>Aucune session enregistrée</h2><p>Vos sessions apparaîtront ici après leur arrêt.</p></div>
        : <div className="session-list">{sessions.map(session => <article className="session-item" key={session.id}>
          <button className="session-row" onClick={() => setSelected(selected === session.id ? null : session.id)} aria-expanded={selected === session.id}>
            <span className="session-title"><strong>{new Date(session.startedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</strong><small>{session.mode === 'simulation' ? 'Simulation' : 'Caméra'}{session.interrupted ? ' · Interrompue' : ''}</small></span>
            <span className="session-duration">{duration(session.durationMs)}</span>
            <span className={`alert-count ${session.alerts ? 'has-alerts' : ''}`}>{session.alerts} alerte{session.alerts > 1 ? 's' : ''}</span>
            <ChevronRight size={17} className={selected === session.id ? 'rotated' : ''} />
          </button>
          {selected === session.id && <div className="session-detail">
            <dl className="detail-metrics"><div><dt>Surveillance exploitable</dt><dd>{Math.min(100, Math.round(session.validMs / Math.max(session.durationMs, 1) * 100))} %</dd></div><div><dt>Clignements</dt><dd>{session.blinks}</dd></div><div><dt>Bâillements possibles</dt><dd>{session.yawns}</dd></div></dl>
            <h3>Événements</h3>
            {session.events.length ? <ol className="event-list">{session.events.map((event, index) => <li key={index}><time>{duration(event.at)}</time><div><strong>{STATUS_LABEL[event.status]}</strong><p>{event.message}</p></div></li>)}</ol> : <p className="muted">Aucun événement enregistré.</p>}
          </div>}
        </article>)}</div>}
    </section>
    {sessions.length > 0 && <p className="footnote">Les simulations sont exclues des totaux. Les 100 dernières sessions sont conservées.</p>}
  </>;
}
