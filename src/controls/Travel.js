export const speeds = Object.freeze({ Pause: 0, Slow: 0.18, Normal: 0.65, Fast: 1.4, 'Audio-reactive': 0.3 });

export class Travel {
  constructor(mode = 'Normal') { this.mode = mode; this.speed = 0; }
  update(delta, energy = 0) {
    const target = this.mode === 'Audio-reactive'
      ? 0.3 + Math.min(1, Math.max(0, energy) * 3) * 0.8 : speeds[this.mode] ?? 0;
    // Pause is immediate; acceleration and changes of speed are gradual.
    this.speed = this.mode === 'Pause' ? 0 : this.speed + (target - this.speed) * (1 - Math.exp(-delta / 1.5));
    return this.speed;
  }
}
