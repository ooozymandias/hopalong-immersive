# Démonstrations locales

V0.5 propose une animation procédurale « Pulse », créée pour le projet dans
`src/rendering/sprites/AnimatedSprites.js`. Aucun asset tiers n’est téléchargé.

Pour des chats/chiens animés, déposer ici des GIF personnels ou explicitement CC0,
avec leur provenance et licence. Les sélectionner via le file picker local du
lecteur de sprites (les fichiers de ce dossier ne sont pas chargés automatiquement).
Les GIF déposés dans `public/` seront publics lors du déploiement ; les GIF choisis
uniquement dans le navigateur ne sont ni sauvegardés dans le projet ni uploadés.

Limites : 8 Mo, 512 × 512 pixels, 120 frames et 8 millions de pixels décodés cumulés.
Le décodeur fabrique un atlas partagé, avec frames réduites dans des cases de 128 px.
