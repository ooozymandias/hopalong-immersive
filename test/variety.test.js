import test from 'node:test';
import assert from 'node:assert/strict';
import { Matrix3, Vector3 } from 'three';
import { PalettePlaylist, VisualPalette, visualPalettes } from '../src/classic/visualPalettes.js';
import { nearbySegments } from '../src/classic/lineGeometry.js';
import { generateOrbit } from '../src/classic/generateOrbit.js';
import { generateComposition, centerScore } from '../src/classic/composition.js';
import { createClassic } from '../src/classic/createClassic.js';
import { DesktopStereo, eyeOrder, DUBOIS_LEFT, DUBOIS_RIGHT } from '../src/rendering/DesktopStereo.js';

test('playlist visits all seven palettes without adjacent repeats and waits sixty seconds', () => {
  const playlist = new PalettePlaylist(() => 0.4);
  const sequence = Array.from({ length: 28 }, () => playlist.next());
  for (let start = 0; start < 28; start += 7) assert.equal(new Set(sequence.slice(start, start + 7)).size, 7);
  for (let i = 1; i < sequence.length; i++) assert.notEqual(sequence[i], sequence[i - 1]);
  assert.equal(Object.keys(visualPalettes).length, 7);
  const palette = new VisualPalette();
  const before = palette.current.slice();
  palette.set('Shiny Silver');
  assert.deepEqual(palette.current, before);
  palette.update(1.5);
  assert.notDeepEqual(palette.current, before);
  assert.notDeepEqual(palette.current, palette.target);
  palette.update(1.5);
  assert.deepEqual(palette.current, palette.target);
  palette.set('Random Playlist');
  const first = palette.name;
  palette.update(59.9);
  assert.equal(palette.name, first);
  palette.update(0.1);
  assert.notEqual(palette.name, first);
  palette.dispose();
});

test('lines stay local, have varied lengths and never use invalid or duplicate indices', () => {
  const points = generateOrbit(42, 2000).arrays[1];
  const indices = nearbySegments(points);
  const bins = new Set(), edges = new Set();
  assert.ok(indices.length > 100);
  for (let k = 0; k < indices.length; k += 2) {
    const i = indices[k], j = indices[k + 1];
    assert.ok(i < j && j < points.length / 3);
    const distance = Math.hypot(points[i * 3] - points[j * 3], points[i * 3 + 1] - points[j * 3 + 1]);
    assert.ok(distance >= 0.014 && distance <= 2.501);
    bins.add(distance < 0.3 ? 'short' : distance < 1 ? 'medium' : 'long');
    const edge = `${i}:${j}`;
    assert.ok(!edges.has(edge)); edges.add(edge);
  }
  assert.equal(bins.size, 3);
});

test('central composition selects naturally denser parameters without translations', () => {
  let tunnel = 0, dense = 0;
  for (let seed = 40; seed < 46; seed++) {
    tunnel += centerScore(generateComposition(seed, 1200, 'Tunnel'));
    const orbit = generateComposition(seed, 1200, 'Dense Center');
    dense += centerScore(orbit);
    assert.deepEqual(orbit.arrays, generateOrbit(orbit.seed, 1200).arrays);
  }
  assert.ok(dense > tunnel * 1.5);
});

test('line modes share position buffers, reduce Mixed density and retain index allocations on recycling', () => {
  const classic = createClassic({ profile: 'Light', worker: false });
  const layer = classic.points.children[0], lines = layer.children[0];
  assert.equal(layer.geometry.attributes.position, lines.geometry.attributes.position);
  assert.equal(lines.visible, false);
  classic.setLineDensity(1); classic.setRenderMode('Lines');
  assert.equal(layer.material.visible, false);
  const full = lines.geometry.drawRange.count;
  classic.setRenderMode('Mixed');
  assert.equal(layer.material.visible, true);
  assert.ok(lines.geometry.drawRange.count < full * 0.36);
  const index = lines.geometry.index.array;
  for (let i = 0; i < 600; i++) classic.update(1 / 60, 24, 0);
  assert.equal(lines.geometry.index.array, index);
  classic.setLineDensity(0);
  assert.equal(lines.visible, false);
  classic.dispose();
});

test('desktop eye ordering and Dubois cross-channel coefficients are explicit', () => {
  assert.deepEqual(eyeOrder('Parallel Stereo'), ['left', 'right']);
  assert.deepEqual(eyeOrder('Cross-eye Stereo'), ['right', 'left']);
  const greenLeft = new Vector3(0, 1, 0).applyMatrix3(new Matrix3().fromArray(DUBOIS_LEFT));
  assert.ok(Math.abs(greenLeft.x - 0.500484) < 1e-6);
  const blueRight = new Vector3(0, 0, 1).applyMatrix3(new Matrix3().fromArray(DUBOIS_RIGHT));
  assert.ok(blueRight.z > 1.22 && blueRight.x < 0);
});

test('native XR bypasses all desktop modes before stereo allocation or viewport mutation', () => {
  const scene = {}, camera = {};
  let calls = 0;
  const renderer = { xr: { isPresenting: true }, render: (s, c) => {
    assert.equal(s, scene); assert.equal(c, camera); calls++;
  } };
  const stereo = new DesktopStereo(renderer);
  for (const mode of ['Mono', 'Parallel Stereo', 'Cross-eye Stereo', 'Dubois Anaglyph']) {
    stereo.mode = mode; stereo.render(scene, camera, 1 / 90);
  }
  assert.equal(calls, 4);
  assert.equal(stereo.targets, null);
});
