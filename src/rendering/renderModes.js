// Capabilities are independent of orbit generation. Extend with a batched
// renderer implementing update(layers, delta, speed), setCount(), dispose().
export const renderModes = Object.freeze({
  Points: { points: true, lines: 0 },
  Lines: { points: false, lines: 1 },
  Mixed: { points: true, lines: 0.35 },
  Pulse: { points: true, background: 0.25, lines: 0, lab:true },
  'Soft Orbs': { points:false, lines:0, lab:true },
  Streaks: { points:false, lines:0, lab:true },
  Comets: { points:true, background:0.3, lines:0, lab:true },
  Constellations: { points:true, lines:1, connections:true },
  Ribbons: { points:true, background:0.18, lines:0, lab:true },
  Glyphs: { points:true, background:0.4, lines:0, lab:true },
  'Animated Sprites': { points: true, lines: 0, sprites: true, experimental:true },
});
