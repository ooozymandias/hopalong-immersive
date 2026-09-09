import test from 'node:test';
import assert from 'node:assert/strict';
import { BeatDetector } from '../src/audio/BeatDetector.js';
import { Travel, speeds } from '../src/controls/Travel.js';
import { createAttractor } from '../src/attractor/createAttractor.js';
import { config } from '../src/config.js';

test('transients trigger, sustained sound and silence do not; cooldown rejects double hits', () => {
  const detector = new BeatDetector(1024);
  const spectrum = new Uint8Array(1024);
  assert.equal(detector.sample(spectrum, 0, 1 / 30), false);
  spectrum.fill(200, 1, 11); // bass-only attack
  assert.equal(detector.sample(spectrum, 0.2, 1 / 30), true);
  assert.equal(detector.update(0), 0);
  assert.ok(detector.update(0.065) > 0.5);
  assert.equal(detector.sample(spectrum, 0.2, 1 / 30), false);
  spectrum.fill(0);
  detector.sample(spectrum, 0, 1 / 30);
  spectrum.fill(230, 1, 11);
  assert.equal(detector.sample(spectrum, 0.2, 1 / 30), false);
  for (let i = 0; i < 30; i++) {
    assert.equal(detector.sample(spectrum, 0.2, 1 / 30), false);
    detector.update(1 / 30);
  }
  assert.equal(detector.update(0), 0);
  spectrum.fill(0);
  detector.sample(spectrum, 0, 1 / 30);
  spectrum.fill(200, 100, 500); // broadband transient above bass
  assert.equal(detector.sample(spectrum, 0.2, 1 / 30), true);
  detector.reset();
  assert.equal(detector.sample(spectrum, 0.2, 1 / 30), false); // new track priming
});

test('travel accelerates gradually, is bounded in every mode, and pauses immediately', () => {
  for (const mode of Object.keys(speeds)) {
    const travel = new Travel(mode);
    assert.ok(travel.update(1 / 90, 1) < 0.02);
    for (let i = 0; i < 1800; i++) assert.ok(travel.update(1 / 90, 1) <= 1.4);
    travel.mode = 'Pause';
    assert.equal(travel.update(1 / 90, 1), 0);
  }
  const quiet = new Travel('Audio-reactive');
  const loud = new Travel('Audio-reactive');
  for (let i = 0; i < 900; i++) { quiet.update(1 / 90, 0); loud.update(1 / 90, 0.3); }
  assert.ok(loud.speed > quiet.speed * 2);
});

test('expression keeps 60000 points, stable buffers and smooth palette changes', () => {
  const attractor = createAttractor(config);
  const positions = attractor.points.geometry.attributes.position;
  const uniforms = attractor.points.material.uniforms;
  assert.equal(positions.count, 60000);
  const original = uniforms.palette.value[0].clone();
  attractor.setPalette('Ember');
  attractor.update(1 / 90, 0, { bass: 0.7, mid: 0.5, treble: 0.5, energy: 0.2, beat: 1 });
  assert.ok(Math.abs(uniforms.palette.value[0].r - original.r) < 0.03);
  assert.equal(uniforms.travel.value, 0);
  assert.equal(uniforms.beat.value, 1);
  assert.ok(uniforms.bass.value > 0.7);
  assert.equal(attractor.points.geometry.attributes.position, positions);
  attractor.dispose();
});
