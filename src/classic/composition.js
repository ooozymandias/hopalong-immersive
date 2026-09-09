import { generateOrbit } from './generateOrbit.js';
import { nearbySegments } from './lineGeometry.js';

export function centerScore(orbit) {
  let center = 0, axis = 0, total = 0;
  for (const points of orbit.arrays) for (let i = 0; i < points.length; i += 3) {
    const x = Math.abs(points[i]), y = Math.abs(points[i + 1]);
    if (x * x + y * y < 64) center++;
    if (x < 2.5 || y < 2.5) axis++;
    total++;
  }
  return center / total * 0.8 + axis / total * 0.2;
}

export function generateComposition(seed, count, composition = 'Tunnel') {
  let mode = composition;
  if (mode === 'Random') mode = ['Tunnel', 'Balanced', 'Through Forms', 'Dense Center'][seed % 4];
  let selectedSeed = seed;
  let best = -Infinity;
  if (mode !== 'Tunnel' && !(mode === 'Balanced' && seed % 3 === 0)) {
    // Rank real Hopalong parameters; never translate a cloud to fake a dense center.
    for (let i = 0; i < 10; i++) {
      const candidateSeed = (seed + Math.imul(i, 2654435761)) >>> 0;
      const score = centerScore(generateOrbit(candidateSeed, 600));
      const value = mode === 'Balanced' ? -Math.abs(score - 0.16)
        : mode === 'Through Forms' ? -Math.abs(score - 0.28) : -Math.abs(score - 0.5);
      if (value > best) { best = value; selectedSeed = candidateSeed; }
    }
  }
  const orbit = generateOrbit(selectedSeed, count);
  orbit.composition = mode;
  orbit.lines = orbit.arrays.map(nearbySegments);
  return orbit;
}
