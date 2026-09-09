export const SUBSETS = 7;

/** Classic equation only. Bounds and normalization follow the reference's
 * independently scaled X/Y axes and nearby starting points for seven subsets.
 * Fresh implementation; no remote script or sprite is included. */
export function generateOrbit(seed, count = 5000, radius = 30) {
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const parameters = { a: -30 + random() * 60, b: 0.2 + random() * 1.6, c: 5 + random() * 12 };
  const { a, b, c } = parameters;
  const arrays = [];
  const hues = [];
  let minX = 0, maxX = 0, minY = 0, maxY = 0;
  for (let subset = 0; subset < SUBSETS; subset++) {
    const positions = new Float32Array(count * 3);
    let x = subset * 0.005 * (0.5 - random());
    let y = subset * 0.005 * (0.5 - random());
    for (let i = 0; i < count; i++) {
      const next = y - Math.sign(x) * Math.sqrt(Math.abs(b * x - c));
      y = a - x;
      x = next;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    arrays.push(positions);
    // Distribute hues across the full spectrum, with small random offsets.
    hues.push((subset / SUBSETS + random() * 0.12 + seed * 0.037) % 1);
  }
  for (const positions of arrays) {
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (positions[i * 3] - minX) / (maxX - minX || 1) * radius * 2 - radius;
      positions[i * 3 + 1] = (positions[i * 3 + 1] - minY) / (maxY - minY || 1) * radius * 2 - radius;
      // Z stays exactly zero: all depth belongs to the layer transform.
    }
  }
  return { arrays, hues, parameters, seed };
}
