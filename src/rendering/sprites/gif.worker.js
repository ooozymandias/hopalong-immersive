import { decodeGif } from './decodeGif.js';
self.onmessage = ({ data }) => {
  try {
    const atlas = decodeGif(data);
    self.postMessage({ atlas }, [atlas.data.buffer]);
  } catch (error) { self.postMessage({ error: error.message || 'GIF illisible.' }); }
};
