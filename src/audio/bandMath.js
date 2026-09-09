export const bandRanges = Object.freeze({ bass: [20, 250], mid: [250, 2000], treble: [2000, 16000] });

// Non-overlapping ranges, respecting the device's actual sample rate/Nyquist.
export function frequencyBins(low, high, sampleRate, fftSize) {
  const count = fftSize / 2;
  return [Math.min(count, Math.max(1, Math.ceil(low * fftSize / sampleRate))),
    Math.min(count, Math.ceil(high * fftSize / sampleRate))];
}

export function averageBand(data, start, end) {
  if (end <= start) return 0;
  let sum = 0;
  for (let i = start; i < end; i++) sum += data[i];
  return sum / ((end - start) * 255);
}

export function rms(data) {
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
  return Math.min(1, Math.sqrt(sum / data.length));
}

// Exponential envelope: independent of headset refresh rate, slow rise and fall.
export function smoothBand(current, target, delta) {
  const seconds = target > current ? 0.22 : 0.5;
  return current + (target - current) * (1 - Math.exp(-Math.max(0, delta) / seconds));
}
