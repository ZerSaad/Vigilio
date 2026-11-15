import { useCallback, useEffect, useRef, useState } from 'react';
import { VigilanceEngine } from '../core/engine';
import { AlertService } from '../core/alerts';
import { saveDraft, saveSession, clearDraft } from '../core/storage';
import { EMPTY, type Mode, type Observation, type Scenario, type Session, type Settings, type Snapshot } from '../core/types';
import type { Point } from '../core/geometry';
import { vibrationCapability } from '../core/haptics';

export function useMonitor(settings: Settings, onSaved: (s: Session[]) => void, notify: (s: string) => void) {
  const videoRef = useRef<HTMLVideoElement>(null), canvasRef = useRef<HTMLCanvasElement>(null);
  const [snapshot,setSnapshot]=useState<Snapshot>({...EMPTY});
  const [active,setActive]=useState(false), [loading,setLoading]=useState('');
  const [elapsed,setElapsed]=useState(0), [latency,setLatency]=useState(0), [fps,setFps]=useState(0);
  const [alertCount,setAlertCount]=useState(0);
  const [error,setError]=useState(''), [mode,setMode]=useState<Mode>('camera');
  const [scenario,setScenarioState]=useState<Scenario>('normal');
  const engine=useRef<VigilanceEngine|null>(null), worker=useRef<Worker|null>(null);
  const stream=useRef<MediaStream|null>(null), frame=useRef(0), sim=useRef<ReturnType<typeof setInterval>|null>(null);
  const ticker=useRef<ReturnType<typeof setInterval>|null>(null), watchdog=useRef<ReturnType<typeof setInterval>|null>(null);
  const alert=useRef<AlertService|null>(null), session=useRef<Session|null>(null);
  const generation=useRef(0), running=useRef(false), currentScenario=useRef<Scenario>('normal');
  const scenarioStart=useRef(0), lastResult=useRef(0), clock=useRef(0), lastStore=useRef(0);
  const settingsRef=useRef(settings), saveRef=useRef(onSaved), notifyRef=useRef(notify);
  const wake=useRef<WakeLockSentinel|null>(null);
  settingsRef.current=settings; saveRef.current=onSaved; notifyRef.current=notify;
  useEffect(()=>{engine.current?.updateSettings(settings);alert.current?.configure(settings);},[settings]);

  const cleanup=useCallback(()=>{
    running.current=false; generation.current++;
    cancelAnimationFrame(frame.current);
    if(sim.current)clearInterval(sim.current); sim.current=null;
    if(ticker.current)clearInterval(ticker.current); ticker.current=null;
    if(watchdog.current)clearInterval(watchdog.current); watchdog.current=null;
    worker.current?.terminate(); worker.current=null;
    stream.current?.getTracks().forEach(t=>t.stop()); stream.current=null;
    if(videoRef.current)videoRef.current.srcObject=null;
    if(canvasRef.current)canvasRef.current.getContext('2d')?.clearRect(0,0,canvasRef.current.width,canvasRef.current.height);
    alert.current?.stop();
    void wake.current?.release().catch(()=>{}); wake.current=null;
  },[]);

  const stop=useCallback((interrupted=false)=>{
    const s=session.current, e=engine.current?.snapshot;
    let saved=false;
    if(s) {
      const duration=Math.max(0,performance.now()-clock.current);
      const finished={...s,endedAt:Date.now(),durationMs:duration,validMs:e?.validMs??0,blinks:e?.blinks??0,yawns:e?.yawns??0,interrupted};
      try {saveRef.current(saveSession(finished));clearDraft();saved=true;} catch {notifyRef.current('Historique non enregistré : stockage local indisponible.');}
    }
    session.current=null; cleanup(); setActive(false); setLoading('');
    setSnapshot({...EMPTY});
    if(s&&saved)notifyRef.current(interrupted?'Session interrompue et enregistrée.':'Session terminée et enregistrée.');
  },[cleanup]);
  const stopRef=useRef(stop);stopRef.current=stop;

  const consume=useCallback((observation: Observation, time: number)=>{
    if(!running.current||!engine.current)return;
    const previous=engine.current.snapshot;
    const next=engine.current.update(observation,time);
    setSnapshot(next); alert.current?.setStatus(next.status);
    const s=session.current;
    if(s && (previous.status!==next.status || previous.monitoringMode!==next.monitoringMode || previous.mouthCovered!==next.mouthCovered)) {
      s.events.push({at:Math.max(0,time-clock.current),status:next.status,message:[next.visibilityMessage,next.mouthWarning,next.reason].filter(Boolean).join(' ')});
      // Bound long sessions without ever storing video frames.
      if(s.events.length>2000)s.events.shift();
      if(next.status==='alert' && previous.status!=='alert'){s.alerts++;setAlertCount(s.alerts);}
      if(next.status==='warning' && previous.status!=='warning')s.warnings++;
    }
  },[]);

  const draw=useCallback((points: Point[],preview:ImageBitmap|null=null,eyesVisible=true,mouthVisible=true)=>{
    const canvas=canvasRef.current; if(!canvas){preview?.close();return;}
    const ctx=canvas.getContext('2d'); if(!ctx){preview?.close();return;}
    const width=videoRef.current?.videoWidth||640,height=videoRef.current?.videoHeight||480;
    canvas.width=width;canvas.height=height;ctx.clearRect(0,0,width,height);
    if(preview){ctx.drawImage(preview,0,0,width,height);preview.close();}
    ctx.strokeStyle='#dbef9e';ctx.lineWidth=2;ctx.fillStyle='#dbef9e';
    for(const indices of (eyesVisible?[[33,160,158,133,153,144],[362,385,387,263,373,380],[61,13,291,14]]:[[61,13,291,14]])) {
      if(!mouthVisible && indices[0]===61)continue;
      if(!points[indices[0]])continue;
      ctx.beginPath();indices.forEach((i,n)=>{const p=points[i];if(n===0)ctx.moveTo(p.x*width,p.y*height);else ctx.lineTo(p.x*width,p.y*height);});ctx.closePath();ctx.stroke();
      for(const i of indices){const p=points[i];ctx.beginPath();ctx.arc(p.x*width,p.y*height,2,0,Math.PI*2);ctx.fill();}
    }
  },[]);

  async function start(selectedMode: Mode) {
    if(running.current || loading)return;
    setError(''); setLoading(selectedMode==='camera'?'Chargement du modèle local…':'Préparation de la simulation…');
    cleanup(); const token=generation.current; setMode(selectedMode);setElapsed(0);setFps(0);setLatency(0);setAlertCount(0);
    setScenarioState('normal');currentScenario.current='normal';
    try {
      alert.current??=new AlertService(settingsRef.current);await alert.current.unlock();
      if(token!==generation.current)return;
      if(selectedMode==='camera') {
        if(!navigator.mediaDevices?.getUserMedia)throw new Error('Caméra inaccessible. Utilisez localhost sur PC ou une connexion HTTPS sur mobile.');
        const w=new Worker(new URL('vision-worker.js',new URL(import.meta.env.BASE_URL,location.href)));worker.current=w;
        await new Promise<void>((resolve,reject)=>{
          const timeout=setTimeout(()=>reject(new Error('Chargement du modèle trop long. Relancez la session.')),45000);
          w.onmessage=({data})=>{if(data.type==='ready'){clearTimeout(timeout);resolve();}else if(data.type==='error'){clearTimeout(timeout);reject(new Error('Modèle indisponible : '+data.message));}};
          w.onerror=()=>{clearTimeout(timeout);reject(new Error('Impossible de démarrer le moteur de vision.'));};
          w.postMessage({type:'init',base:new URL(import.meta.env.BASE_URL,location.href).href});
        });
        if(token!==generation.current)return;
        setLoading('Autorisez l’accès à votre caméra…');
        const cameraId=settingsRef.current.cameraId;
        const media=await navigator.mediaDevices.getUserMedia({audio:false,video:{...(cameraId?{deviceId:{exact:cameraId}}:{facingMode:'user'}),width:{ideal:640},height:{ideal:480},frameRate:{ideal:20,max:30}}});
        if(token!==generation.current){media.getTracks().forEach(t=>t.stop());return;}
        stream.current=media;
        const video=videoRef.current;if(!video)throw new Error('Aperçu caméra indisponible.');
        video.srcObject=media;await video.play();
        if(token!==generation.current)return;
        media.getVideoTracks()[0].addEventListener('ended',()=>{if(running.current){setError('La caméra a été déconnectée. Rebranchez-la puis relancez une session.');stopRef.current(true);}});
      }
      if(token!==generation.current)return;
      engine.current=new VigilanceEngine(settingsRef.current);clock.current=performance.now();lastResult.current=clock.current;lastStore.current=0;
      session.current={id:crypto.randomUUID(),startedAt:Date.now(),endedAt:Date.now(),durationMs:0,mode:selectedMode,alerts:0,warnings:0,validMs:0,blinks:0,yawns:0,events:[]};
      running.current=true;setActive(true);setLoading('');setSnapshot(engine.current.snapshot);
      try {wake.current=await navigator.wakeLock?.request('screen')??null;}catch{/* Unsupported or power saving: monitoring stays foreground only. */}
      if(!running.current||token!==generation.current){void wake.current?.release().catch(()=>{});return;}
      ticker.current=setInterval(()=>{
        const s=session.current;if(!s)return;
        const now=performance.now(),e=engine.current!.snapshot;setElapsed(now-clock.current);
        if(now-lastStore.current>2000){lastStore.current=now;try{saveDraft({...s,endedAt:Date.now(),durationMs:now-clock.current,validMs:e.validMs,blinks:e.blinks,yawns:e.yawns});}catch{/* Non-blocking persistence failure is reported on session save. */}}
      },250);
      if(selectedMode==='simulation') {
        scenarioStart.current=performance.now();
        sim.current=setInterval(()=>{
          const now=performance.now(),s=currentScenario.current;
          const blink=s==='blink' && (now-scenarioStart.current)%3000<200;
          const repeatedYawn=(s==='yawns'||s==='covered-yawns') && (now-scenarioStart.current)%3000<2000;
          const noFace=s==='lost'||s==='dark',limited=s==='low-light'||s==='covered-yawns';
          const mouthCovered=s==='hand-mouth'||s==='hand-closed';
          consume({valid:!noFace&&!limited,faceValid:!noFace,mouthValid:!noFace&&!mouthCovered,mouthCovered,ear:s==='closed'||s==='hand-closed'||blink?0.08:0.29,mouth:mouthCovered||s==='yawn'||repeatedYawn?0.72:0.1,headPitch:noFace?null:s==='head-down'?32:0,lighting:s==='dark'?'dark':s==='low-light'?'low':'normal',luminance:s==='dark'?4:s==='low-light'?35:120,enhanced:s==='low-light',eyesOccluded:s==='covered-yawns',reason:'Visage absent · simulation'},now);
          setFps(10);setLatency(0);
        },100);
      } else {
        let busy=false,lastVideo=-1,lastSent=0,count=0,since=performance.now();
        const w=worker.current!;
        w.onmessage=({data})=>{
          busy=false;
          if(token!==generation.current||!running.current){data.preview?.close();return;}
          if(data.type==='result'){
            lastResult.current=performance.now();setLatency(Math.round(data.latency));consume(data.observation,data.time);draw(data.observation.faceValid||data.observation.valid?data.points:[],data.preview,data.observation.valid&&!settingsRef.current.sunglasses,data.observation.mouthValid&&!data.observation.mouthCovered);
            count++;if(performance.now()-since>1000){setFps(Math.round(count*1000/(performance.now()-since)));count=0;since=performance.now();}
          } else if(data.type==='error'){setError('Analyse interrompue : '+data.message);stopRef.current(true);}
        };
        w.onerror=()=>{if(running.current){setError('Le moteur de vision a été interrompu. Relancez la session.');stopRef.current(true);}};
        const loop=async()=>{
          if(!running.current||token!==generation.current)return;
          const v=videoRef.current!,now=performance.now();
          if(!busy&&v.readyState>=2&&v.currentTime!==lastVideo&&now-lastSent>=80){
            busy=true;lastVideo=v.currentTime;lastSent=now;
            try {const bitmap=await createImageBitmap(v);if(!running.current||token!==generation.current){bitmap.close();return;}w.postMessage({type:'frame',bitmap,time:now},[bitmap]);}
            catch {busy=false;consume({valid:false,ear:0,mouth:0,reason:'Image caméra momentanément indisponible'},now);}
          }
          frame.current=requestAnimationFrame(()=>void loop());
        };
        void loop();
        watchdog.current=setInterval(()=>{const delay=performance.now()-lastResult.current;if(delay>2500){consume({valid:false,ear:0,mouth:0,reason:'Flux vidéo interrompu'},performance.now());draw([]);}if(delay>10000){setError('Le flux vidéo ne répond plus. Relancez la session.');stopRef.current(true);}},500);
      }
    } catch(err) {
      if(token!==generation.current)return;
      cleanup();setLoading('');setActive(false);
      const e=err as Error;
      const messages: Record<string,string>={NotAllowedError:'Accès caméra refusé. Autorisez la caméra dans les paramètres du navigateur, puis réessayez.',NotFoundError:'Aucune caméra détectée. Branchez une webcam ou utilisez la simulation.',NotReadableError:'Caméra occupée ou inaccessible. Fermez les autres applications vidéo.',OverconstrainedError:'La caméra sélectionnée est indisponible. Choisissez « Caméra automatique » dans les réglages.'};
      setError(messages[e.name]||e.message||'Impossible de démarrer la session.');
    }
  }
  function setScenario(s: Scenario){currentScenario.current=s;scenarioStart.current=performance.now();setScenarioState(s);}
  async function testSound(){if(running.current)return;try{alert.current??=new AlertService(settingsRef.current);await alert.current.unlock();alert.current.test();const vibration=settingsRef.current.vibration?await vibrationCapability():'Vibration désactivée dans les réglages.';notifyRef.current('Test progressif de 8 secondes. Vérifiez le volume média à l’arrêt. '+vibration);}catch(e){setError((e as Error).message);}}
  useEffect(()=>{
    const hidden=()=>{if(document.hidden&&(running.current||worker.current)){stopRef.current(true);notifyRef.current('Application masquée : surveillance arrêtée. Relancez une session au retour.');}};
    const background=()=>{if(running.current||worker.current){stopRef.current(true);notifyRef.current('Application en arrière-plan : surveillance arrêtée.');}};
    const leaving=()=>{if(session.current){const e=engine.current!.snapshot;try{saveDraft({...session.current,endedAt:Date.now(),durationMs:performance.now()-clock.current,validMs:e.validMs,blinks:e.blinks,yawns:e.yawns});}catch{/* Best effort checkpoint. */}}};
    document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',leaving);window.addEventListener('veille:background',background);
    return()=>{leaving();cleanup();document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',leaving);window.removeEventListener('veille:background',background);};
  },[cleanup]);
  return {videoRef,canvasRef,snapshot,active,loading,elapsed,latency,fps,alertCount,error,mode,scenario,start,stop,setScenario,testSound,cancel:()=>{cleanup();setLoading('');}};
}
