import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import type { Status } from '../core/types';
import { setAlertBrightness } from '../core/display';

export const VISUAL_ALERT_DELAY_MS = 4000;
export function useVisualAlert(active: boolean, status: Status, enabled: boolean) {
  const [mobile, setMobile] = useState(() => Capacitor.getPlatform() === 'android' || matchMedia('(max-width: 767px)').matches);
  const [visible, setVisible] = useState(false);
  const dismissed = useRef(false);
  useEffect(() => {
    const query = matchMedia('(max-width: 767px)');
    const changed = () => setMobile(Capacitor.getPlatform() === 'android' || query.matches);
    query.addEventListener('change', changed);
    return () => query.removeEventListener('change', changed);
  }, []);
  useEffect(() => {
    if (!active || status !== 'alert' || !enabled || !mobile) {
      dismissed.current = false; setVisible(false); return;
    }
    const timer = setTimeout(() => { if (!dismissed.current) setVisible(true); }, VISUAL_ALERT_DELAY_MS);
    return () => { clearTimeout(timer); setVisible(false); };
  }, [active, status, enabled, mobile]);
  useEffect(() => {
    if (!visible) return;
    setAlertBrightness(true);
    return () => setAlertBrightness(false);
  }, [visible]);
  return { visible, dismiss: () => { dismissed.current = true; setVisible(false); } };
}
