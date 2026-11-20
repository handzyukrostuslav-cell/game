export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.noiseGain = null;
    this.filter = null;
  }

  init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();

    // Генерація м'якого фонового міського гулу (фільтрований рожевий шум)
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.950 * b2 + white * 0.048;
      data[i] = (b0 + b1 + b2) * 0.25;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 260;

    this.noiseGain = this.ctx.createGain();
    this.noiseGain.gain.value = 0.02;

    noise.connect(this.filter);
    this.filter.connect(this.noiseGain);
    this.noiseGain.connect(this.ctx.destination);
    noise.start();
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.noiseGain && this.ctx) {
      this.noiseGain.gain.setTargetAtTime(this.enabled ? 0.025 : 0, this.ctx.currentTime, 0.1);
    }
    return this.enabled;
  }

  updateAmbient(camDistance, population, isRaining) {
    if (!this.ctx || !this.enabled || !this.noiseGain) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    // Чим ближче камера до землі та більше місто, тим виразніший міський фон
    const zoomFactor = Math.max(0.15, Math.min(1, 35 / Math.max(8, camDistance)));
    const popFactor = Math.min(1, 0.25 + population / 800);
    const targetGain = (isRaining ? 0.055 : 0.035) * zoomFactor * popFactor;
    const targetFreq = isRaining ? 900 : 220 + zoomFactor * 240;

    this.noiseGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.25);
    this.filter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.25);
  }

  playTone(freq, duration = 0.12, type = 'sine', vol = 0.08) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playBuild() {
    this.playTone(190, 0.14, 'triangle', 0.1);
    setTimeout(() => this.playTone(320, 0.12, 'sine', 0.08), 55);
  }

  playBulldoze() {
    this.playTone(110, 0.2, 'sawtooth', 0.09);
  }

  playAlert() {
    this.playTone(540, 0.18, 'square', 0.06);
    setTimeout(() => this.playTone(440, 0.22, 'square', 0.06), 190);
  }
}