import test from 'node:test';
import assert from 'node:assert/strict';
import { generateOrbit } from '../src/classic/generateOrbit.js';
import { createClassic } from '../src/classic/createClassic.js';
import { ClassicMotion, recycleDepth } from '../src/classic/ClassicMotion.js';

test('classic generates seven finite planar subsets, repeatable and varied across seeds', () => {
  const first = generateOrbit(42, 500);
  assert.deepEqual(first, generateOrbit(42, 500));
  assert.notDeepEqual(first.parameters, generateOrbit(43, 500).parameters);
  for (let seed = 1; seed <= 30; seed++) {
    const orbit = generateOrbit(seed, 500);
    assert.equal(orbit.arrays.length, 7);
    for (const positions of orbit.arrays) {
      for (let i = 0; i < positions.length; i += 3) {
        assert.ok(Number.isFinite(positions[i]) && Math.abs(positions[i]) <= 30.001);
        assert.ok(Number.isFinite(positions[i + 1]) && Math.abs(positions[i + 1]) <= 30.001);
        assert.equal(positions[i + 2], 0);
      }
    }
  }
});

test('classic recycles all layers indefinitely at maximum speed with new motifs and stable allocations', () => {
  const classic = createClassic({ worker: false });
  assert.equal(classic.particleCount, 245000);
  const layers = [...classic.points.children];
  const buffers = layers.map((layer) => layer.geometry.attributes.position.array);
  for (let frame = 0; frame < 60 * 15; frame++) classic.update(1 / 60, 24, 0.3);
  for (let i = 0; i < layers.length; i++) {
    assert.equal(layers[i].geometry.attributes.position.array, buffers[i]);
    assert.notEqual(layers[i].userData.seed, 42);
    assert.ok(layers[i].position.z <= 0.5 && layers[i].position.z > -83.5);
  }
  const z = layers[0].position.z;
  const angle = layers[0].rotation.z;
  classic.update(1, 0, 0);
  assert.equal(layers[0].position.z, z);
  assert.equal(layers[0].rotation.z, angle);
  classic.setProfile('Quest 3');
  assert.equal(classic.particleCount, 98000);
  classic.setProfile('Light');
  assert.equal(classic.particleCount, 49000);
  classic.dispose();
  assert.equal(classic.points.children.length, 0);
});

test('motion supports immediate stop and wide speed range without audio input', () => {
  const motion = new ClassicMotion();
  motion.target = 24;
  for (let i = 0; i < 300; i++) motion.update(1 / 60);
  assert.ok(motion.speed > 23.9);
  motion.target = 0;
  motion.update(1 / 60);
  assert.equal(motion.speed, 0);
  motion.rotationTarget = -Math.PI / 3;
  for (let i = 0; i < 300; i++) motion.update(1 / 60);
  assert.ok(motion.rotation < -1);
  assert.ok(recycleDepth(0, 1000, 0.5, 84) <= 0.5);
});
