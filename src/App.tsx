import { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, History, Monitor, Settings2, X } from './components/Icons';
import { MonitorPage } from './components/MonitorPage';
import { HistoryPage } from './components/HistoryPage';
import { SettingsPage } from './components/SettingsPage';
import { useMonitor } from './hooks/useMonitor';
import { clearSessions, loadSessions, loadSettings, recoverDraft, saveSettings } from './core/storage';
import type { Settings } from './core/types';
import { VisualAlert } from './components/VisualAlert';

type Page = 'monitor' | 'history' | 'settings';
const navigation = [
  { id: 'monitor' as const, label: 'Surveillance', icon: Monitor },
  { id: 'history' as const, label: 'Historique', icon: History },
  { id: 'settings' as const, label: 'Réglages', icon: Settings2 },
];

export default function App() {
  const [page, setPage] = useState<Page>('monitor');
  const [settings, setSettings] = useState(loadSettings);
  const [sessions, setSessions] = useState(loadSessions);
  const [toast, setToast] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const main = useRef<HTMLElement>(null);
  const notify = useCallback((message: string) => setToast(message), []);
  const monitor = useMonitor(settings, setSessions, notify);

  useEffect(() => {
    if (recoverDraft()) {
      setSessions(loadSessions());
      notify('Une session interrompue a été récupérée dans l’historique.');
    }
  }, [notify]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(''), 6000);
    return () => clearTimeout(timeout);
  }, [toast]);

  function changeSettings(value: Settings) {
    setSettings(value);
    try { saveSettings(value); }
    catch { notify('Réglages appliqués, mais leur sauvegarde est indisponible.'); }
  }
  function navigate(target: Page) {
    setPage(target);
    window.scrollTo({ top: 0, behavior: 'instant' });
    requestAnimationFrame(() => main.current?.focus({ preventScroll: true }));
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">Aller au contenu</a>
      <header className="app-header">
        <div className="header-inner">
          <a className="brand" href="#main" aria-label="Vigilio, accueil" onClick={event => { event.preventDefault(); navigate('monitor'); }}>
            <span className="brand-icon"><Eye size={23} strokeWidth={1.7} /></span>
            <span>vigilio<span className="brand-period">.</span></span>
          </a>
          <nav className="desktop-nav" aria-label="Navigation principale">
            {navigation.map(({ id, label }) => (
              <button key={id} aria-current={page === id ? 'page' : undefined} onClick={() => navigate(id)}>
                {label}{id === 'monitor' && monitor.active && <span className="nav-live" aria-label="Session active" />}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main id="main" ref={main} tabIndex={-1} className={page === 'settings' ? 'page-settings' : undefined}>
        <div hidden={page !== 'monitor'}><MonitorPage monitor={monitor} sessions={sessions} settings={settings} onSunglasses={enabled=>changeSettings({...settings,sunglasses:enabled})} onHistory={() => navigate('history')} /></div>
        {page === 'history' && <HistoryPage notify={notify} sessions={sessions} onClear={() => dialog.current?.showModal()} />}
        {page === 'settings' && <SettingsPage settings={settings} onChange={changeSettings} onTest={() => void monitor.testSound()} active={monitor.active || !!monitor.loading} />}
      </main>
      <nav className="mobile-nav" aria-label="Navigation mobile">
        {navigation.map(({ id, label, icon: Icon }) => (
          <button key={id} aria-current={page === id ? 'page' : undefined} onClick={() => navigate(id)}><Icon size={21} strokeWidth={1.7} /><span>{label}</span></button>
        ))}
      </nav>
      <VisualAlert active={monitor.active} status={monitor.snapshot.status} enabled={settings.visualAlert}/>
      {toast && <div className="toast" role="status"><span>{toast}</span><button className="icon-button" aria-label="Fermer la notification" onClick={() => setToast('')}><X size={17} /></button></div>}
      <dialog ref={dialog} className="confirm-dialog">
        <h2>Effacer l’historique ?</h2>
        <p>Les sessions enregistrées sur cet appareil seront supprimées. Vous pouvez les exporter avant de continuer.</p>
        <div className="button-group">
          <button className="button secondary" autoFocus onClick={() => dialog.current?.close()}>Annuler</button>
          <button className="button danger" onClick={() => {
            try { clearSessions(); setSessions([]); notify('Historique effacé.'); }
            catch { notify('Impossible d’effacer l’historique.'); }
            dialog.current?.close();
          }}>Effacer les sessions</button>
        </div>
      </dialog>
    </div>
  );
}
