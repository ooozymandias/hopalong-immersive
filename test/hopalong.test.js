import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config.js';
import { generateHopalong } from '../src/attractor/generateHopalong.js';
import { SilentAudioBands } from '../src/audio/AudioBands.js';

test('production cloud is finite, deterministic and fills continuous depth', () => {
  const first = generateHopalong(config);
  const second = generateHopalong(config);
  assert.deepEqual(first.positions, second.positions);
  assert.equal(first.positions.length, config.particleCount * 3);
  const depthBins = new Set();
  const distinctDepths = new Set();
  for (let i = 0; i < first.positions.length; i += 3) {
    const [x, y, z] = first.positions.subarray(i, i + 3);
    assert.ok(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z));
    assert.ok(Math.abs(z) <= config.depth / 2);
    assert.ok(Math.hypot(x, y - config.eyeHeight) <= config.radius * Math.SQRT2 + 0.001);
    depthBins.add(Math.floor((z / config.depth + 0.5) * 20));
    distinctDepths.add(z);
  }
  assert.equal(depthBins.size, 20);
  assert.ok(distinctDepths.size > config.particleCount * 0.99);
});

test('audio is inert until a provider is introduced', () => {
  const audio = new SilentAudioBands();
  assert.deepEqual(audio.update(), { bass: 0, mid: 0, treble: 0, energy: 0, beat: 0 });
  assert.equal(audio.update(), audio.update());
});
