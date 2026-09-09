# Mode volumétrique V0.3 conservé

Le code précédent reste intact dans `src/attractor/createAttractor.js`,
`generateHopalong.js`, `palettes.js`, `src/controls/Travel.js` et les modules
`src/audio/AudioBands.js`, `BeatDetector.js`, `bandMath.js`.

Il est sélectionnable dans V0.4 via **Expérience → Volumétrique expérimental**.
Pour réutiliser ce mode,
créer une instance via `createAttractor(config)`, ajouter `points` à la scène,
appeler `update(delta, speed, bands)` et `dispose()` lors du changement de mode.
Les tests `expression.test.js` et `hopalong.test.js` vérifient toujours cette base.

Classic démarre dans `src/main.js` avec `createClassic()`, et n'appelle pas
`music.update()`. L’audio joue sans modifier les formes, couleurs ou vitesses.
