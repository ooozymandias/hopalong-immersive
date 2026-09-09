import { averageBand, bandRanges, frequencyBins, rms, smoothBand } from './bandMath.js';
import { BeatDetector } from './BeatDetector.js';

/** Providers return a reused { bass, mid, treble, energy, beat } object in [0, 1]. */
export class SilentAudioBands {
  constructor() { this.bands = Object.freeze({ bass: 0, mid: 0, treble: 0, energy: 0, beat: 0 }); }
  update() { return this.bands; }
  dispose() {}
}

export class AudioBands {
  constructor(media) {
    this.media = media;
    this.context = null;
    this.volume = 0.35;
    this.bands = { bass: 0, mid: 0, treble: 0, energy: 0 };
    this.targets = { bass: 0, mid: 0, treble: 0, energy: 0 };
    this.keys = Object.keys(this.bands);
    this.bands.beat = 0;
    this.beats = new BeatDetector(1024);
    this.elapsed = 0;
  }

  // Call synchronously from a click, before awaiting any browser permission.
  activate() {
    if (!this.context) {
      this.context = new AudioContext();
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.55;
      this.analyser.minDecibels = -85;
      this.analyser.maxDecibels = -20;
      this.gain = this.context.createGain();
      this.gain.gain.value = 0;
      this.source = this.context.createMediaElementSource(this.media);
      // Analyse before output gain: visual response does not depend on volume.
      this.source.connect(this.analyser);
      this.analyser.connect(this.gain);
      this.gain.connect(this.context.destination);
      this.spectrum = new Uint8Array(this.analyser.frequencyBinCount);
      this.waveform = new Float32Array(this.analyser.fftSize);
      this.ranges = Object.entries(bandRanges).map(([key, [low, high]]) =>
        [key, ...frequencyBins(low, high, this.context.sampleRate, this.analyser.fftSize)]);
      this.beats.bassEnd = this.ranges[0][2];
    }
    return this.context.resume();
  }

  fadeIn() {
    if (!this.context) return;
    const now = this.context.currentTime;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setValueAtTime(0, now);
    this.gain.gain.linearRampToValueAtTime(this.volume, now + 0.8);
  }

  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value));
    if (!this.context) return;
    const now = this.context.currentTime;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setTargetAtTime(this.volume, now, 0.06);
  }

  update(delta) {
    this.elapsed += delta;
    const playing = this.context?.state === 'running' && !this.media.paused && !this.media.ended;
    if (!playing) {
      this.beats.reset(true);
      for (const key of this.keys) this.targets[key] = 0;
    } else if (this.elapsed >= 1 / 30) {
      const sampleDelta = this.elapsed;
      this.elapsed %= 1 / 30;
      this.analyser.getByteFrequencyData(this.spectrum);
      this.analyser.getFloatTimeDomainData(this.waveform);
      for (const [key, start, end] of this.ranges) {
        this.targets[key] = averageBand(this.spectrum, start, end);
      }
      this.targets.energy = rms(this.waveform);
      this.beats.sample(this.spectrum, this.targets.energy, sampleDelta);
    }
    for (const key of this.keys) this.bands[key] = smoothBand(this.bands[key], this.targets[key], delta);
    this.bands.beat = this.beats.update(delta);
    return this.bands;
  }

  dispose() {
    this.source?.disconnect();
    this.analyser?.disconnect();
    this.gain?.disconnect();
    if (this.context) void this.context.close().catch(() => {});
  }
}
