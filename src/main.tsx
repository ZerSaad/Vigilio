import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import App from './App';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/manrope';
import './styles.css';
createRoot(document.getElementById('root')!).render(<App/>);
if('serviceWorker' in navigator && import.meta.env.PROD && !Capacitor.isNativePlatform()){
  window.addEventListener('load',()=>{void navigator.serviceWorker.register('/sw.js').catch(()=>{/* The application remains usable if offline caching is unsupported. */});});
}
