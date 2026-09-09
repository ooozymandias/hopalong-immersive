export const MAX_SPEED = 24;
export const INITIAL_SPEED = MAX_SPEED * 0.25;
export function stickSpeed(speed, axis, delta) {
  const value = Number.isFinite(axis) ? Math.max(-1, Math.min(1, axis)) : 0;
  const deadZone = 0.2;
  if (Math.abs(value) <= deadZone) return speed;
  const rate = -Math.sign(value) * (Math.abs(value) - deadZone) / (1 - deadZone) * 8;
  return Math.max(0, Math.min(MAX_SPEED, speed + rate * Math.min(delta, 0.05)));
}
export class XRInput {
  constructor() { this.buttons = new Map(); }
  reset() { this.buttons.clear(); }
  update(sources, speed, delta, toggle) {
    const live = new Set();
    for (const source of sources) {
      live.add(source);
      const pad = source.gamepad;
      if (pad?.mapping !== 'xr-standard') continue;
      if (source.handedness === 'left') {
        const pressed = !!pad.buttons[4]?.pressed;
        if (pressed && !this.buttons.get(source)) toggle();
        this.buttons.set(source, pressed);
      }
      if (source.handedness === 'right' && pad.axes.length >= 4) speed = stickSpeed(speed, pad.axes[3], delta);
    }
    for (const source of this.buttons.keys()) if (!live.has(source)) this.buttons.delete(source);
    return speed;
  }
}
