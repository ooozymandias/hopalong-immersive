// Spatial hashing bounds the search; short temporal links are preferred.
// One link per vertex at most. Longer links remain within 2.5 world units.
export function nearbySegments(positions) {
  const count = positions.length / 3;
  const cells = new Map();
  const cellSize = 1.25;
  for (let i = 0; i < count; i++) {
    const key = `${Math.floor(positions[i * 3] / cellSize)},${Math.floor(positions[i * 3 + 1] / cellSize)}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(i);
  }
  const indices = [];
  const distance = (i, j) => Math.hypot(positions[i * 3] - positions[j * 3], positions[i * 3 + 1] - positions[j * 3 + 1]);
  for (let i = 0; i < count; i++) {
    const limit = i % 10 === 0 ? 2.5 : i % 3 === 0 ? 1.2 : 0.45;
    let match = -1;
    if (i + 1 < count && distance(i, i + 1) >= 0.015 && distance(i, i + 1) <= limit) match = i + 1;
    if (match < 0) {
      const x = Math.floor(positions[i * 3] / cellSize), y = Math.floor(positions[i * 3 + 1] / cellSize);
      const range = Math.ceil(limit / cellSize);
      let best = Infinity;
      for (let dx = -range; dx <= range; dx++) for (let dy = -range; dy <= range; dy++) {
        const bucket = cells.get(`${x + dx},${y + dy}`);
        if (!bucket) continue;
        // At most 16 representatives per cell, avoiding quadratic dense clusters.
        const stride = Math.max(1, Math.ceil(bucket.length / 16));
        for (let k = 0; k < bucket.length; k += stride) {
          const j = bucket[k];
          if (j <= i) continue;
          const d = distance(i, j);
          if (d < 0.015 || d > limit) continue;
          // Mostly nearest neighbours trace the curves; a sparse 5% of links
          // bridge slightly longer local gaps, still bounded by the same radius.
          const score = i % 20 === 0 ? Math.abs(d - limit * 0.6) : d;
          if (score < best) { best = score; match = j; }
        }
      }
    }
    if (match >= 0) indices.push(i, match);
  }
  // Shuffle to keep reduced density spatially distributed, not an orbit prefix.
  let seed = 123;
  for (let i = indices.length / 2 - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    for (let c = 0; c < 2; c++) [indices[i * 2 + c], indices[j * 2 + c]] = [indices[j * 2 + c], indices[i * 2 + c]];
  }
  return new Uint16Array(indices);
}
