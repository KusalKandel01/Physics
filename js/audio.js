// ============================================================================
// audio.js — siren tone synthesis + live analyser feed for the oscilloscope
// ============================================================================

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.analyser = null;
    this.enabled = true;
    this.volume = 0.55;
    this.freqData = null;
  }

  // AudioContext must be created/resumed inside a user gesture in most browsers
  ensureContext() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.freqData = new Uint8Array(this.analyser.fftSize);
    this.master.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  resume() {
    this.ensureContext();
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  setVolume(v01) {
    this.volume = v01;
    if (this.master) this.master.gain.value = v01;
  }

  setEnabled(on) { this.enabled = on; }

  // Emits a short siren pulse frequency-swept toward `frequency`, attenuated by distance.
  playTone(frequency, distance) {
    if (!this.enabled) return;
    this.ensureContext();
    if (this.ctx.state === "suspended") return; // no gesture yet

    const t0 = this.ctx.currentTime;
    const duration = 0.55;
    const loudness = clamp(1 / (distance / 140 + 1), 0.04, 1);

    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(frequency, t0);
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(loudness, t0 + 0.04);
    env.gain.linearRampToValueAtTime(loudness * 0.85, t0 + duration * 0.6);
    env.gain.linearRampToValueAtTime(0, t0 + duration);

    osc.connect(env);
    env.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  getWaveform() {
    if (!this.analyser) return null;
    this.analyser.getByteTimeDomainData(this.freqData);
    return this.freqData;
  }
}

const audioEngine = new AudioEngine();
