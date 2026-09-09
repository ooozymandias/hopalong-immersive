import { generateComposition } from './composition.js';
self.onmessage = ({ data }) => {
  const orbit = generateComposition(data.seed, data.count, data.composition);
  self.postMessage(orbit, [...orbit.arrays, ...orbit.lines].map((array) => array.buffer));
};
