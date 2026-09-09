import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readMusicCatalog } from '../build/musicCatalog.js';
import { averageBand, bandRanges, frequencyBins, rms, smoothBand } from '../src/audio/bandMath.js';
import { AudioBands } from '../src/audio/AudioBands.js';
import { MusicPlayer } from '../src/audio/MusicPlayer.js';

test('catalog discovers only audio files, sorts names and supports replacement', () => {
  const directory = mkdtempSync(join(tmpdir(), 'hopalong-music-'));
  try {
    for (const name of ['Zéro + #.MP3', 'Alpha.ogg', 'README.md']) writeFileSync(join(directory, name), '');
    mkdirSync(join(directory, 'folder.mp3'));
    assert.deepEqual(readMusicCatalog(directory).map((track) => track.file), ['Alpha.ogg', 'Zéro + #.MP3']);
    rmSync(join(directory, 'Alpha.ogg'));
    assert.equal(readMusicCatalog(directory).length, 1);
  } finally { rmSync(directory, { recursive: true }); }
});

test('frequency bands separate bass, mids and treble at multiple device sample rates', () => {
  for (const rate of [32000, 44100, 48000]) {
    for (const [target, frequency] of [['bass', 100], ['mid', 1000], ['treble', 6000]]) {
      const spectrum = new Uint8Array(1024);
      spectrum[Math.round(frequency * 2048 / rate)] = 255;
      for (const [key, [low, high]] of Object.entries(bandRanges)) {
        const level = averageBand(spectrum, ...frequencyBins(low, high, rate, 2048));
        assert.equal(level > 0, key === target);
      }
    }
  }
  assert.equal(rms(new Float32Array(2048)), 0);
  assert.ok(Math.abs(rms(Float32Array.from({ length: 2048 }, (_, i) => Math.sin(i * Math.PI / 32))) - Math.SQRT1_2) < 0.001);
});

test('smoothing has no abrupt step and is independent of 72/90/120 Hz', () => {
  const outcomes = [72, 90, 120].map((hz) => {
    let level = 0;
    for (let i = 0; i < hz; i++) level = smoothBand(level, 1, 1 / hz);
    return level;
  });
  assert.ok(smoothBand(0, 1, 1 / 72) < 0.07);
  assert.ok(Math.abs(outcomes[0] - outcomes[2]) < 1e-12);
  let level = 1;
  for (let i = 0; i < 90 * 8; i++) level = smoothBand(level, 0, 1 / 90);
  assert.ok(level < 0.002);
});

class FakeContext {
  static instances = [];
  constructor() {
    FakeContext.instances.push(this);
    this.sampleRate = 48000; this.currentTime = 0; this.state = 'suspended';
    this.sourceCount = 0; this.reads = 0;
  }
  createAnalyser() {
    return { frequencyBinCount: 1024, connect() {}, disconnect() {},
      getByteFrequencyData: (data) => { this.reads++; data.fill(128); },
      getFloatTimeDomainData: (data) => data.fill(0.25) };
  }
  createGain() {
    return { connect() {}, disconnect() {}, gain: { value: 0, cancelScheduledValues() {},
      setValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {} } };
  }
  createMediaElementSource() { this.sourceCount++; return { connect() {}, disconnect() {} }; }
  resume() { this.state = 'running'; return Promise.resolve(); }
  close() { this.state = 'closed'; return Promise.resolve(); }
}

test('provider is lazy, reuses its graph and arrays, reads at 30 Hz and fades on pause', async (t) => {
  t.mock.method(globalThis, 'AudioContext', function () { return new FakeContext(); });
  const media = { paused: true, ended: false };
  const audio = new AudioBands(media);
  assert.equal(audio.context, null);
  assert.deepEqual(audio.update(1), { bass: 0, mid: 0, treble: 0, energy: 0, beat: 0 });
  await audio.activate();
  await audio.activate();
  assert.equal(audio.context.sourceCount, 1);
  media.paused = false;
  const output = audio.bands;
  const spectrum = audio.spectrum;
  for (let i = 0; i < 90; i++) audio.update(1 / 90);
  assert.ok(audio.context.reads <= 31);
  assert.ok(output.bass > 0.3 && output.energy > 0.1);
  assert.equal(audio.spectrum, spectrum);
  media.paused = true;
  for (let i = 0; i < 720; i++) assert.equal(audio.update(1 / 90), output);
  assert.ok(output.bass < 0.002);
  audio.dispose();
  assert.equal(audio.context.state, 'closed');
});

class Element extends EventTarget {
  value = ''; disabled = false; textContent = '';
  setAttribute() {}
  replaceChildren() {}
}
class FakeMedia extends EventTarget {
  paused = true; ended = false;
  playCalls = 0;
  play() {
    this.playCalls++;
    if (this.failure) return Promise.reject(this.failure);
    this.paused = false;
    this.dispatchEvent(new Event('playing'));
    return Promise.resolve();
  }
  pause() { this.paused = true; }
  removeAttribute() {}
  load() {}
}
// Define absent browser constructors for scoped mock replacement in Node.
globalThis.AudioContext ??= function () {};
globalThis.Audio ??= function () {};
globalThis.Option ??= function () {};

test('player requires a gesture, respects pause, wraps tracks and reports rejected playback', async (t) => {
  t.mock.method(globalThis, 'AudioContext', function () { return new FakeContext(); });
  t.mock.method(globalThis, 'Audio', function () { return new FakeMedia(); });
  t.mock.method(globalThis, 'Option', function () {});
  const elements = new Map();
  const root = { querySelector: (id) => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  }, querySelectorAll: () => [...elements.values()] };
  const player = new MusicPlayer([{ file: 'A + #.mp3', title: 'A' }, { file: 'B.ogg', title: 'B' }], root, '/project/');
  assert.equal(player.audio.context, null);
  assert.equal(player.media.playCalls, 0);
  assert.equal(player.media.src, '/project/music/A%20%2B%20%23.mp3');
  await player.play();
  assert.equal(player.media.paused, false);
  player.choose(1);
  assert.equal(player.media.src, '/project/music/B.ogg');
  player.pause();
  const calls = player.media.playCalls;
  player.startFromGesture();
  assert.equal(player.media.playCalls, calls);
  player.choose(2);
  assert.equal(player.index, 0);
  assert.equal(player.media.paused, true);
  player.media.failure = { name: 'NotAllowedError' };
  await player.play();
  assert.equal(player.wantPlaying, false);
  assert.match(player.message.textContent, /bloquée/);
  player.dispose();
  assert.equal(player.audio.context.state, 'closed');
});
