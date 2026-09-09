# V0.7 — VR Controls, Mixed Reality & Virtual Speakers

Le mode par défaut revient au voyage à travers des couches Hopalong 2D répétées,
inspiré du [Barry Martin’s Hopalong Orbits Visualizer d’Iacopo Sassarini](https://iacopoapps.appspot.com/hopalongwebgl/).
Three.js, Vite et WebXR, sans framework UI ni backend. Mode PC et Meta Quest 3.
La musique joue indépendamment : aucune réaction des formes, couleurs ou vitesses à l’audio.

## V0.7 : contrôles XR, passthrough et enceintes virtuelles

En session VR **ou MR**, **X sur la manette gauche** ouvre/ferme un panneau 3D
devant soi. Il reste à sa position d'ouverture ; refermer/réouvrir pour le recentrer.
Pointer avec le rayon de l'une des manettes et cliquer avec la gâchette : moitié
gauche d'une ligne = précédent/diminuer, moitié droite = suivant/augmenter.
Hors menu, la gâchette conserve sa fonction pause/reprise du voyage.

Le menu donne accès à Palette, Render Mode, Composition, Speed, Rotation, VR Density,
Auto Performance, Mixed Reality, Virtual Speakers et Space. La page Audio settings
propose l'A/B audio, les paramètres de distance/gain et Play/Pause. Aucun réglage de
stéréoscopie PC n'est inclus. Le panneau utilise une texture canvas partagée, rafraîchie
uniquement si le contenu change, au plus environ 7 fois/s pour les valeurs dynamiques.

Le **stick droit vertical** augmente la vitesse vers le haut, la diminue vers le bas.
Zone morte 20 %, progression jusqu'à 8 m/s par seconde de maintien, bornes 0–24 m/s.
Relâcher conserve la consigne ; l'accélération du voyage reste amortie. Au chargement
et à chaque entrée XR, la consigne vaut **6 m/s = 25 % du maximum**.
Les entrées sont lues par `handedness`, depuis `XRSession.inputSources`, et non
depuis l'ordre de connexion. X utilise un front montant : le maintenir ne répète pas.
Le mapping suit le [profil Quest Touch](https://raw.githubusercontent.com/immersive-web/webxr-input-profiles/main/packages/registry/profiles/oculus/oculus-touch-v3.json)
et le [module WebXR Gamepads](https://www.w3.org/TR/webxr-gamepads-module-1/).

### Camera Space / World Space

**Camera Space**, défaut, accompagne les translations de tête, avec amortissement,
sans copier sa rotation. La stéréoscopie et l'orientation restent celles du casque.
**World Space**, expérimental, garde l'origine des couches fixe dans le repère
`local-floor` : bouger le corps change sa position relative aux motifs.
Le voyage déplace toujours les couches et leur recyclage utilise le Z réel de la
tête relativement au groupe. Aucun déplacement artificiel de la pose XR.
Les transitions de repère sont amorties. Le mode écran conserve son comportement.

Limite World Space : le voyage/recyclage conserve l'axe Z historique ; il ne devient
pas une navigation infinie dans toutes les directions. Aucun ancrage persistant,
scan de pièce, collision, occlusion par les murs ou recalage après changement de
repère système n'est fourni. Camera Space reste le repli stable.

### Mixed Reality

**ENTER MR** est proposé seulement si `isSessionSupported('immersive-ar')` réussit.
**ENTER VR** reste indépendant. En AR, `scene.background = null` et le framebuffer
est effacé avec alpha 0 ; le contexte WebGL a un canal alpha dès sa création.
Les formes lumineuses sont compositées sur le passthrough fourni par le runtime.
Pas de capture caméra, d'upload, de hit-test ou de reconstruction de pièce.
Le rendu XR natif, la résolution 0,85, la fovéation et Auto Performance sont conservés.

Mixed Reality dans le panneau demande un changement de session : WebXR ne permet
pas de convertir une session VR en AR. La session courante est terminée avant de
demander l'autre. Si l'autorisation/l'activation utilisateur a expiré, le panneau
écran réapparaît avec un message : cliquer **ENTER MR** ou **ENTER VR** pour continuer.
Le refus ne provoque pas de boucle de demandes. HTTPS et le support du navigateur
restent nécessaires. Voir [requestSession](https://developer.mozilla.org/en-US/docs/Web/API/XRSystem/requestSession).

### Virtual Speakers — expérimental

Le mode par défaut **Head-Locked Stereo** conserve la lecture stéréo originale.
**Virtual Speakers** ne s'active réellement que dans une session XR visible :

```text
MediaElement → Analyser → Volume principal
                           ├→ gain direct → sortie stéréo
                           └→ Splitter(2)
                               ├→ canal L → Panner mono HRTF gauche → gain suivi ┐
                               └→ canal R → Panner mono HRTF droit  → gain suivi ┴→ gain spatial → sortie
```

Les deux sources suivent les poses **gripSpace** des manettes gauche et droite.
L'auditeur suit position, orientation avant et verticale de la tête, dans le même
repère XR. Une petite orbe cyan/orange matérialise chaque source suivie.
Le rapprochement augmente naturellement le niveau jusqu'à la distance de référence ;
au-delà, le modèle de distance l'atténue. Un canal sans grip suivi devient muet,
son icône disparaît ; l'autre reste indépendant. Une perte de suivi de tête ou la
sortie XR rétablit le stéréo direct. Utiliser des écouteurs pour apprécier le HRTF.

Paramètres dans le panneau écran et Audio settings en XR : **Linear / Inverse**
(Inverse par défaut), **Near Distance** 0,05–1 m (0,15 m), **Rolloff** 0–1 (1),
**Virtual Speaker Gain** 0–2× (1×). `maxDistance` vaut 3 m. Les gains d'A/B et les
poses audio utilisent une constante de lissage de 25 ms. L'AudioContext demande
`latencyHint: 'interactive'`, sans décoder ou rejouer un fichier par enceinte.
Les [modèles PannerNode](https://developer.mozilla.org/en-US/docs/Web/API/PannerNode/distanceModel)
sont utilisés directement. Le stéréo est séparé avant les panners, jamais sommé
en mono puis dupliqué. Un fichier mono ne contient naturellement pas de canal R séparé.
Aucune audio-réactivité des formes n'est réintroduite. La lecture exige toujours
une interaction et respecte la pause volontaire.

## Render Lab V0.6 conservé

| Render | Principe / réglages |
| --- | --- |
| Points / Lines / Mixed | Rendus Classic historiques, Line Density |
| Pulse | Contours animés doucement, Pulse Shape, palette active |
| Soft Orbs | Billboards plus grands, halo doux et faible opacité |
| Streaks | Traînées fines sur tous les points du budget, Trail Length |
| Comets | Têtes claires + traînées plus épaisses, Trail Length |
| Constellations | Points et sous-ensemble de voisins locaux, Connection Density |
| Ribbons | Segments consécutifs de l'orbite, Ribbon Width / Density / Twist |
| Glyphs | Symboles statiques dans la structure, Glyph Shape |

Pulse propose Circle, Heart, Smiley, Star, Diamond, Flower, Spiral et Random Mix.
Glyphs propose Star, Heart, Smiley, Circle, Triangle, Diamond et Random Mix.
Un atlas original de 512 × 64 pixels est partagé ; Random Mix distribue plusieurs
formes simultanément, avec variations déterministes de taille, rotation et intensité.
Les couleurs suivent la palette active. Animated Sprites/GIF reste dans **Experimental**.

Comets et Streaks utilisent des quads instanciés par couche. Le mouvement apparent
est calculé avec la projection précédente par œil, incluant caméra, rotation et
translation ; l'historique est réinitialisé au recyclage. Les traînées s'allongent
avec la vitesse, varient par élément et sont plafonnées à 100/140 pixels.
Comets garde 70 % du budget en comètes et 30 % en points ; Streaks utilise tout le budget.
**Trail Length** règle 0–3×. Aucun draw call individuel par élément.

Les rubans suivent des pas réellement consécutifs, coupent les sauts >12 m et
s'interrompent régulièrement. Jusqu'à 600 segments par couche, six subdivisions
par segment, largeur variable, torsion douce, blending additif à faible opacité.
Ils gardent 18 % de points en fond. **Ribbon Width** 0,02–0,6 m, **Ribbon Density**
0–100 %, **Ribbon Twist** 0–2. Le paramètre **Render Density** 10–100 % et le budget
Auto Performance réduisent les instances. Les extrémités suivent les coordonnées
mathématiques ; aucune recherche de voisins arbitraires pour fabriquer les rubans.
Les connexions Constellations réutilisent les liens locaux bornés à 2,5 m.

Les rendus sont alloués à la première utilisation et leurs buffers réutilisés.
Ribbons/Pulse/Glyphs/Comets : au plus deux dessins par couche et par œil ; Soft Orbs
et Streaks : un. La densité et le recouvrement restent déterminants sur GPU mobile.

## Réglages et confort conservés

Les valeurs initiales sont désormais :
Classic Hopalong, Random Playlist, Mixed, Line Density 25 %, Through Forms,
Mono, séparation 300 mm, Stereo Framing Fit, vitesse Custom 6 m/s,
rotation gauche à 0°/s, densités PC et VR High à 245 000.
Hide cursor with UI et Auto Performance sont activés.

### Confort écran et Stereo Framing

**H** masque le panneau, le titre, le bouton Réglages et le curseur sur toute
l'expérience. Appuyer à nouveau sur H les restaure. La préférence **Hide cursor
with UI** permet de conserver le curseur si souhaité.

Pour Parallel et Cross-eye, **Fit** réduit le zoom de chaque caméra à 0,5 : chaque
demi-image conserve le champ horizontal de Mono, avec davantage de champ vertical.
**Fill** conserve le cadrage précédent. **Custom** expose **Stereo Zoom**, de
0,25× à 1,5×. Ces réglages ne modifient ni Mono, ni Dubois, ni les projections XR.

### Comets et Animated Sprites

**Comets** utilise désormais le rendu instancié décrit dans Render Lab ci-dessus.

**Animated Sprites**, expérimental, remplace 25, 50, 100, 150 ou 250 points par des
billboards de 0,75 m ancrés aux couches Hopalong. Les autres points restent visibles.
Une seule géométrie instanciée ajoute un draw call par œil, une texture atlas et
une horloge d'animation partagées. Rotation, déplacement et recyclage sont suivis.
Cocher Animated Sprites dans Experimental pour les voir ; choisir un Render principal pour sortir.

Le sélecteur GIF lit le fichier **uniquement dans le navigateur**, sans envoi réseau.
`gifuct-js` décode une fois dans un worker ; les frames sont compositées en respectant
transparence et disposal, puis stockées dans un atlas GPU. Seul un uniforme de frame
change pendant l'animation. Limites : 8 Mo, 512 × 512, 120 frames, 8 millions de pixels
de patches cumulés et 12 secondes de décodage. Chaque frame est réduite à une cellule
128 × 128 avec marges ; l'atlas occupe au plus environ 8 Mo de RGBA.
Une nouvelle importation remplace l'animation partagée et libère l'ancienne texture.
Les imports ne persistent pas après rechargement.

La démo **Pulse** est créée pour le projet, sans asset tiers. Le dossier
`public/sprites/demo/` documente l'ajout de GIF libres/CC0, notamment chats et chiens.
Aucun GIF animal tiers n'est fourni ou téléchargé automatiquement.

### Auto Performance en VR

Le profil VR **High / 245000** est le défaut. Auto Performance vise 72 Hz si le
runtime propose cette fréquence, sinon utilise la fréquence XR annoncée (72 Hz
comme référence si absente). La cadence XR et le temps CPU de soumission du rendu
sont mesurés. Le temps GPU réel est ajouté si l'extension
`EXT_disjoint_timer_query_webgl2` est disponible : requêtes asynchrones, sans blocage.

Une moyenne sur environ 2 secondes et plus de 3 secondes de surcharge déclenchent
les paliers **245k → 200k → 160k → 120k**, avec 6 secondes de délai entre baisses.
Les draw ranges diminuent progressivement sur environ 0,6 seconde, sans reconstruire
les buffers ni modifier les paramètres des formes. Les totaux sont arrondis par couche.
Les lignes suivent proportionnellement le budget. Une frame isolée ne suffit pas.
Le suivi est suspendu quand la session n'est plus visible ; reprise avec 5 secondes
de stabilisation. Après plus de 30 secondes de marge GPU suffisante, une remontée
d'un palier est possible, suivie d'un délai de 10 secondes.
Sans mesure GPU, les baisses restent actives mais les remontées sont désactivées.

Le profil manuel reste le plafond ; les profils Quest 3 / 98k et Light / 49k
restent disponibles. Désactiver Auto Performance restaure progressivement le plafond.
La sortie VR restaure la densité PC. Ce mécanisme ne garantit pas 72 Hz sur matériel :
un essai Quest 3 prolongé reste nécessaire, notamment en Comets et Mixed.

## Fonctions V0.4 conservées

Le principe Classic reste identique : 49 couches planes, mouvement continu,
rotation et recyclage. Les nouvelles options se trouvent dans **Identité visuelle**
et **Desktop View**. Les réglages de voyage et densité sont repliables.

### Sept palettes et playlist

| Palette | Gradient |
| --- | --- |
| Rainbow / Original | Cyan, vert, jaune, orange, rouge, magenta, violet, bleu |
| Cosmic | Bleu profond, cyan, violet, magenta |
| Emerald | Turquoise, vert, émeraude, jaune-vert |
| Fire | Rouge sombre, rouge vif, orange, jaune, blanc chaud |
| Neon Dream | Cyan vif, rose, violet, bleu électrique |
| Shiny Gold | Noir brun, cuivre, or sombre, or vif, jaune-or, blanc chaud |
| Shiny Silver | Noir, acier, argent, blanc froid, reflets bleutés |

Le gradient dépend de la sous-couche et des coordonnées du motif. Gold/Silver
utilisent des contrastes sombres et des bandes de reflets clairs, avec le blending
additif : effet métallique stylisé, sans PBR, éclairage ou texture haute résolution.
Une seule texture de gradient 256 × 1 est partagée par les couches et les lignes.

**Random Playlist** parcourt les sept palettes dans un ordre mélangé, toutes les
60 secondes. Chaque cycle contient les sept palettes une fois et la frontière
entre cycles ne répète pas la dernière palette. Le nom actif apparaît sous le menu.
Chaque changement, manuel ou automatique, utilise un fondu de trois secondes.
Le timer continue lorsque le voyage est arrêté ; il ne dépend pas de la musique.

### Points / Lines / Mixed

**Points** conserve les sprites lumineux. **Lines** dessine des segments fins
entre points successifs suffisamment proches, sinon entre voisins spatiaux locaux.
**Mixed** superpose les deux, avec 35 % de la quantité de lignes du mode Lines.

La recherche de voisinage utilise une grille spatiale avec un budget de candidats
par cellule. Les liens sont majoritairement courts ; quelques liens franchissent
des intervalles plus longs, avec une limite absolue de 2,5 m dans une couche de
60 m de large. Aucun lien entre couches ni grande diagonale entre points lointains.
Ces segments suivent localement le motif ; ce ne sont pas des splines interpolées.

**Line Density** règle 0–100 % des liens disponibles, avec 25 % par défaut. Les
indices sont mélangés de manière déterministe afin de répartir la réduction dans
le motif entier. Les positions GPU sont partagées avec les points, et les buffers
d’indices réutilisés au recyclage. Lines/Points : jusqu’à 49 dessins par œil ;
Mixed : jusqu’à 98. Pour Quest, commencer par Points ou Mixed à 10–25 %, profil
98 000 ou 49 000 particules. Les lignes restent fines, sans géométrie de ruban coûteuse.

### Desktop View

- **Mono** : rendu écran habituel, une vue.
- **Parallel Stereo** : œil gauche à gauche, œil droit à droite.
- **Cross-eye Stereo** : œil droit à gauche, œil gauche à droite.
- **Dubois Anaglyph** : deux rendus stéréo combinés avec les vraies matrices
  rouge/cyan de Dubois, y compris les contributions croisées et négatives.

Les coefficients correspondent à `three/addons/effects/AnaglyphEffect.js` de la
version Three.js installée. La combinaison s’effectue en RGB linéaire avant
conversion vers l’écran. Des lunettes rouge à gauche / cyan à droite sont requises.
Les matrices réduisent les erreurs colorimétriques ; le ghosting dépend toujours
de l’écran et des filtres des lunettes.

**Stereo Separation** va de 40 à 500 mm (300 mm par défaut), avec un amortissement
de 0,5 seconde. Les caméras utilisent des projections décentrées, sans les faire
loucher ; le plan de convergence est à 10 m. Les vues côte à côte adaptent leur
rapport d’aspect à chaque demi-écran. L’interface HTML reste une interface écran.

L’anaglyphe coûte deux rendus plus une composition. Sa qualité est réglable à
50/75/100 % de résolution par dimension (75 % par défaut). Les cibles sont créées
à la demande, redimensionnées avec la fenêtre et libérées en revenant en Mono ou
en entrant en WebXR. Les vues côte à côte ne nécessitent pas de cibles hors écran.

**En WebXR, ces réglages PC sont entièrement ignorés.** Le rendu natif du casque
utilise ses propres vues, projections, écartement et viewports. Aucun anaglyphe,
croisement ni séparation PC n’est appliqué dans le Quest. La sortie VR retrouve
le réglage Desktop View précédent.

### Composition

- **Tunnel** : génération Classic précédente.
- **Balanced** : alternance de motifs non filtrés et de motifs à présence centrale modérée.
- **Through Forms** (défaut) : privilégie les candidats avec une présence accrue sur les axes et au centre.
- **Dense Center** : privilégie une forte présence centrale, avec une cible bornée
  plutôt que la concentration maximale possible.
- **Random** : fait varier périodiquement ces comportements lors du renouvellement des motifs.

Le générateur évalue dix ensembles de paramètres sur des orbites de prévisualisation,
en mesurant la présence dans un disque central et autour des axes. Il génère ensuite
l’orbite complète avec les paramètres retenus. Les coordonnées finales proviennent
toujours de l’équation classique et de sa normalisation : aucune translation
artificielle du nuage, aucun remplissage par des points ajoutés. Il s’agit d’une
préférence statistique ; la géométrie exacte varie avec les paramètres.

La préférence s’applique aux **prochaines couches recyclées**, pour éviter de
remplacer brutalement une forme devant le spectateur. À vitesse nulle, elle devient
visible à la reprise. Les calculs et liens futurs sont préparés dans le worker ;
les couches actuelles restent affichées pendant sa préparation.

### Mode volumétrique alternatif

Le menu **Expérience** permet de passer à **Volumétrique expérimental** (60 000 points),
puis de revenir à Classic. L’ancien générateur et son matériau restent préservés.
Les options Classic de palette, lignes et composition sont désactivées dans ce mode.
Le voyage, la rotation, les vues PC, WebXR et le lecteur restent disponibles.
Aucune audio-réactivité n’est activée, dans les deux modes. Classic reste le défaut.

## Lancer le projet

Node.js 22.12+ (24 LTS conseillé) et npm :

```sh
npm ci
npm run dev
```

Ouvrir l’adresse affichée, généralement `http://localhost:5173/`.

```sh
npm test
npm run build
npm run preview
```

La compilation statique est dans `dist/`. Le catalogue MP3/OGG et le worker sont
inclus dans la compilation ; aucun service externe n’est requis pour jouer.

## Commandes

- Déplacer la souris sur la scène : décalage latéral progressif, comme la référence.
- Glisser avec le bouton gauche : regarder librement, y compris derrière soi.
- Flèches haut/bas : vitesse ; gauche/droite : sens de rotation des couches.
- **H** : masquer/afficher interface et curseur ; **Réglages** masque l'interface.
- **Stop** : arrêter la traversée ; reprendre conserve la dernière vitesse choisie.
- Rotation **Off / Gauche / Droite**, vitesse réglable de 0 à 60°/s.
- Rotation par défaut : gauche, 0°/s.
  Le réglage de rotation est indépendant de Stop ; choisir Off pour tout immobiliser.

| Vitesse | m/s |
| --- | ---: |
| Stopped | 0 |
| Very Slow | 0,3 |
| Slow | 2,4 |
| Medium | 9,6 |
| Custom (défaut) | 6 |
| Fast | 16,8 |
| Very Fast | 24 |

Le slider continu couvre 0–24 m/s par pas de 0,1. Les valeurs intermédiaires sont
identifiées **Custom**. L’accélération est amortie sur 0,45 seconde, l’arrêt est
immédiat. Le démarrage utilise explicitement 6 m/s ; Stop permet de suspendre
le voyage. La rotation se règle séparément.

## Fidélité à la référence

La page et son code public ont été consultés et le rendu comparé dans le navigateur.
Principes repris : sept sous-orbites aux points de départ voisins, répétées sur sept
niveaux ; décalage des sept sous-couches dans chaque niveau ; normalisation X/Y
indépendante ; couleurs saturées par sous-orbite ; sprites lumineux additifs sur
fond noir ; brouillard exponentiel en profondeur ; renouvellement du motif préparé
toutes les trois secondes, appliqué uniquement lors du recyclage hors du champ avant.

L’équation utilisée reste strictement la formule classique demandée :

```text
x[n+1] = y[n] - sign(x[n]) × sqrt(abs(b × x[n] - c))
y[n+1] = a - x[n]
```

Paramètres aléatoires dans les plages de la référence : a ∈ [−30, 30], b ∈ [0,2, 1,8],
c ∈ [5, 17]. Les sept sous-orbites partagent ces paramètres, avec des départs voisins.
Les couleurs parcourent cyan, vert, jaune, orange, rouge, violet, magenta et bleu.
Un même sous-motif est répété à plusieurs profondeurs pour dessiner des filaments
et un tunnel cohérents, au lieu d’un nuage aléatoire en volume.

La scène comprend **49 couches strictement planes**, espacées de 12/7 mètres, sur
84 mètres. Les coordonnées Z des points restent nulles dans chaque géométrie ;
seule la transformation de couche donne la profondeur. Une couche passée à 0,5 m
derrière la position Z du spectateur est replacée au fond du tunnel, avec les
nouveaux paramètres/couleurs préparés. Les buffers sont réutilisés.

Échelle retenue : 0,02 m par unité de l’original. À 60 images/s, sa vitesse par
défaut de 8 unités/image correspond à 9,6 m/s ; son maximum de 20 correspond à
24 m/s. Le déplacement ici est indépendant de la fréquence de rendu.

Différences explicites : le code original propose aussi des variantes avec racine
quatrième/logarithme et décalages supplémentaires ; elles sont exclues ici pour
respecter l’équation classique demandée. L’original affiche 7 × 7 × 32 000 points
(~1,568 million, avec réutilisation des orbites). Cette version respecte le budget
PC demandé de 245 000 points. Le sprite est calculé localement dans le shader,
sans copier `galaxy.png`. Ce n’est donc pas une reproduction pixel à pixel.

## Densité et performances

| Profil | Points par sous-couche | Total affiché |
| --- | ---: | ---: |
| PC | 5 000 | 245 000 |
| Quest 3 | 2 000 | 98 000 |
| Light | 1 000 | 49 000 |

Les réglages **Densité PC** et **Densité VR** sont indépendants. L’entrée en VR
applique automatiquement le profil VR choisi, la sortie restaure le profil PC.
Changer de profil reconstruit les couches ; ne pas le faire pendant une mesure.
Un compteur FPS écran permet de choisir un profil adapté. Ce compteur mesure la
cadence de rendu du navigateur, pas le temps GPU ni les performances du casque.

En mode Points, 49 objets maximum par œil ; pas de bloom plein écran, ni lumière ni ombres.
Les motifs et indices futurs sont générés dans un Web Worker avec tableaux transférables et
une file de trois motifs. La génération initiale est synchrone ; un calcul de
secours reste possible si le worker échoue. Si la file est vide, les motifs actuels
restent utilisés en attendant le worker. Seuls les
buffers des couches recyclées sont actualisés. Auto Performance peut réduire le
nombre de points dessinés sans réallouer ces buffers.

Pixel ratio PC plafonné à 1,5 ; résolution XR à 0,85 et fovéation à 1 si disponible.
Les points Classic sont plafonnés à 20 pixels ; transparence additive et recouvrement
peuvent coûter cher près d’une couche. Réduire la densité avant d’augmenter ce budget.
Aucune garantie de cadence Quest 3 sans essai matériel.

## WebXR / Quest 3

Servir le site en **HTTPS** avec un certificat approuvé, puis l’ouvrir dans Meta
Quest Browser et choisir **ENTER VR**. Une URL LAN HTTP permet le mode écran mais
pas normalement WebXR ; localhost sur le casque désigne le casque, pas le PC.
GitHub Pages fournit une URL HTTPS adaptée.

Chaque œil voit les couches à leurs profondeurs réelles : vraie parallaxe
stéréoscopique malgré les motifs plans. Le suivi de tête reste entièrement piloté
par WebXR. La souris ne déplace pas la caméra pendant une session immersive.
Translation et rotation sont appliquées aux couches, pas à la pose du casque.
La gâchette suspend/reprend le voyage hors menu. X ouvre les contrôles XR ; le
panneau écran conserve aussi les réglages détaillés des rendus avant l'entrée.
Les vitesses élevées et la rotation sont conservées pour la fidélité dynamique :
commencer avec Very Slow et Rotation Off pour vérifier son confort sur casque.

## Musiques intégrées

Déposer les `.mp3` et `.ogg` directement dans `public/music/`, sans sous-dossier.
Vite crée le catalogue par ordre alphabétique. Les noms avec espaces/caractères
spéciaux sont encodés dans les URL. Ajouter/remplacer un fichier recharge la page
en développement ; pour un site publié, recompiler et redéployer.

Aucun autoplay à l’ouverture. **Démarrer avec la musique**, ou un clic explicite
sur **ENTER VR**, initialise l’AudioContext et lance le premier morceau ou celui
sélectionné. Play/Pause, précédent/suivant et volume restent disponibles. Le lecteur
conserve les pauses volontaires lors d’une nouvelle entrée VR, enchaîne les morceaux
et boucle la liste. Le volume initial est de 35 %, avec une montée de 0,8 seconde.

Le graphe Web Audio historique reste utilisable pour le volume ; la boucle Classic
n’appelle pas l’analyse audio et ne transmet aucune bande ni beat au rendu. Il n’y
a plus de diagnostics audio dans l’interface. Les musiques ne modifient rien au voyage.
Conserver les licences/crédits des morceaux destinés à la redistribution.

## Architecture et mode expérimental préservé

```text
src/main.js                       point d’entrée Classic par défaut
src/classic/generateOrbit.js       équation 2D, sept sous-orbites et couleurs
src/classic/orbit.worker.js        génération anticipée hors du thread de rendu
src/classic/createClassic.js       couches, sprites, densité et recyclage
src/classic/ClassicMotion.js       vitesse continue et rotation
src/classic/visualPalettes.js      gradients, fondu et playlist de 60 secondes
src/classic/lineGeometry.js        voisinage local et indices de segments
src/classic/composition.js         sélection des paramètres selon la présence centrale
src/rendering/DesktopStereo.js    stéréo écran, matrices Dubois, protection WebXR
src/rendering/defaults.js         valeurs initiales
src/rendering/renderModes.js      registre des modes et contrat d'extension
src/rendering/AutoPerformance.js  mesure GPU/CPU et hystérésis XR
src/rendering/sprites/            sprites instanciés, atlas, décodeur GIF et worker
src/rendering/lab/                quads groupés, rubans et atlas de formes
src/xr/input.js                   X et stick droit, mapping par handedness
src/xr/FloatingMenu.js            panneau 3D et raycasting
src/xr/SessionManager.js          support et transitions VR / AR
src/xr/SpatialFrame.js            origine Camera Space / World Space
src/audio/VirtualSpeakers.js      splitter stéréo, deux panners et A/B
src/controls/DesktopLook.js        regard souris
src/audio/MusicPlayer.js           lecteur indépendant du rendu
build/musicCatalog.js              catalogue statique des fichiers intégrés
src/experimental/README.md         réutilisation future du mode volumétrique
```

Le code volumétrique précédent est conservé dans `src/attractor/`, avec ses palettes,
`src/controls/Travel.js`, l’analyse et les beats dans `src/audio/`. Ses tests sont
conservés. Le menu Expérience utilise sa factory `createAttractor(config)` à la
première sélection. Les réglages Classic sont conservés lorsqu’on revient à Classic.

### Ajouter un rendu

Pour ajouter un autre rendu, étendre le registre `renderModes.js` et fournir un rendu groupé consommant les positions
et transformations des couches, comme `AnimatedSprites`. Un mode peut partager
les points/lignes existants ou gérer une géométrie instanciée avec `update`,
`setCount` et `dispose`. La génération Hopalong et son worker restent indépendants.
Les rendus Render Lab sont implémentés dans `src/rendering/lab/`.

## GitHub Pages

Vite utilise `base: './'`. Aucun déploiement n’est effectué automatiquement.

1. Pousser le dépôt sur GitHub.
2. Settings → Pages → Source : GitHub Actions.
3. Actions → Deploy GitHub Pages → Run workflow.
4. Ouvrir l’URL HTTPS retournée.

Le workflow teste, compile puis publie uniquement `dist/`, worker et musiques inclus.

## Vérification

`npm test` couvre les couches planes, la variété des paramètres, le recyclage prolongé
à vitesse maximale, les profils, les buffers stables, la vitesse/rotation et le lecteur.
Les tests du mode volumétrique restent actifs. `npm run build` compile également le worker.

Vérifications manuelles : comparer plusieurs générations avec la référence, essayer
Stopped/Very Fast et le slider, les deux sens de rotation, masquer le panneau, changer
la densité, regarder latéralement/derrière soi, écouter la musique sans modification
visuelle. Sur Quest : vérifier stéréoscopie, cadence soutenue, recyclage, gâchette et
entrée/sortie VR répétée. La comparaison écran ne remplace pas ces essais matériels.

Tests V0.4 : cycles de playlist sans répétition, délai de 60 s, transitions,
segments de longueurs bornées, indices GPU stables, présence centrale mesurée,
ordre des yeux et coefficients Dubois, contournement des modes PC en WebXR.
Vérifier manuellement les palettes après leur fondu, Lines/Mixed à plusieurs
densités, les quatre vues PC, le retour Mono, le mode alternatif et le redimensionnement.
La fluidité et le confort sur Quest restent à mesurer sur le matériel réel.

Tests V0.5 : conservation du champ horizontal Fit, baisse/restauration de budget
avec hystérésis, résistance aux frames isolées, buffers stables, comètes groupées,
sprites instanciés et atlas partagé, GIF transparent avec disposal 2/3 et délais.
`test/fixtures/moving-pixel.gif` est une animation minimale créée pour tester
manuellement l'import local. Vérifier aussi H sur le canvas et les contrôles,
Fit/Fill/Custom en Parallel et Cross-eye, et le retour à Mono après WebXR.

Tests V0.6/V0.7 : extrémités des rubans, atlas distincts et partagé, historique de
mouvement par œil, densités, fronts X, stick, suivi du repère et recyclage, rayons
du menu, routage L/R, perte de grip et repli de changement de session refusé.
Ces tests simulent les API XR/audio ; ils ne constituent pas un essai sur casque.

Sur Quest 3 réel, vérifier : X maintenu/relâché, rayons des deux mains, stick et
pause, déplacement physique World Space, entrée/sortie VR/MR répétée, transparence
du passthrough, A/B avec morceau stéréo, une manette près de chaque oreille puis
loin et hors suivi, reprise après menu système et cadence soutenue à 72 Hz.
Le casque n'est pas disponible dans cet environnement : confort, passthrough,
latence et rendu spatial auditif restent à valider sur le matériel.
