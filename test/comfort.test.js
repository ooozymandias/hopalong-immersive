import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, StereoCamera } from 'three';
import { AutoPerformance } from '../src/rendering/AutoPerformance.js';
import { stereoZoom } from '../src/rendering/DesktopStereo.js';
import { decodeGif } from '../src/rendering/sprites/decodeGif.js';
import { createClassic } from '../src/classic/createClassic.js';

function sampleFor(safety, seconds, interval, gpu = null) {
  for (let i = 0; i < seconds * 1000 / interval; i++) safety.sample(interval, 3, gpu);
}

test('XR safety ignores isolated stalls, lowers progressively and restores only with sustained GPU margin', () => {
  const safety = new AutoPerformance();
  sampleFor(safety, 10, 1000 / 72, 3);
  safety.sample(400, 100);
  sampleFor(safety, 5, 1000 / 72, 3);
  assert.equal(safety.count, 245000);
  const seen = new Set();
  for (let i = 0; i < 1800; i++) seen.add(safety.sample(1000 / 36, 3, 20));
  assert.deepEqual([...seen], [245000, 200000, 160000, 120000]);
  sampleFor(safety, 60, 1000 / 72);
  assert.equal(safety.count, 120000, 'CPU headroom alone must not trigger an upgrade');
  sampleFor(safety, 35, 1000 / 72, 3);
  assert.equal(safety.count, 160000);
  safety.warmup();
  assert.equal(safety.count, 160000, 'refocusing must preserve quality');
  safety.reset(98000);
  sampleFor(safety, 40, 500, 400);
  assert.equal(safety.count, 98000, 'manual low profile remains the ceiling and floor');
  safety.reset(); sampleFor(safety, 80, 500, 400);
  assert.equal(safety.count, 120000, 'sustained severe stalls also lower quality');
});

test('Fit preserves Mono horizontal field at half viewport width; Fill retains old crop', () => {
  const mono = new PerspectiveCamera(60, 16 / 9, 0.05, 100);
  const stereo = new StereoCamera(); stereo.aspect = 0.5; stereo.eyeSep = 0;
  const framed = mono.clone(); framed.zoom *= stereoZoom('Fit'); framed.updateProjectionMatrix();
  stereo.update(framed);
  assert.ok(Math.abs(stereo.cameraL.projectionMatrix.elements[0] - mono.projectionMatrix.elements[0]) < 1e-10);
  framed.zoom = stereoZoom('Fill'); framed.updateProjectionMatrix(); stereo.update(framed);
  assert.ok(Math.abs(stereo.cameraL.projectionMatrix.elements[0] - mono.projectionMatrix.elements[0] * 2) < 1e-10);
  assert.equal(stereoZoom('Custom', 0.7), 0.7);
  assert.equal(mono.zoom, 1);
});

// Original two-pixel GIF fixture: white pixel moves right, transparent background.
export function movingPixelGif(disposal = 2) {
  return Uint8Array.from([
    ...new TextEncoder().encode('GIF89a'), 2,0,1,0,128,0,0, 0,0,0,255,255,255,
    33,249,4,disposal*4+1,10,0,0,0, 44,0,0,0,0,2,0,1,0,0, 2,2,12,10,0,
    33,249,4,9,20,0,0,0, 44,1,0,0,0,1,0,1,0,0, 2,2,76,1,0, 59,
  ]).buffer;
}

test('GIF atlas respects timing, transparent patches, clear and restore disposal', () => {
  for (const disposal of [2, 3]) {
    const atlas = decodeGif(movingPixelGif(disposal));
    assert.deepEqual(atlas.delays, [100, 200]);
    assert.equal(atlas.width, 256); assert.equal(atlas.height, 128);
    const alpha = (x) => atlas.data[(64 * atlas.width + x) * 4 + 3];
    assert.equal(alpha(20), 255); assert.equal(alpha(100), 0);
    assert.equal(alpha(148), 0); assert.equal(alpha(228), 255);
  }
  assert.throws(() => decodeGif(new ArrayBuffer(3)), /pas un GIF/);
  assert.throws(() => decodeGif(new ArrayBuffer(8 * 1024 * 1024 + 1)), /8 Mo/);
  const oversized = new Uint8Array(movingPixelGif()); oversized[7] = 3;
  assert.throws(() => decodeGif(oversized.buffer), /512/);
});

test('budget changes retain buffers; comet mode stays batched; sprites share one animated atlas', () => {
  const classic = createClassic({ worker: false });
  const layer = classic.points.children[0], positions = layer.geometry.attributes.position.array;
  classic.setRenderBudget(120000); classic.update(0.01, 15.9, 0);
  assert.ok(classic.particleCount < 245000 && classic.particleCount > 200000);
  for (let i = 0; i < 240; i++) classic.update(1 / 60, 15.9, 0);
  assert.ok(Math.abs(classic.particleCount - 120000) < 250);
  assert.equal(layer.geometry.attributes.position.array, positions);
  classic.setRenderMode('Comets');
  assert.equal(classic.points.children.length, 49);
  assert.equal(layer.userData.lab.quad.material.uniforms.mode.value, 4);
  assert.ok(layer.userData.lab.quad.geometry.instanceCount > 1000);
  assert.equal(layer.children[0].visible, false);
  classic.setRenderMode('Animated Sprites'); classic.setSpriteCount(250);
  const mesh = classic.points.children[49], texture = mesh.material.uniforms.atlas.value;
  assert.equal(mesh.geometry.instanceCount, 250);
  const masked = classic.points.children.slice(0,49).reduce((n, item) => n + item.geometry.attributes.spriteMask.array.reduce((a,b) => a+b,0),0);
  assert.equal(masked, 250);
  classic.update(0.1, 0, 0);
  assert.equal(mesh.material.uniforms.frame.value, 1);
  assert.equal(mesh.material.uniforms.atlas.value, texture);
  assert.ok(Math.abs(mesh.geometry.attributes.offset.array[2] - layer.position.z) < 1e-5);
  classic.setProfile('Light');
  assert.equal(mesh.geometry.instanceCount, 250);
  assert.equal(classic.points.children[49], mesh);
  classic.setRenderMode('Mixed'); assert.equal(mesh.visible, false);
  assert.equal(layer.material.uniforms.cometMode.value, 0);
  classic.dispose();
});
