// Reference scale is mapped at 0.02 metres per original unit, assuming 60 Hz.
export const classicSpeeds = Object.freeze({
  Stopped: 0, 'Very Slow': 0.3, Slow: 2.4, Medium: 9.6, Fast: 16.8, 'Very Fast': 24,
});
export class ClassicMotion {
  constructor() { this.target = 9.6; this.speed = 0; this.rotationTarget = 0; this.rotation = 0; }
  update(delta) {
    const blend = 1 - Math.exp(-delta / 0.45);
    this.speed = this.target === 0 ? 0 : this.speed + (this.target - this.speed) * blend;
    this.rotation += (this.rotationTarget - this.rotation) * blend;
  }
}

export function recycleDepth(z, travel, behind, span) {
  const next = z + travel;
  return next > behind ? next - Math.ceil((next - behind) / span) * span : next;
}
