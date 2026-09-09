import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function readMusicCatalog(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(mp3|ogg)$/i.test(entry.name))
    .map((entry) => ({ file: entry.name, title: entry.name.replace(/\.(mp3|ogg)$/i, '') }))
    .sort((a, b) => a.file.localeCompare(b.file, 'fr'));
}

// The browser cannot list a directory on a static host. Embed the catalog at
// build time, keeping the audio files in public/ instead of bundling their bytes.
export function musicCatalogPlugin() {
  const id = 'virtual:music-catalog';
  const resolvedId = '\0' + id;
  let directory;
  return {
    name: 'music-catalog',
    configResolved(config) { directory = resolve(config.publicDir, 'music'); },
    resolveId(source) { if (source === id) return resolvedId; },
    load(source) {
      if (source !== resolvedId) return;
      return `export default ${JSON.stringify(readMusicCatalog(directory))};`;
    },
    configureServer(server) {
      const refresh = (path) => {
        if (dirname(resolve(path)) !== directory || !/\.(mp3|ogg)$/i.test(path)) return;
        const module = server.moduleGraph.getModuleById(resolvedId);
        if (module) server.moduleGraph.invalidateModule(module);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.add(directory);
      server.watcher.on('add', refresh).on('unlink', refresh).on('change', refresh);
      server.httpServer?.once('close', () => {
        for (const event of ['add', 'unlink', 'change']) server.watcher.off(event, refresh);
      });
    },
  };
}
