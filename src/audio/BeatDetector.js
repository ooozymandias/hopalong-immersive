// Positive spectral flux with an adaptive noise floor, not a BPM estimator.
export class BeatDetector {
  constructor(size, bassEnd = 12) {
    this.bassEnd = bassEnd;
    this.previous = new Uint8Array(size);
    this.reset();
  }
  reset(preservePulse = false) {
    this.previous.fill(0);
    this.ready = false;
    this.average = 0;
    this.cooldown = 0;
    if (!preservePulse) { this.age = 10; this.strength = 0; }
  }
  sample(spectrum, energy, delta) {
    this.cooldown = Math.max(0, this.cooldown - delta);
    let flux = 0;
    let bassFlux = 0;
    for (let i = 1; i < spectrum.length; i++) {
      const rise = Math.max(0, spectrum[i] - this.previous[i]) / 255;
      flux += rise;
      if (i < this.bassEnd) bassFlux += rise;
      this.previous[i] = spectrum[i];
    }
    flux = 0.4 * flux / (spectrum.length - 1) + 0.6 * bassFlux / Math.max(1, this.bassEnd - 1);
    if (!this.ready) { this.ready = true; return false; }
    const threshold = Math.max(0.007, this.average * 1.65 + 0.003);
    const hit = energy > 0.008 && flux > threshold && this.cooldown === 0;
    this.average += (flux - this.average) * (1 - Math.exp(-delta / 0.8));
    if (hit) {
      this.cooldown = 0.28;
      this.age = 0;
      this.strength = Math.min(1, 0.5 + flux / (threshold * 5));
    }
    return hit;
  }
  update(delta) {
    this.age += delta;
    // Smooth rise over 65 ms and complete return within 420 ms; no flash step.
    const attack = Math.min(1, this.age / 0.065);
    const release = Math.max(0, 1 - Math.max(0, this.age - 0.065) / 0.355);
    return this.strength * attack * attack * (3 - 2 * attack) * release * release;
  }
}
