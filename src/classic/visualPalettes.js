import { Color, DataTexture, RGBAFormat, LinearFilter } from 'three';

export const visualPalettes = Object.freeze({
  'Rainbow / Original': ['#00ddff', '#17f17a', '#e4ff18', '#ff9015', '#fa183b', '#ff28cd', '#8b31ed', '#154dff', '#00ddff'],
  Cosmic: ['#050c40', '#184ab5', '#13bde3', '#6530b7', '#de2dd5', '#050c40'],
  Emerald: ['#022c23', '#00a899', '#22edbb', '#07954c', '#92ef25', '#022c23'],
  Fire: ['#210006', '#840b13', '#ff2510', '#ff8614', '#ffdf44', '#fff4cc', '#840b13'],
  'Neon Dream': ['#00fff1', '#ff26c7', '#b61aff', '#173dff', '#00fff1'],
  'Shiny Gold': ['#080400', '#40200a', '#a0561a', '#77600a', '#d6a91b', '#ffd451', '#fff8dc', '#a06b13', '#080400'],
  'Shiny Silver': ['#030508', '#28313d', '#677886', '#b8c5d0', '#f0f6ff', '#d6efff', '#ffffff', '#596b7a', '#030508'],
});

export class PalettePlaylist {
  constructor(random = Math.random) { this.random = random; this.remaining = []; this.last = null; }
  next() {
    if (!this.remaining.length) {
      this.remaining = Object.keys(visualPalettes);
      for (let i = this.remaining.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [this.remaining[i], this.remaining[j]] = [this.remaining[j], this.remaining[i]];
      }
      if (this.remaining[0] === this.last) [this.remaining[0], this.remaining[1]] = [this.remaining[1], this.remaining[0]];
    }
    this.last = this.remaining.shift();
    return this.last;
  }
}

function gradient(name) {
  const stops = visualPalettes[name].map((hex) => new Color(hex));
  const values = new Float32Array(256 * 3);
  const color = new Color();
  for (let i = 0; i < 256; i++) {
    const t = i / 255 * (stops.length - 1);
    const k = Math.min(stops.length - 2, Math.floor(t));
    color.copy(stops[k]).lerp(stops[k + 1], t - k).toArray(values, i * 3);
  }
  return values;
}

export class VisualPalette {
  constructor() {
    this.name = 'Rainbow / Original';
    this.mode = this.name;
    this.current = gradient(this.name);
    this.from = this.current.slice();
    this.target = this.current.slice();
    this.bytes = new Uint8Array(256 * 4);
    this.texture = new DataTexture(this.bytes, 256, 1, RGBAFormat);
    this.texture.minFilter = this.texture.magFilter = LinearFilter;
    this.playlist = new PalettePlaylist();
    this.transition = 3; this.elapsed = 0;
    this.upload();
  }
  upload() {
    for (let i = 0; i < 256; i++) {
      for (let c = 0; c < 3; c++) this.bytes[i * 4 + c] = Math.round(this.current[i * 3 + c] * 255);
      this.bytes[i * 4 + 3] = 255;
    }
    this.texture.needsUpdate = true;
  }
  change(name) {
    this.name = name; this.from.set(this.current); this.target = gradient(name); this.transition = 0;
  }
  set(name) {
    if (name !== 'Random Playlist' && !visualPalettes[name]) return;
    this.mode = name; this.elapsed = 0;
    if (name === 'Random Playlist') {
      this.playlist = new PalettePlaylist(); this.playlist.last = this.name;
      this.change(this.playlist.next());
    } else this.change(name);
  }
  update(delta) {
    if (this.mode === 'Random Playlist') {
      this.elapsed += delta;
      if (this.elapsed >= 60) { this.elapsed %= 60; this.change(this.playlist.next()); }
    }
    if (this.transition >= 3) return;
    this.transition = Math.min(3, this.transition + delta);
    const t = this.transition / 3;
    const blend = t * t * (3 - 2 * t);
    for (let i = 0; i < this.current.length; i++) this.current[i] = this.from[i] + (this.target[i] - this.from[i]) * blend;
    this.upload();
  }
  dispose() { this.texture.dispose(); }
}
