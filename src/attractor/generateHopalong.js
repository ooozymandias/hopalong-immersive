// Pure, deterministic CPU generation. No work here occurs during rendering.
export function generateHopalong({ particleCount, seed, hopalong, radius, depth }) {
  if (!Number.isInteger(particleCount) || particleCount < 1 || !(radius > 0) || !(depth > 0)) {
    throw new RangeError('Invalid particle count or volume dimensions.');
  }
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  let x = 0.1;
  let y = 0.1;
  let extent = 0;
  const { a, b, c } = hopalong;
  for (let i = -1000; i < particleCount; i++) {
    const nextX = y - Math.sign(x) * Math.sqrt(Math.abs(b * x - c));
    y = a - x;
    x = nextX;
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new RangeError('Divergent attractor.');
    if (i < 0) continue;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    extent = Math.max(extent, Math.abs(x), Math.abs(y));
  }
  // Lift the planar orbit into a continuous twisted volume. Each point has
  // its own depth: no textured planes, slices, or billboard copies of an image.
  for (let i = 0; i < particleCount; i++) {
    const offset = i * 3;
    const z = (random() - 0.5) * depth;
    const angle = z * 0.055;
    const px = positions[offset] * radius / (extent || 1);
    const py = positions[offset + 1] * radius / (extent || 1);
    positions[offset] = px * Math.cos(angle) - py * Math.sin(angle);
    positions[offset + 1] = px * Math.sin(angle) + py * Math.cos(angle) + 1.6;
    positions[offset + 2] = z;
    const mix = random();
    colors[offset] = 0.22 + mix * 0.4;
    colors[offset + 1] = 0.55 + mix * 0.2;
    colors[offset + 2] = 0.95;
  }
  return { positions, colors };
}
