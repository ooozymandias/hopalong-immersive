import { parseGIF, decompressFrame } from 'gifuct-js';

export function decodeGif(buffer) {
  if (buffer.byteLength > 8 * 1024 * 1024) throw new Error('GIF limité à 8 Mo.');
  const signature = String.fromCharCode(...new Uint8Array(buffer, 0, Math.min(6, buffer.byteLength)));
  if (!['GIF87a', 'GIF89a'].includes(signature)) throw new Error('Ce fichier n’est pas un GIF valide.');
  const gif = parseGIF(buffer);
  const { width, height } = gif.lsd;
  const frames = gif.frames.filter((frame) => frame.image);
  if (!width || !height || width > 512 || height > 512 || !frames.length || frames.length > 120) {
    throw new Error('GIF limité à 512 × 512 pixels et 120 frames.');
  }
  let pixels = 0;
  for (const frame of frames) {
    const d = frame.image.descriptor;
    pixels += d.width * d.height;
    if (!d.width || !d.height || d.left + d.width > width || d.top + d.height > height || pixels > 8000000) {
      throw new Error('GIF trop complexe ou dimensions de frame invalides.');
    }
  }
  const columns = Math.ceil(Math.sqrt(frames.length)), rows = Math.ceil(frames.length / columns);
  const tile = 128, atlasWidth = columns * tile, atlasHeight = rows * tile;
  const data = new Uint8Array(atlasWidth * atlasHeight * 4);
  const canvas = new Uint8ClampedArray(width * height * 4);
  const delays = [];
  let previous = null, restore = null;
  const bg = gif.gct?.[gif.lsd.backgroundColorIndex] ?? [0, 0, 0];
  const scale = Math.min(124 / width, 124 / height);
  const drawWidth = Math.max(1, Math.round(width * scale)), drawHeight = Math.max(1, Math.round(height * scale));
  function clearRect(d, transparent) {
    for (let y = d.top; y < d.top + d.height; y++) for (let x = d.left; x < d.left + d.width; x++) {
      const k = (y * width + x) * 4;
      canvas[k] = transparent ? 0 : bg[0]; canvas[k + 1] = transparent ? 0 : bg[1];
      canvas[k + 2] = transparent ? 0 : bg[2]; canvas[k + 3] = transparent ? 0 : 255;
    }
  }
  for (let index = 0; index < frames.length; index++) {
    if (previous?.disposalType === 2) clearRect(previous.dims, previous.transparentIndex !== undefined);
    else if (previous?.disposalType === 3 && restore) canvas.set(restore);
    const frame = decompressFrame(frames[index], gif.gct, true);
    if (index === 0) clearRect({ left: 0, top: 0, width, height }, frame.transparentIndex !== undefined);
    restore = frame.disposalType === 3 ? canvas.slice() : null;
    const d = frame.dims;
    for (let y = 0; y < d.height; y++) for (let x = 0; x < d.width; x++) {
      const from = (y * d.width + x) * 4, to = ((y + d.top) * width + x + d.left) * 4;
      if (frame.patch[from + 3]) canvas.set(frame.patch.subarray(from, from + 4), to);
    }
    const x0 = index % columns * tile + Math.floor((tile - drawWidth) / 2);
    const y0 = Math.floor(index / columns) * tile + Math.floor((tile - drawHeight) / 2);
    for (let y = 0; y < drawHeight; y++) for (let x = 0; x < drawWidth; x++) {
      const source = (Math.min(height - 1, Math.floor(y / scale)) * width + Math.min(width - 1, Math.floor(x / scale))) * 4;
      data.set(canvas.subarray(source, source + 4), ((y0 + y) * atlasWidth + x0 + x) * 4);
    }
    delays.push(Math.max(20, Math.min(10000, frame.delay || 100)));
    previous = frame;
  }
  return { data, width: atlasWidth, height: atlasHeight, columns, rows, delays };
}
