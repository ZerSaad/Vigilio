import { EMPTY, type Observation, type Settings, type Snapshot, type Status } from './types';
type Segment = { start: number; end: number; closed: boolean };
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

/** Each channel is independently gated: hidden eyes never suppress a visible
 * mouth/head, and missing pixels never count as closed eyes or reassuring data. */
export class VigilanceEngine {
  private last: number | null = null;
  private previousFace = false;
  private previousEyes = false;
  private previousClosed = false;
  private segments: Segment[] = [];
  private eyeSamples: number[] = [];
  private pitchSamples: number[] = [];
  private pitchBaseline: number | null = null;
  private recentPitch: number[] = [];
  private calibrationMs = 0;
  private eyeCalibrationMs = 0;
  private calibrated = false;
  private limitedUntil = 0;
  private closedSince: number | null = null;
  private openedSince: number | null = null;
  private eyeAlarm = false;
  private headSince: number | null = null;
  private uprightSince: number | null = null;
  private headAlarm = false;
  private mouthSince: number | null = null;
  private mouthClosedSince: number | null = null;
  private yawnArmed = true;
  private mouthCoveredSince: number | null = null;
  private mouthClearSince: number | null = null;
  private longClosures: number[] = [];
  private yawnsAt: number[] = [];
  private state: Snapshot = { ...EMPTY, status: 'calibrating' };

  constructor(private settings: Settings) {}
  updateSettings(settings: Settings) { this.settings = settings; }
  get snapshot() { return { ...this.state }; }

  update(o: Observation, now: number): Snapshot {
    const gap = this.last === null ? 0 : now - this.last;
    const dt = gap >= 0 && gap <= 500 ? gap : 0;
    const previousTime = this.last ?? now;
    this.last = now;
    if (gap < 0 || gap > 500) { this.resetEyes(true); this.resetMouth(); this.resetHead(true); }
    const face = o.lighting !== 'dark' && (o.faceValid ?? (o.valid || o.headPitch != null));
    this.updateMouthOcclusion(o, face, now);
    const mouth = face && (o.mouthValid ?? o.valid) && !o.mouthCovered && !this.state.mouthCovered;
    this.state.mouthMeasured = mouth;
    if (o.lighting === 'low' || o.eyesOccluded === true) this.limitedUntil = now + 1500;
    const restricted = this.settings.sunglasses || o.lighting === 'low' || o.eyesOccluded === true || !o.valid || now < this.limitedUntil;
    const eyes = face && !restricted;
    if (dt && this.previousFace && face && this.calibrated) this.state.validMs += dt;
    if (dt && this.previousEyes && eyes && this.state.eyesReady) this.segments.push({ start: previousTime, end: now, closed: this.previousClosed });
    this.previousFace = face; this.previousEyes = eyes;
    this.refreshVisibility(o, face, restricted);
    this.yawnsAt = this.yawnsAt.filter(time => time > now - 60000);
    this.longClosures = this.longClosures.filter(time => time > now - 60000);
    this.state.recentYawns = this.yawnsAt.length;
    this.updateWindow(now, eyes);

    if (!face) {
      this.resetEyes(true); this.resetMouth(); this.resetHead(true); this.state.ear = null;
      if(this.eyeAlarm||this.headAlarm)return this.result('alert','Alerte maintenue : le visage est devenu inexploitable. Arrêtez-vous dans un endroit sûr.');
      return this.result('unavailable', this.state.visibilityMessage);
    }
    if (!mouth && !eyes && (o.headPitch == null || !Number.isFinite(o.headPitch))) {
      this.state.monitoringMode = 'unavailable';
      this.state.visibilityMessage = 'Yeux et bouche non exploitables, posture non mesurable. Dégagez le visage et replacez-vous face à la caméra.';
      if(this.eyeAlarm||this.headAlarm)return this.result('alert','Alerte maintenue : les signes de récupération ne sont pas vérifiables.');
      return this.result('unavailable', this.state.visibilityMessage);
    }
    this.collectEyeCalibration(o, eyes, dt);
    if (!this.calibrated) {
      this.calibrationMs += dt;
      if (o.headPitch != null && Number.isFinite(o.headPitch) && Math.abs(o.headPitch) <= 45) {
        this.pitchSamples.push(o.headPitch);
        if (this.pitchSamples.length > 150) this.pitchSamples.shift();
      }
      this.state.calibration = Math.min(1, (restricted ? this.calibrationMs : this.eyeCalibrationMs) / 4000);
      const fallbackReady = restricted && (this.pitchSamples.length >= 15 || mouth);
      if (this.calibrationMs >= 4000 && (this.state.eyesReady || fallbackReady)) {
        if (this.pitchSamples.length >= 15) { this.pitchBaseline = median(this.pitchSamples); this.state.headPoseReady = true; }
        this.calibrated = true;
        this.state.calibration = 1;
        this.refreshVisibility(o, face, restricted);
        return this.result(this.state.monitoringMode === 'limited' ? 'limited' : 'normal', this.state.monitoringMode === 'limited' ? this.state.mouthCovered && !restricted ? 'Calibration terminée. Surveillance des yeux et de la tête.' : 'Posture calibrée. Surveillance des indicateurs visibles.' : 'Calibration terminée · surveillance active');
      }
      this.state.ear = eyes ? o.ear : null;
      return this.result('calibrating', restricted ? 'Gardez la tête droite : calibration de la surveillance limitée.' : 'Gardez la tête droite et les yeux naturellement ouverts.');
    }

    this.refreshVisibility(o, face, restricted);
    const limited = this.state.monitoringMode === 'limited';
    this.updateHead(o.headPitch, now, limited, restricted || !this.state.eyesReady);
    if (eyes && this.state.eyesReady) this.updateEyes(o.ear, now);
    else { this.resetEyes(true); this.state.ear = null; this.state.perclos = null; }
    if (mouth) this.updateMouth(o.mouth, now); else this.resetMouth();
    this.state.recentYawns = this.yawnsAt.length;
    const usable = mouth || this.state.headDropDegrees !== null || (eyes && this.state.eyesReady);
    if (!usable) { this.state.monitoringMode = 'unavailable'; this.state.visibilityMessage = 'Visage détecté, mais aucun indicateur exploitable. Replacez-vous face à la caméra.'; return this.result('unavailable', this.state.visibilityMessage); }
    if (this.headAlarm) return this.result('alert', 'Tête abaissée de façon prolongée. Arrêtez-vous dans un endroit sûr.');
    if (this.eyeAlarm) return this.result('alert', this.state.closedSeconds ? 'Yeux fermés trop longtemps. Arrêtez-vous dans un endroit sûr.' : 'Rouvrez les yeux. Prévoyez un arrêt dans un endroit sûr.');
    const yawnThreshold = restricted || !this.state.eyesReady ? 2 : 3;
    if (this.yawnsAt.length >= yawnThreshold) return this.result('warning', `Bâillements répétés : au moins ${yawnThreshold} en une minute. Prévoyez une pause.`);
    if (eyes && this.state.eyesReady && this.state.perclos !== null && this.state.perclos >= this.settings.perclosThreshold) return this.result('warning', 'Fermetures fréquentes des yeux. Prévoyez une pause.');
    if (eyes && this.state.eyesReady && this.longClosures.length >= 3) return this.result('warning', 'Plusieurs fermetures longues détectées. Prévoyez une pause.');
    if (eyes && this.state.eyesReady && this.yawnsAt.length >= 2 && this.longClosures.length >= 1) return this.result('warning', 'Signes visuels répétés de fatigue. Prévoyez une pause.');
    return this.result(limited ? 'limited' : 'normal', limited ? this.state.mouthCovered ? restricted ? 'Surveillance limitée : priorité à la tête lorsqu’elle est mesurable.' : 'Bouche masquée : priorité aux yeux et à la tête.' : 'Surveillance limitée : priorité à la tête et aux bâillements.' : 'Aucun signe persistant détecté');
  }

  private refreshVisibility(o: Observation, face: boolean, restricted: boolean) {
    const priority=this.state.mouthCovered?'Priorité à la tête lorsqu’elle est mesurable.':'Priorité à la tête et aux bâillements.';
    this.state.lighting = o.lighting ?? 'normal'; this.state.luminance = o.luminance ?? null; this.state.enhanced = o.enhanced === true;
    this.state.monitoringMode = !face ? 'unavailable' : restricted || this.state.mouthCovered || (this.calibrated && !this.state.eyesReady) ? 'limited' : 'full';
    this.state.visibilityMessage = o.lighting === 'dark' ? 'Luminosité trop faible : surveillance indisponible. Ajoutez un éclairage.'
      : !face ? o.reason || 'Aucun visage exploitable : surveillance indisponible.'
      : this.settings.sunglasses ? 'Lunettes de soleil signalées : yeux exclus. '+priority
      : o.lighting === 'low' ? 'Faible luminosité : yeux non fiables. '+priority
      : o.eyesOccluded ? 'Yeux possiblement masqués (lunettes ou obstacle). '+priority
      : !o.valid ? 'Yeux non exploitables. '+priority
      : this.calibrated && !this.state.eyesReady ? 'Calibration des yeux en cours. '+priority
      : restricted ? 'Vérification de la visibilité des yeux. '+priority : '';
  }
  private updateMouthOcclusion(o: Observation, face: boolean, now: number) {
    if (!face) {
      this.mouthCoveredSince = null; this.mouthClearSince = null; this.state.mouthCovered = false;
    } else if (o.mouthCovered) {
      this.mouthClearSince = null; this.mouthCoveredSince ??= now;
      if (now - this.mouthCoveredSince >= 500) this.state.mouthCovered = true;
    } else {
      this.mouthCoveredSince = null; this.mouthClearSince ??= now;
      if (now - this.mouthClearSince >= 700) this.state.mouthCovered = false;
    }
    this.state.mouthWarning = this.state.mouthCovered ? 'Main devant la bouche : baissez votre main pour permettre l’analyse des bâillements. Priorité aux yeux et à la tête lorsqu’ils sont visibles.' : '';
  }
  private collectEyeCalibration(o: Observation, eyes: boolean, dt: number) {
    if (this.state.eyesReady || !eyes || o.ear < 0.16 || o.ear > 0.5) return;
    this.eyeSamples.push(o.ear); if (this.eyeSamples.length > 150) this.eyeSamples.shift(); this.eyeCalibrationMs += dt;
    if (this.eyeCalibrationMs >= 4000 && this.eyeSamples.length >= 20) {
      const sorted = [...this.eyeSamples].sort((a, b) => a - b);
      this.state.threshold = Math.max(0.10, Math.min(0.30, sorted[Math.floor(sorted.length * 0.7)] * 0.68));
      this.state.eyesReady = true;
    }
  }
  private updateWindow(now: number, eyes: boolean) {
    this.segments = this.segments.filter(segment => segment.end > now - 30000);
    let valid = 0, closed = 0;
    for (const segment of this.segments) { const length = segment.end - Math.max(segment.start, now - 30000); valid += length; if (segment.closed) closed += length; }
    this.state.coverage = valid / 30000;
    this.state.perclos = eyes && this.state.eyesReady && valid >= 19500 ? closed / valid : null;
  }
  private updateEyes(ear: number, now: number) {
    this.state.ear = ear;
    const closed = ear < this.state.threshold * (this.previousClosed ? 1.08 : 1); this.previousClosed = closed;
    if (closed) {
      this.openedSince = null; this.closedSince ??= now; this.state.closedSeconds = (now - this.closedSince) / 1000;
      if (this.state.closedSeconds >= this.settings.closureSeconds) this.eyeAlarm = true;
    } else {
      if (this.closedSince !== null) { const duration = now - this.closedSince; if (duration >= 80 && duration < 650) this.state.blinks++; if (duration >= 650) this.longClosures.push(now); }
      this.closedSince = null; this.state.closedSeconds = 0; this.openedSince ??= now;
      if (now - this.openedSince >= 800) this.eyeAlarm = false;
    }
  }
  private updateMouth(mouth: number, now: number) {
    if (mouth > 0.55) {
      this.mouthClosedSince = null; this.mouthSince ??= now;
      if (now - this.mouthSince >= 1500 && this.yawnArmed) { this.state.yawns++; this.yawnsAt.push(now); this.yawnArmed = false; }
    } else {
      this.mouthSince = null;
      if (mouth < 0.35) { this.mouthClosedSince ??= now; if (now - this.mouthClosedSince >= 500) this.yawnArmed = true; }
      else this.mouthClosedSince = null;
    }
  }
  private updateHead(pitch: number | null | undefined, now: number, limited: boolean, eyesUnavailable: boolean) {
    if (this.pitchBaseline === null || pitch == null || !Number.isFinite(pitch)) { this.resetHead(true); return; }
    this.recentPitch.push(pitch); if (this.recentPitch.length > 3) this.recentPitch.shift();
    const drop = median(this.recentPitch) - this.pitchBaseline; this.state.headDropDegrees = drop;
    const threshold = eyesUnavailable ? 17 : 20;
    if (drop >= (this.headSince === null ? threshold : threshold - 7)) {
      this.headSince ??= now; this.uprightSince = null; this.state.headDownSeconds = (now - this.headSince) / 1000;
      if (this.state.headDownSeconds >= (limited ? 1.2 : 1.5)) this.headAlarm = true;
    } else {
      this.headSince = null; this.state.headDownSeconds = 0; this.uprightSince ??= now;
      if (now - this.uprightSince >= 800) this.headAlarm = false;
    }
  }
  private resetEyes(preserveAlarm=false) { this.closedSince = null; this.openedSince = null; this.previousClosed = false; if(!preserveAlarm)this.eyeAlarm = false; this.state.closedSeconds = 0; }
  private resetMouth() { this.mouthSince = null; this.mouthClosedSince = null; }
  private resetHead(preserveAlarm=false) { this.headSince = null; this.uprightSince = null; if(!preserveAlarm)this.headAlarm = false; this.recentPitch = []; this.state.headDropDegrees = null; this.state.headDownSeconds = 0; }
  private result(status: Status, reason: string) { this.state.status = status; this.state.reason = reason; return this.snapshot; }
}
