# Défense Néon — Architecture

HTML/CSS/JS vanilla, sans module ES6 ni dépendance. Fichiers chargés dans cet ordre par
`index.html` : `config.js`, `aleatoire.js`, `carte.js`, `ennemi.js`, `vagues.js`,
`unite.js`, `tour.js`, `progression.js`, `particules.js`, `son.js`, `decor.js`,
`interface.js`, `jeu.js`.

## Fichiers

- **`index.html`** — page unique : titre, canvas de jeu avec ses trois écrans superposés
  (accueil, victoire, défaite) et le HUD en cours de partie.
- **`css/style.css`** — mise en page responsive, canvas centré, boutons tactiles 44px,
  écrans superposés positionnés en absolu sur le canvas. Contient une règle globale
  `[hidden] { display: none !important; }` : indispensable, sans quoi les règles
  `display: flex` posées par ailleurs sur `.ecran-superpose` et `.barre-hud` (styles
  d'auteur) primeraient sur le `display: none` que le navigateur applique par défaut à
  l'attribut `hidden` (style agent utilisateur), et les écrans resteraient tous visibles
  en même temps.
- **`js/config.js`** — objet `Config` : toutes les constantes réglables (dimensions de
  grille, contraintes de génération, poids de direction, couleurs, caractéristiques des
  ennemis, cadence des vagues, durées de partie proposées à l'accueil via
  `DUREES_PARTIE`). `Config.LIGNE_MAX` est calculé après l'objet, à partir de
  `Config.LIGNES`.
- **`js/aleatoire.js`** — objet `Aleatoire` : générateur pseudo-aléatoire à graine
  (mulberry32). `initialiser(graine)`, `nombre()`, `entier(min, max)`, `choix(tableau)`.
- **`js/carte.js`** — objet `Carte` : génération et dessin de la carte, à
  `Config.NOMBRE_CHEMINS` chemins distincts depuis la phase 6A (voir « Chemins
  multiples (phase 6A) » ci-dessous pour le détail).
  État : `grille`, `chemins` (un chemin unique avant la phase 6A), `tailleCase`,
  `segmentsBordure`/`tachesAsphalte` (phase 7B). Fonctions publiques :
  `generer(graine)`, `estConstructible(colonne, ligne)`, `estAdjacentAUnChemin(colonne,
  ligne)`/`trouverPointBlocagePourCaserne(colonne, ligne)` (phase 7E, voir « Tour
  Caserne (phase 7E) » ci-dessous), `pixelsVersCase(x, y)`,
  `caseVersPixels(colonne, ligne)`, `recalculerPixels()`, `dessiner(ctx)`.
- **`js/ennemi.js`** — classe `Ennemi` : une unité qui suit son propre chemin
  (`Carte.chemins[this.cheminIndex].pointsDePassage`, `cheminIndex` fixé à la
  création — un seul chemin global avant la phase 6A) — ou, depuis la phase 7F,
  suit un trajet en ligne droite si `this.vole` est vrai (voir plus bas). Propriétés :
  `x`, `y`, `type`, `pointsDeVie`, `pointsDeVieMax`, `vitesse`, `cheminIndex`,
  `indexPointDePassage`, `recompense`, `degatsCorpsACorps` (phase 7E, dégâts infligés à
  une unité de Caserne qui le bloque ; toujours 0 pour un drone), `vivant`, `arrive`,
  `angleDirection` (phase 7A), `vole` (phase 7F, vrai seulement pour le drone) — plus,
  pour un ennemi volant uniquement : `pointDepart`/`pointArrivee` (positions en pixels
  du trajet en ligne droite, tirées une seule fois à la création), `cheminIndex`/
  `indexPointDePassage` valant alors `null`. Méthodes : `deplacer(dt)` (depuis la
  phase 7E, un ennemi au sol reste figé sans avancer si une unité de Caserne vivante
  bloque le point qu'il s'apprête à atteindre — voir « Tour Caserne (phase 7E) »
  ci-dessous ; depuis la phase 7F, un ennemi volant suit sa ligne droite et ignore ce
  blocage entièrement, voir « Le triangle Flak/Caserne/Drone (phase 7F) » plus bas),
  `subirDegats(montant)` (sans appelant avant la phase 1C), `progression()` (phase 7F,
  généralise le calcul historique de `Tour.progressionEnnemi` — voir « Ciblage des
  tours » plus haut — à un ennemi volant en plus d'un ennemi au sol), `dessiner(ctx)`
  (depuis la phase 7G, calcule la taille du châssis Boss séparément de la formule
  proportionnelle aux PV utilisée par les trois autres types au sol — voir « Vagues de
  boss (phase 7G) » ci-dessous).
  Une petite table interne (`COULEURS_CSS_ENNEMIS`) convertit les noms de couleur de
  `Config.TYPES_ENNEMIS` (ex. `'jaune'`) en couleurs CSS valides pour le canvas.
- **`js/vagues.js`** — objet `Vagues` : décide combien d'ennemis apparaissent, de quel
  type et à quel rythme pour chaque vague, et détecte sa fin. État : `numeroVagueActuelle`,
  `enCours`, `ennemisRestantsAGenerer`, `intervalleCourant`,
  `tempsDepuisDerniereGeneration`, `multiplicateurPointsDeVie`, `credits` (accumulés en
  fin de vague ; récupérés et remis à zéro par `Jeu.boucle`, voir phase 1C ci-dessous).
  Depuis la phase 7G : `estVagueBoss`/`bossEnAttente` (voir « Vagues de boss (phase
  7G) » ci-dessous). Fonctions publiques : `demarrer(numero)` (compose une vague de
  boss plutôt que la vague normale tous les `Config.VAGUE_INTERVALLE_BOSS` paliers,
  phase 7G), `mettreAJour(dt, listeEnnemis)`
  (tire aussi, depuis la phase 6A, le `cheminIndex` de chaque ennemi généré via
  `Aleatoire.entier(0, Config.NOMBRE_CHEMINS - 1)` — toujours le générateur à graine,
  jamais `Math.random()`, pour que la répartition reste reproductible ; depuis la
  phase 7F, un tirage séparé décide d'abord si l'apparition est un drone, auquel cas
  ni type ni `cheminIndex` ne sont tirés — voir « Le triangle Flak/Caserne/Drone
  (phase 7F) » plus bas ; depuis la phase 7G, génère d'abord le boss en tête de file
  d'une vague de ce type, avant même ce tirage), `reinitialiser()`.
- **`js/tour.js`** — classes `Tour` et `Projectile` (phase 1C ; plusieurs types de
  tours depuis la phase 2A ; niveaux, amélioration et vente depuis la phase 2B ; dégâts
  de zone depuis la phase 7D ; type Caserne, sans tir, depuis la phase 7E).
  `Tour` : `colonne`, `ligne`, `x`, `y` (centre de case), `type` (clé de
  `Config.TYPES_TOURS`), `couleur`, `degatsBase`/`cadenceBase`/`porteeBase` (valeurs du
  type au niveau 1, jamais modifiées), `typeDegats` (`'unique'`, `'zone'` ou
  `'caserne'`, phase 7D, jamais recalculée), `niveau` (1 à `Config.NIVEAU_MAX_TOUR`),
  `investissementTotal` (achat + améliorations payées, base du remboursement à la
  vente), `degats`/`cadence`/`portee` (statistiques effectives courantes, recalculées
  par `recalculerStats()`), `tempsDepuisDernierTir`, `cible` — plus, pour une Caserne
  uniquement (phase 7E) : `cheminIndex`/`indexPointDePassage` (point de blocage,
  déterminé une fois à la construction via `Carte.trouverPointBlocagePourCaserne` et
  jamais recalculé ensuite), `unite` (référence à une `UniteCaserne`, ou `null`),
  `tempsDepuisDestruction`. Méthodes :
  `recalculerStats()` (voir « Niveaux, amélioration et vente » ci-dessous ; intègre
  aussi, depuis la phase 3B, le bonus permanent de dégâts du joueur via
  `Progression.multiplicateurDegats()`), `coutAmelioration()` (idem avec
  `Progression.multiplicateurCoutAmelioration()`, voir « Bonus permanents (phase 3B) »),
  `ameliorer()` (rafraîchit en plus les stats de l'unité d'une Caserne déjà vivante),
  `montantVente()`, `chercherCible(ennemis)` (conserve la cible en cours tant qu'elle
  reste valide et à portée, pour éviter que le canon tremble entre deux ennemis à
  progression égale ; sinon retient, parmi les ennemis à portée qu'elle a la capacité
  de viser — `Config.TYPES_TOURS[this.type].peutViserVolant`, phase 7F, ignore
  totalement un ennemi volant sinon — celui dont `ennemi.progression()` (ennemi.js,
  remplace depuis la phase 7F l'ancienne `Tour.progressionEnnemi`, qui ne savait lire
  qu'un `indexPointDePassage`) est la plus élevée),
  `mettreAJour(dt, ennemis, pool)` (bifurque entièrement vers `mettreAJourCaserne(dt)`
  pour ce type, phase 7E), `statsUniteAuNiveauActuel()`/`faireApparaitreUnite()` (phase
  7E, voir « Tour Caserne (phase 7E) » ci-dessous), `dessiner(ctx)` (formes distinctes
  par type et halo néon depuis la phase 4A — voir « Identité visuelle cyberpunk
  (phase 4A) » ci-dessous — plus, depuis la phase 4B, déclenchement du flash de tir et
  du son au moment où `tirer(pool)` active un projectile ; la Caserne ne dessine aucun
  canon, voir phase 7E).
  `Projectile` : `x`, `y`, `cible` (référence directe à un `Ennemi`), `degats`,
  `couleur` (celle de la tour tireuse, phase 4B, utilisée uniquement pour teinter la
  particule d'impact — le projectile reste dessiné en blanc), `typeDegats` (phase 7D,
  copié de la tour tireuse), `actif`. Méthodes :
  `activer(x, y, cible, degats, couleur, typeDegats)` (réinitialise une instance du
  pool au lieu d'en créer une nouvelle), `mettreAJour(dt, ennemisActifs)` (suit la
  position courante de la cible, se désactive sans dégâts si la cible est déjà morte ;
  à l'impact, inflige `degats` à la seule cible si `typeDegats === 'unique'` ou à tout
  ennemi vivant dans `Config.FLAK_RAYON_EXPLOSION` du point d'impact si `'zone'`
  (phase 7D, voir « Tour Flak (phase 7D) » ci-dessous) ; déclenche une particule
  d'impact ou une explosion de zone selon le cas — jamais utilisé par une Caserne, qui
  ne tire aucun projectile), `dessiner(ctx)`.
- **`js/unite.js`** — classe `UniteCaserne` (phase 7E, contenu additionnel
  post-lancement) : l'unité statique posée par une tour Caserne pour bloquer un
  chemin. Propriétés : `x`, `y` (position du point de blocage, fixée à l'apparition),
  `pointsDeVie`/`pointsDeVieMax`, `degats`, `cheminIndex`/`indexPointDePassage`
  (copiés de sa tour), `vivante`. Une seule méthode, `dessiner(ctx)` : son combat est
  résolu ailleurs, voir « Tour Caserne (phase 7E) » ci-dessous.
- **`js/progression.js`** — objet `Progression` (phase 3A ; bonus permanents par niveau
  depuis la phase 3B) : le seul état qui survit d'une partie à l'autre (niveau de
  joueur, XP, statistiques cumulées), persistant via `localStorage`, et le seul point
  du code qui consulte `Config.PALIERS_BONUS`. Voir « Progression du joueur
  (phase 3A) » et « Bonus permanents (phase 3B) » ci-dessous.
- **`js/particules.js`** — objet `Particules` (phase 4B) : petits effets visuels
  (flash de tir, impact, explosion), recyclés via un pool exactement comme les
  projectiles. Voir « Particules et son (phase 4B) » ci-dessous.
- **`js/son.js`** — objet `Son` (phase 4B) : tous les effets sonores, entièrement
  synthétisés via l'API Web Audio (`OscillatorNode`/`GainNode`), aucun fichier audio.
  Voir « Particules et son (phase 4B) » ci-dessous. `jouerAlerteBoss()` (phase 7G,
  voir « Vagues de boss (phase 7G) » ci-dessous) s'ajoute aux fonctions publiques
  existantes.
- **`js/decor.js`** — objet `Decor` (phase 7C, contenu additionnel post-lancement) :
  skyline en parallaxe à deux couches sur un second canvas (`#canvas-decor`),
  totalement indépendant du canvas de jeu. Voir « Décor d'arrière-plan en parallaxe
  (phase 7C) » ci-dessous. Gère aussi, depuis la phase 7C bis, le chargement et le
  repli d'une image de fond fixe affichée par-dessus ce skyline — voir « Image de fond
  fixe (phase 7C bis) » ci-dessous.
- **`js/interface.js`** — objet `Interface` (phase 1D) : tout ce qui concerne l'affichage
  et les interactions — écrans superposés, HUD, clics et survol sur le canvas, messages
  temporaires. Voir « Interface et états de partie » ci-dessous. `afficherMessageConstruction(texte, duree)`
  accepte, depuis la phase 7G, une durée optionnelle (1,5 s par défaut) — réutilisée par
  `Vagues.demarrer` pour son bandeau de vague de boss, voir « Vagues de boss (phase 7G) »
  ci-dessous.
- **`js/jeu.js`** — objet `Jeu` : point d'entrée, état de partie et boucle de simulation
  (l'affichage et les interactions vivent dans `interface.js`). État : `etatPartie`,
  `nombreDeVagues`, `idDureeActuelle`, `vitesseJeu`, `ennemisActifs`, `toursActives`,
  `poolProjectiles`, `integrite`, `credits`, `enPause`, `facteurEchelle` (voir « Mise à
  l'échelle des distances » ci-dessous), `limiteTours` (phase 6B, voir « Limite de
  tours (phase 6B) » ci-dessous), `derniereProgression` (résumé de la dernière
  partie terminée pour l'affichage, voir phase 3A). Fonctions publiques :
  `initialiser()`, `redimensionner()`, `initialiserPoolProjectiles()`, `dessinerTout()`,
  `boucle(horodatage)`, `simuler(dt)`, `resoudreCombatsCasernes(dt)` (phase 7E, voir
  « Tour Caserne (phase 7E) » ci-dessous), `verifierFinDePartie()`,
  `finaliserPartie(estVictoire)`, `demarrerPartie(idDuree)`, `rejouer()`,
  `retourAccueil()`, `reinitialiser(idDuree, graine)`.
- **`outils/serveur-statique.js`** — petit serveur HTTP Node sans dépendance, utilisé
  uniquement pour prévisualiser le jeu pendant le développement (référencé par
  `.claude/launch.json`, aussi bien à la racine du dossier `claude` qu'à la racine de
  `defense-neon` lui-même). Ne fait pas partie du jeu livré au joueur, qui reste un
  simple fichier `index.html` ouvrable directement. Complété en phase 5 avec les types
  MIME `.webmanifest` et `.png` (absents jusque-là, puisque rien de tel n'existait
  encore) : sans eux, certains navigateurs refusent de considérer l'app comme
  installable même si le manifeste et le service worker sont par ailleurs valides.
- **`manifest.webmanifest`** et **`sw.js`** (phase 5) — voir « Installation et
  fonctionnement hors ligne (phase 5) » ci-dessous.
- **`outils/generateur-icones.html`** — outil à usage unique (phase 5), non livré avec
  le jeu : dessine le badge d'icône de l'app sur deux `<canvas>` (192×192 et 512×512)
  et propose un lien de téléchargement pour chacun. Sert une seule fois à produire
  `icones/icone-192.png` et `icones/icone-512.png` — voir « Installation et
  fonctionnement hors ligne (phase 5) » ci-dessous pour le détail de cette étape
  manuelle.

## Algorithme de génération du chemin (`carte.js`)

Tracé du bord gauche au bord droit, direction jamais vers la gauche. À chaque case, une
direction (droite/haut/bas) est tirée au sort selon les poids de `Config`, en excluant
haut/bas au-delà de `MAX_DEPLACEMENTS_VERTICAUX` pas verticaux consécutifs. Une case
candidate est rejetée si elle est hors grille, hors de la bande `LIGNE_MIN`–`LIGNE_MAX`,
déjà utilisée, ou orthogonalement adjacente à une autre case du chemin (sauf la case
précédente) — cette dernière règle interdit les couloirs parallèles côte à côte tout en
autorisant les tracés en escalier. Échec de tracé ou chemin trop court → nouvelle
tentative (jusqu'à `MAX_TENTATIVES_GENERATION`) ; au-delà, chemin de secours en S.

## Système de vagues (`vagues.js`)

Pour la vague `n` : `5 + n * 2` ennemis à générer, multiplicateur de points de vie
`1 + (n - 1) * 0.15`, intervalle d'apparition `INTERVALLE_APPARITION_INITIAL *
(1 - REDUCTION_INTERVALLE_PAR_VAGUE)^(n - 1)` (réduction composée, plancher
`INTERVALLE_APPARITION_MIN`). Le type de chaque ennemi généré est tiré avec
`Aleatoire.nombre()` : proportion `PROPORTION_BLINDE` de Blindés à partir de la vague
`VAGUE_APPARITION_BLINDE`, proportion `PROPORTION_RAPIDE` de Rapides à partir de la vague
`VAGUE_APPARITION_RAPIDE`, le reste en Standard. Ces deux proportions s'additionnent
plutôt que de s'exclure (voir « Écart par rapport au prompt » ci-dessous).

Une vague est considérée terminée quand son compteur de génération est à zéro **et**
qu'aucun ennemi encore présent dans la liste des ennemis actifs n'est ni vivant ni en
attente d'arrivée — pas seulement quand le compteur de génération est épuisé, sans quoi
la vague se terminerait avant que le dernier ennemi ait fini son trajet.

## Mise à l'échelle des distances (`Jeu.facteurEchelle`)

Toutes les valeurs de vitesse et de distance de `Config` (vitesse des ennemis, portée des
tours, vitesse des projectiles) sont calibrées pour une case de 40 px
(`Config.LARGEUR_REFERENCE / Config.COLONNES`). Le canvas se redimensionne selon la
largeur de l'écran, donc la taille réelle d'une case varie d'un appareil à l'autre. Pour
que le jeu se comporte de façon identique quelle que soit cette taille,
`Jeu.redimensionner()` recalcule à chaque redimensionnement
`Jeu.facteurEchelle = Carte.tailleCase / 40`, et ce facteur est appliqué à chaque valeur
de `Config` concernée **au moment de son utilisation** (jamais au moment de sa lecture
initiale, puisqu'il change à chaque redimensionnement) : dans `Ennemi.deplacer(dt)`,
`Tour.chercherCible` et `Projectile.mettreAJour(dt)`.

Ce correctif a été appliqué avant le reste de la phase 1C (voir « Écart par rapport au
prompt » ci-dessous) : il n'a nécessité aucun ajustement des valeurs de vitesse posées en
phase 1B, seulement l'ajout de la multiplication par `facteurEchelle` à leur point
d'usage.

## Interface et états de partie (`interface.js`, `jeu.js`)

`Jeu.etatPartie` vaut `'accueil'`, `'enCours'`, `'victoire'` ou `'defaite'`. Cette seule
variable détermine à la fois quel écran est visible (`Interface.mettreAJourEcrans`, rappelée
chaque frame par `Jeu.boucle`, bascule l'attribut `hidden` des trois écrans superposés et
du HUD) et si la boucle simule la partie (`Jeu.boucle` n'appelle `Jeu.simuler(dt)` que
pendant `'enCours'`, hors pause).

Transitions : `Interface` déclenche les changements d'état en appelant les méthodes de
`Jeu` (`demarrerPartie(idDuree)` depuis le bouton Jouer de l'accueil, `rejouer()` et
`retourAccueil()` depuis les écrans de fin) ; `Jeu.verifierFinDePartie()` (appelée en fin de
`simuler`) déclenche lui-même les deux autres transitions : passage à `'defaite'` dès que
`integrite` atteint 0 (immédiatement — la boucle cesse de simuler dès la frame suivante,
sans attendre que les ennemis déjà en piste terminent leur trajet), et passage à
`'victoire'` quand la dernière vague est nettoyée, uniquement si `Jeu.nombreDeVagues` est
fini (`Number.isFinite`) — en mode Sans fin (`Infinity`), seule la défaite peut terminer la
partie. `Jeu.reinitialiser(idDuree, graine)` remet à zéro tout l'état d'une partie (crédits,
intégrité, ennemis, tours, projectiles du pool désactivés — jamais recréés, voir plus bas)
et fixe `Jeu.nombreDeVagues` d'après `idDuree` (`Config.DUREES_PARTIE`) ; `rejouer()`
l'appelle avec la même durée et aucune graine (donc une carte différente), `demarrerPartie`
avec la durée choisie à l'accueil.

`Interface` possède `idDureeSelectionnee`, retenue pour la session (variable JS simple, pas
de persistance après rechargement) et affichée par un liseré + fond distincts (pas
seulement une teinte, pour rester lisible aux personnes daltoniennes) sur le bouton de
durée correspondant.

## Boucle de jeu (`jeu.js`)

`requestAnimationFrame` classique, qui tourne en continu quel que soit `etatPartie` (pour
rester réactive à un redimensionnement et garder les écrans superposés à jour) : `dt` est
calculé à partir de l'horodatage fourni par le navigateur puis plafonné à
`Config.DT_MAXIMUM` **avant tout autre traitement**, pour qu'un onglet resté longtemps en
arrière-plan (le navigateur suspend l'exécution pendant ce temps) ne fasse pas traverser
toute la carte aux ennemis d'un coup au réveil. Un écouteur sur `visibilitychange` met le
jeu en pause automatiquement en arrière-plan ; le bouton unique Pause/Reprendre du HUD agit
sur la même variable `Jeu.enPause`, sans logique séparée.

Le multiplicateur `Jeu.vitesseJeu` (1 ou 2, bouton Vitesse du HUD) n'est appliqué qu'**après**
ce plafonnement, et seulement au `dt` transmis à `Jeu.simuler` — jamais à celui transmis à
`Interface.mettreAJourEcrans` (temps réel, pour que le minuteur du message de construction
ne soit pas accéléré par la vitesse ×2). Appliquer la vitesse avant le plafonnement ferait
qu'un bond de `dt` après un changement d'onglet serait doublé en mode ×2.

`Jeu.simuler(dt)`, appelée uniquement pendant `'enCours'` et hors pause, dans l'ordre :
déplacement des ennemis, mise à jour des tours (ciblage, décompte de cadence, activation de
projectiles du pool), mise à jour des projectiles actifs, un seul passage à l'envers sur
`ennemisActifs` qui retire à la fois les ennemis arrivés (dégât d'intégrité, aucun crédit)
et les ennemis morts (crédit de leur récompense) — un parcours classique du début vers la
fin sauterait un élément sur deux à chaque suppression —, puis `Vagues.mettreAJour` et
récupération du bonus de fin de vague (`Vagues.credits`, remis à zéro après ajout à
`Jeu.credits`), et enfin `Jeu.verifierFinDePartie()`.

## Construction de tours, sélection d'une tour existante et pool de projectiles (`interface.js`, `tour.js`)

Un `pointerdown` sur le canvas (`Interface.gererClicCanvas`) convertit la position du clic
en case (`Carte.pixelsVersCase`, après remise à l'échelle des coordonnées CSS vers la
résolution réelle du canvas) puis distingue trois cas selon l'état de la case dans
`Carte.grille` :
- **`'OCCUPEE'`** (une tour y est déjà construite) : la tour correspondante est
  recherchée dans `Jeu.toursActives` par comparaison sur `colonne`/`ligne` et affectée à
  `Interface.tourSelectionnee`, ce qui ouvre le panneau d'amélioration/vente (voir
  « Niveaux, amélioration et vente » ci-dessous) ;
- **`'LIBRE'`** : comportement inchangé depuis la phase 2A, `Interface.tenterConstruireTour`
  est appelée (voir plus bas) et `tourSelectionnee` repasse à `null` (ferme un panneau
  resté ouvert) ;
- **`'CHEMIN'`** : `tourSelectionnee` repasse simplement à `null`, sans autre effet.

Un clic n'importe où en dehors du canvas ferme aussi le panneau s'il était ouvert : un
écouteur `pointerdown` posé sur `document` (dans `Interface.initialiser`) met
`tourSelectionnee` à `null` dès que la cible de l'événement n'est ni le canvas
(déjà géré par `gererClicCanvas`) ni un élément du panneau lui-même (dont les boutons
Améliorer/Vendre gèrent leur propre effet).

`Interface.tenterConstruireTour` : case non constructible ou crédits insuffisants **pour
le type actuellement sélectionné** (`Interface.typeSelectionne`, voir « Types de tours et
sélection » ci-dessous) affichent un message temporaire de 1,5 s superposé au HUD
(`#message-construction`) sans rien construire ; sinon une `Tour` de ce type est ajoutée à
`Jeu.toursActives`, la case passe à `'OCCUPEE'` dans `Carte.grille` et le coût du type est
déduit de `Jeu.credits`. Un tap construit directement sur tactile, sans aperçu — exactement
comme en phase 1C.

Sur les appareils à souris (`pointermove` filtré sur `event.pointerType === 'mouse'`),
`Interface.caseSurvolee` suit la case sous le pointeur (`null` hors du canvas ou hors
`'enCours'`) ; `Jeu.dessinerTout()` appelle `Interface.dessinerApercuConstruction(ctx)`
après tous les autres éléments pour dessiner, sous cette case, un contour vert (case
constructible et crédits suffisants pour le type sélectionné) ou rouge, plus un cercle
semi-transparent de rayon `Config.TYPES_TOURS[Interface.typeSelectionne].portee *
Jeu.facteurEchelle` représentant la portée de ce type avant construction. Ce cercle est
redessiné à chaque frame (comme tout `dessinerTout()`), donc un changement de type en
cours de survol se répercute sur le cercle sans attendre un nouveau déplacement de la
souris.

## Types de tours et sélection (phase 2A)

Trois types de tours, définis dans `Config.TYPES_TOURS` (`mitrailleuse`, `canon`,
`sniper`) : chacun a son propre `nom`, `portee`, `degats`, `cadence`, `cout` et `couleur`
(tous à l'échelle de référence, comme les autres valeurs de `Config`, voir « Mise à
l'échelle des distances »). `Config.TYPE_TOUR_PAR_DEFAUT` (`'mitrailleuse'`) est la
sélection initiale. Équilibrage voulu : la Mitrailleuse a le meilleur ratio dégâts/seconde
par crédit, le Canon un ratio intermédiaire, le Sniper le plus faible des trois sur ce seul
critère — sa valeur vient de sa portée très supérieure (200 contre 100/120), qui lui permet
de commencer à tirer sur un ennemi bien avant les deux autres types sur un même chemin.

`Interface.typeSelectionne` retient le type à construire, remis à
`Config.TYPE_TOUR_PAR_DEFAUT` à chaque nouvelle partie (`Jeu.reinitialiser`, pas seulement
au chargement de la page). Une barre dédiée (`#barre-types-tours`), visible en même temps
que le HUD (même bascule `hidden` sur `etatPartie !== 'enCours'`), contient un bouton par
type, généré dynamiquement par `Interface.initialiser()` à partir de `Config.TYPES_TOURS`
(même principe que les boutons de durée à l'accueil, pour ne jamais avoir deux sources de
vérité) et affichant son nom et son coût. `Interface.selectionnerTypeTour(type)` change la
sélection ; `Interface.mettreAJourBoutonsTypesTours()` (rappelée à la fois immédiatement
après un clic et à chaque frame par `mettreAJourEcrans`, puisque les crédits changent en
continu pendant la partie) met en évidence le bouton actif par un fond ET un liseré
distincts — jamais une teinte seule, voir la note sur `.choix-duree` — et grise (`disabled`)
tout bouton dont le coût dépasse les crédits actuels, indépendamment des deux autres types.

`Tour` reçoit ce type en troisième paramètre de son constructeur et y lit ses
caractéristiques ; elle conserve `this.type` (utile en phase 2B pour calculer le coût d'une
amélioration ou le remboursement à la vente) et se dessine avec la couleur du type au socle
plus la première lettre du type (M, C ou S) en son centre — un repère de lecture temporaire,
remplacé en phase 4 par des formes distinctes.

## Niveaux, amélioration et vente (phase 2B)

Chaque `Tour` a un `niveau` (1 à `Config.NIVEAU_MAX_TOUR`, soit 7 — voir la note
d'équilibrage dans `config.js`, ajustée après mesure via
`outils/simulation-equilibrage.js`) et un `investissementTotal` (coût d'achat initial +
toutes les améliorations payées, base du remboursement à la vente). `recalculerStats()`
calcule à chaque fois `degats`/`cadence`/`portee` à partir des valeurs de base figées
(`degatsBase`/`cadenceBase`/`porteeBase`, jamais réassignées) et du niveau courant :
`base * Config.AMELIORATION_MULTIPLICATEUR_X ^ (niveau - 1)`. Repartir systématiquement
des valeurs de base plutôt que de multiplier la valeur courante à chaque palier n'a pas
d'effet observable avec un nombre de niveaux aussi restreint, mais évite qu'une erreur
d'arrondi ne s'accumule si `NIVEAU_MAX_TOUR` augmente encore. `recalculerStats()` est
appelée à la construction et après chaque amélioration.

`coutAmelioration()` renvoie `null` au niveau maximum, sinon
`Math.round(Config.TYPES_TOURS[type].cout * niveau * Config.AMELIORATION_COUT_FACTEUR)` :
le coût dépend du niveau actuel, donc chaque palier coûte plus cher que le précédent.
`ameliorer()` ajoute ce coût à `investissementTotal`, incrémente `niveau` et appelle
`recalculerStats()`, mais ne déduit elle-même aucun crédit — c'est
`Interface.ameliorerTourSelectionnee()` qui vérifie `Jeu.credits` et les déduit avant
d'appeler `ameliorer()`. `montantVente()` renvoie
`Math.round(investissementTotal * Config.VENTE_POURCENTAGE_REMBOURSEMENT)`.

Le panneau d'amélioration/vente (`#panneau-amelioration`) est positionné en absolu dans un
coin fixe de `.conteneur-canvas` plutôt que de suivre la tour cliquée sur le plateau —
plus simple, et tout aussi lisible puisqu'une seule tour peut être sélectionnée à la fois.
Sa visibilité suit `Interface.tourSelectionnee` (`null` = fermé) et son contenu est
rafraîchi à chaque frame par `Interface.mettreAJourPanneauAmelioration()` (même principe
que `mettreAJourBoutonsTypesTours` : les crédits changent en continu, donc le bouton
Améliorer doit se griser dès qu'ils deviennent insuffisants, et ses statistiques doivent
refléter immédiatement une amélioration). Le bouton Améliorer est remplacé par le texte
« Niveau maximum atteint » dès que `coutAmelioration()` renvoie `null`.
`Interface.vendreTourSelectionnee()` crédite `montantVente()`, retire la tour de
`Jeu.toursActives`, remet sa case à `'LIBRE'` dans `Carte.grille` et ferme le panneau ; une
tour reconstruite ensuite au même endroit repart normalement au niveau 1 (nouvelle
instance de `Tour`, aucun état résiduel).

`Interface.tourSelectionnee` est remise à `null` à chaque nouvelle partie (`Jeu.reinitialiser`,
comme `typeSelectionne`) : sans ça, une tour de la partie précédente pourrait rester
référencée après la remise à zéro de `Jeu.toursActives`.

Les projectiles ne sont jamais créés avec `new` en cours de partie, ni même entre deux
parties : `Jeu.initialiser()` appelle `Jeu.initialiserPoolProjectiles()` **une seule fois**
pour toute la durée de vie de la page, qui prépare un tableau de
`Config.TAILLE_POOL_PROJECTILES` instances de `Projectile`. `Jeu.reinitialiser` se contente
de repasser `actif` à `false` sur chacune d'elles plutôt que de recréer le tableau.
`Tour.tirer` cherche le premier projectile inactif du pool (`activer`) plutôt que d'en
instancier un nouveau ; si tous sont actifs, le tir est simplement ignoré pour cette frame.
Ceci évite de solliciter le ramasse-miettes du navigateur pendant la partie (source de
saccades, particulièrement sur mobile).

## Progression du joueur (phase 3A)

`Progression` (dans `progression.js`) est le seul état du jeu qui **survit** d'une partie
à l'autre : `niveau`, `xpActuelle` (XP accumulée depuis le dernier passage de niveau),
`xpTotale` (cumulée depuis toujours), `partiesJouees`, `meilleureVagueSansFin`.
Contrairement à `Jeu.credits`/`integrite`/etc., `Jeu.reinitialiser()` ne le touche jamais.
`Progression.charger()` est appelée une seule fois, tout au début de `Jeu.initialiser()`
(pas à chaque partie) : elle lit `Config.CLE_SAUVEGARDE` dans `localStorage`, ou conserve
les valeurs par défaut (niveau 1, tout à zéro) si la clé n'existe pas encore. Cette lecture,
comme l'écriture dans `Progression.sauvegarder()`, est entourée d'un `try/catch` :
certains navigateurs (navigation privée stricte) font lever une exception au seul accès à
`localStorage`, ce qui ne doit jamais empêcher le jeu de démarrer — `avertirEchecStockage()`
n'affiche qu'un seul `console.warn` par session dans ce cas (pas un par tentative
d'écriture, sans quoi une session entière en navigation privée avertirait à chaque fin de
partie), et le jeu continue avec la progression en mémoire pour cette session, simplement
non persistée.

`Progression.seuilNiveauSuivant()` calcule `Config.XP_SEUIL_NIVEAU_1 *
Config.CROISSANCE_XP_NIVEAU ^ (niveau - 1)`, ou renvoie `null` au niveau maximum
(`Config.NIVEAU_MAX_JOUEUR`) : au-delà, `ajouterXp(montant)` continue d'accumuler dans
`xpTotale` mais ne fait plus jamais progresser `niveau`. `ajouterXp` boucle tant que le
seuil courant est dépassé (pas un seul `if`) : une partie assez généreuse en XP peut faire
gagner plusieurs niveaux d'un coup en un seul appel, et renvoie le nombre de niveaux gagnés
pour que l'appelant sache s'il doit afficher une notification.

`Jeu.finaliserPartie(estVictoire)`, appelée une seule fois par partie depuis
`Jeu.verifierFinDePartie()` (exactement au moment de la transition vers `'victoire'` ou
`'defaite'` — `simuler()`, et donc `verifierFinDePartie()` elle-même, ne sera plus rappelée
tant que `etatPartie` ne repasse pas à `'enCours'`), calcule l'XP gagnée : pour chaque vague
**effectivement terminée** (tous ses ennemis morts ou arrivés, même critère que
`Vagues.mettreAJour` pour `Vagues.enCours`), `Config.XP_BASE_PAR_VAGUE + numéro de la
vague * Config.XP_BONUS_PAR_NUMERO_VAGUE`, plus `Config.XP_BONUS_VICTOIRE` en cas de
victoire. Une défaite survenue en pleine vague `n` (celle-ci encore `enCours`, ou des
ennemis encore actifs) ne récompense que les `n - 1` vagues précédentes, pas la vague
interrompue — à la différence d'une victoire, où la dernière vague est par définition
toujours entièrement terminée. `finaliserPartie` incrémente aussi
`Progression.partiesJouees`, met à jour `Progression.meilleureVagueSansFin` en mode Sans
fin si dépassée, puis appelle `Progression.sauvegarder()` — **le seul moment** où
`Progression` écrit dans `localStorage` pendant que le jeu tourne, jamais à chaque frame ni
à chaque vague, pour ne pas payer le coût d'une écriture disque plus souvent que
nécessaire. Le résultat (XP gagnée, niveau avant/après, niveaux gagnés) est conservé dans
`Jeu.derniereProgression`, lu par `Interface` pour l'écran de victoire ou de défaite.

Côté affichage (`interface.js`) : l'écran d'accueil affiche le niveau et une barre
`xpActuelle / seuilNiveauSuivant()` (`Interface.mettreAJourProgressionAccueil()`,
rafraîchie chaque frame comme le reste de l'accueil), remplacée par un texte « Niveau
maximum atteint » quand `seuilNiveauSuivant()` renvoie `null` (une barre à 100 % ou vide y
aurait été ambiguë). Les écrans de victoire et de défaite affichent l'XP gagnée et, si
`niveauxGagnes > 0`, une mention « Niveau supérieur ! X → Y » mise en évidence par une
couleur dédiée (`Interface.afficherResumeProgression()`, partagée par les deux écrans).

## Bonus permanents (phase 3B)

`Config.PALIERS_BONUS` liste cinq paliers indépendants (`{ niveauRequis, id, description,
valeur }`), chacun actif dès que `Progression.niveau` atteint son `niveauRequis` — jamais
perdu ensuite, puisque `niveau` ne fait que progresser (voir `ajouterXp` ci-dessus). Un
joueur de niveau 12 bénéficie ainsi simultanément des quatre premiers paliers (3, 6, 9 et
12), pas seulement du dernier atteint. `Progression` est le **seul** endroit du code qui
lit ce tableau directement : `palier(id)`, `estDebloque(id)`, `bonusCreditsDepart()`,
`bonusIntegriteDepart()`, `multiplicateurCoutConstruction()`,
`multiplicateurCoutAmelioration()`, `multiplicateurDegats()` et `listePaliers()` (pour
l'affichage) en sont les seules portes d'entrée — `jeu.js`, `interface.js` et `tour.js`
appellent ces fonctions plutôt que de consulter `Config.PALIERS_BONUS` eux-mêmes, pour
qu'un futur ajout ou changement de palier ne nécessite de toucher que `progression.js`.

Points d'application : `Jeu.reinitialiser()` ajoute `bonusCreditsDepart()` et
`bonusIntegriteDepart()` aux valeurs de base de `Config` (crédits et intégrité de
départ, quelle que soit la durée choisie) ; `Interface.coutConstruction(type)` — désormais
le point unique lu par `tenterConstruireTour`, `dessinerApercuConstruction` et
`mettreAJourBoutonsTypesTours`, dont le texte affiché reflète donc toujours le coût réel —
multiplie le coût de base par `multiplicateurCoutConstruction()` ; `Tour.coutAmelioration()`
fait de même avec `multiplicateurCoutAmelioration()` ; `Tour.recalculerStats()` multiplie
`degats` par `multiplicateurDegats()`, en plus du multiplicateur de niveau de la tour (les
deux se cumulent).

Côté affichage, une liste (`#liste-paliers-bonus`) apparaît sous la barre d'XP de l'écran
d'accueil : ses cinq `<li>` sont créés une seule fois par `Interface.initialiser()` à partir
de `Progression.listePaliers()`, puis seuls leur classe (`palier-debloque` /
`palier-verrouille`) et leur texte sont rafraîchis à chaque frame par
`mettreAJourProgressionAccueil()` — un palier débloqué affiche sa description précédée
d'un ✓, un palier verrouillé l'affiche grisée précédée d'un 🔒 et suivie du niveau requis ;
la distinction ne repose jamais sur la seule couleur.

Resté volontairement sans effet visuel ou sonore dédié au déblocage d'un palier (ni au
passage de niveau en général) : la phase 4B (particules et son) ne branche que les
points de déclenchement listés dans sa propre section ci-dessous, et un effet à
l'accueil n'en faisait pas partie. Hors périmètre au-delà de ces cinq paliers : n'en
ajoute pas d'autre sans repasser par une réflexion d'équilibrage dédiée (voir
`outils/simulation-equilibrage.js`).

**Équilibrage en attente :** les valeurs d'équilibrage actuelles (bonus de niveau, paliers
d'amélioration) ont été mesurées avec le script `outils/simulation-equilibrage.js` sur des
cartes sans limite de tours constructibles. Une idée à l'étude consiste à limiter le nombre
de tours qu'un joueur peut poser sur une carte — si elle est implémentée un jour, elle
changera significativement l'économie de la partie (moins de tours possibles pousse à
investir davantage dans l'amélioration de chacune). Il faudra alors rejouer les scripts
d'équilibrage existants plutôt que de faire confiance aux valeurs actuelles telles quelles.
Aucune limite de ce type n'est implémentée ni prévue dans les phases en cours ; ceci est
uniquement une note pour une future session d'équilibrage.

## Identité visuelle cyberpunk (phase 4A)

Palette (`Config.COULEURS`) reprise en tons bleu-nuit très sombres (fond, cases libres,
liseré, case de chemin) pour que les seuls points lumineux de la scène soient les
éléments qui comptent pour le joueur : départ et arrivée (halo néon vert/rose, voir
`Carte.dessiner`), tours et, à l'origine, ennemis (halo néon de la couleur du type, voir
`Tour.dessiner`). Ces halos utilisent `ctx.shadowBlur`, toujours reposé à 0 immédiatement
après l'élément concerné pour ne jamais déteindre sur le reste de la scène dessinée
ensuite dans la même frame (voir `Config.HALO_FLOU_TOUR_BASE`, `HALO_FLOU_POINT_CHEMIN`).
Volontairement absent de la grille elle-même (240 cases dessinées chaque frame) et des
particules/projectiles (phase 4B, potentiellement nombreux) : le coût de rendu par appel
de `shadowBlur` n'en vaudrait pas le gain visuel à cette échelle — seuls les éléments peu
nombreux par frame *et* dessinés en une seule forme en portent un. **Les ennemis en
faisaient partie ici, en 4A** (un simple cercle, donc un seul appel de `shadowBlur` par
ennemi) — ils l'ont perdu depuis, quand leurs silhouettes de robot (phase 7A, plusieurs
formes par ennemi) l'ont rendu proportionnellement plus coûteux ; voir « Silhouettes
robotiques (phase 7A) » plus bas.

Trois formes de socle distinctes remplacent la lettre M/C/S posée en phase 2A
(`Tour.dessinerSoclePolygone`, `dessinerCanon`) :
- **Mitrailleuse** : losange (carré à 45°), deux canons fins jumelés — évoque la
  cadence de tir élevée ;
- **Canon** : octogone massif, un seul canon épais — évoque la puissance de feu brute ;
- **Sniper** : triangle effilé, un canon long et fin — évoque la portée très supérieure.

Le halo d'une tour s'intensifie légèrement à chaque amélioration
(`Config.HALO_FLOU_TOUR_PAR_NIVEAU`), pour que son niveau se lise aussi d'un coup d'œil
sans ouvrir le panneau d'amélioration — seul effet dépendant du niveau demandé par la
feuille de route à ce stade, les canons eux-mêmes ne changeant pas de taille avec le
niveau. Côté CSS, quelques touches de lueur (text-shadow sur les titres, box-shadow sur
les boutons/panneaux actifs ou sélectionnés) complètent l'habillage sans jamais remplacer
les distinctions déjà en place (fond + liseré, jamais la couleur seule).

**Écart par rapport au prompt (4A) :** cette phase avait été annoncée comme déjà acquise
dans le prompt de la phase 4B (« l'identité visuelle cyberpunk est en place »), mais ni
le code ni ce document ne la reflétaient encore — `Config.COULEURS` restait la palette
sobre de la phase 1A et `Tour.dessiner` dessinait toujours un simple carré avec une
lettre. Implémentée ici, avant les particules et le son, pour que la phase 4 se ferme
réellement entière comme demandé plutôt que de construire les effets sonores/visuels de
la 4B sur une identité visuelle qui n'existait pas.

## Particules et son (phase 4B)

### Particules (`particules.js`)

Pool de `Config.PARTICULES_TAILLE_POOL` particules préparées une seule fois au démarrage
de la page (`Particules.initialiser()`, appelée par `Jeu.initialiser()` comme
`Jeu.initialiserPoolProjectiles()`), jamais recréées en cours de partie — même principe
de recyclage que les projectiles depuis la phase 1C. `Jeu.reinitialiser()` désactive les
particules encore actives d'une partie précédente sans jamais reconstruire le tableau.

Trois fonctions de création, toutes en piochant la première particule inactive du pool
(la demande est simplement ignorée si le pool est déjà entièrement occupé) :
`creerExplosion` (mort d'un ennemi, direction uniforme sur 360°), `creerImpact` (tir qui
touche sans achever sa cible, même principe en plus petit nombre et plus courte durée de
vie) et `creerTir` (flash de départ, particules projetées uniquement vers la cible avec
une légère dispersion). `mettreAJour(dt)` déplace chaque particule active et désactive
celles dont la durée de vie restante atteint zéro ; `dessiner(ctx)` les affiche en
cercles pleins, alpha et taille réduits au prorata de la durée de vie restante
(`ctx.globalAlpha` toujours remis à 1 après coup, sous peine d'estomper tout ce qui est
dessiné ensuite dans la même frame). Jamais de halo (`shadowBlur`) sur les particules :
voir la note sur le coût de rendu dans la section 4A ci-dessus.

Les tirages aléatoires (angle, vitesse) utilisés ici passent par `Math.random()` et non
par `Aleatoire` : ce générateur à graine est réservé aux tirages qui affectent la
reproductibilité d'une partie (tracé de la carte, type des ennemis générés par
`Vagues`), et consommer des tirages supplémentaires depuis `Particules` — dont le nombre
d'appels dépend du déroulé de la partie (nombre de tirs, de kills) — décalerait la
séquence de tirages de `Vagues` pour le reste de la partie, rompant la reproductibilité
d'une carte à graine fixée.

Points de déclenchement : mort d'un ennemi et tir non létal touchant sa cible
(`Jeu.simuler`, dans la boucle de nettoyage des ennemis, et `Projectile.mettreAJour`
respectivement) ; départ d'un tir (`Tour.tirer`, à la position du canon — approximée par
un décalage fixe depuis le centre de la tour le long de l'angle de tir, plutôt que de
dupliquer la géométrie exacte de chaque forme de socle pour un effet purement cosmétique).

### Son (`son.js`)

Tous les effets sonores sont synthétisés via l'API Web Audio (`OscillatorNode` +
`GainNode`), sans aucun fichier audio, comme convenu depuis le début du projet.
`Son.initialiser()` crée l'`AudioContext` à la demande, une seule fois, au premier clic
sur le bouton Jouer (`Interface`, avant `Jeu.demarrerPartie`) — jamais au chargement du
script : les navigateurs bloquent toute lecture audio tant qu'aucune interaction
utilisateur n'a eu lieu sur la page. Tous les événements qui déclenchent un son ne
peuvent survenir que pendant ou après une partie, donc toujours après ce premier clic :
aucune fonction `jouerXxx` n'a besoin de vérifier que le contexte existe déjà.

`Son.actif` (persisté dans `localStorage` sous `Config.CLE_SAUVEGARDE_SON`, avec la même
protection `try/catch` que `Progression` face à un stockage indisponible) est chargé tôt
par `Son.chargerPreference()`, dès `Jeu.initialiser()` — avant même la création de
l'`AudioContext` — pour que le bouton Son du HUD affiche le bon libellé dès la première
image. Chaque fonction `jouerXxx` vérifie `Son.actif` en tout premier, avant de créer le
moindre nœud audio.

Huit effets, chacun avec sa propre combinaison fréquence/forme d'onde/durée pour rester
distinguable des autres (voir le détail dans les commentaires de `son.js`) :
`jouerTir(type)` (varie par type de tour), `jouerMort(type)` (glissando descendant,
varie par type d'ennemi), `jouerAlerte()` (deux pulsations graves, nettement plus longue
et plus grave que tout autre son — signal d'alerte à l'arrivée d'un ennemi),
`jouerConstruction()`, `jouerAmelioration()` (deux notes, la seconde plus aiguë),
`jouerVente()`, `jouerVictoire()` (arpège de 4 notes montantes) et `jouerDefaite()`
(glissando grave, le plus long de tous). Tous appliquent `Config.SON_VOLUME_MAITRE`
(0,3, jamais 1,0) sur le gain via une enveloppe attaque/décroissance exponentielle
partagée (`Son.jouerTonalite`), pour un volume modéré et cohérent d'un effet à l'autre.

Points de déclenchement : tir et mort partagent ceux des particules ci-dessus ; arrivée
d'un ennemi (`Jeu.simuler`) ; construction, amélioration et vente d'une tour
(`Interface.tenterConstruireTour`/`ameliorerTourSelectionnee`/`vendreTourSelectionnee`).
Victoire et défaite sont jouées exactement au moment de la transition d'état, dans
`Jeu.verifierFinDePartie()` — le seul endroit qui pose `etatPartie` à `'victoire'` ou
`'defaite'`, jamais rappelé tant que l'état ne repasse pas à `'enCours'` (même garantie
déjà exploitée par `finaliserPartie` depuis la phase 3A) — donc jamais rejouées en boucle
tant que l'écran de fin reste affiché.

**Écart par rapport au prompt (bouton Son) :** demandé « dans le HUD », mais le HUD
(`#barre-hud`) est masqué en dehors de `etatPartie === 'enCours'`
(`Interface.mettreAJourEcrans`), alors que le prompt exige que ce bouton reste « visible
à tout moment ». Placé en conséquence comme élément persistant hors de `#barre-hud`
(juste sous le titre, dans `index.html`), sans bascule `hidden` liée à l'état de partie —
seul son libellé change, via `Interface.mettreAJourBoutonSon()`.

## Installation et fonctionnement hors ligne (phase 5)

### Contrainte conciliée avec `file://`

Les service workers exigent une origine `http(s)` (ou `http://localhost`) : ils ne
s'activent jamais sous `file://`, quel que soit le navigateur. Ce n'est pas un défaut à
corriger mais une limite du standard, acceptée comme telle depuis la phase 1A (le jeu
doit continuer à fonctionner en ouvrant `index.html` directement depuis le disque). Sous
`file://`, le jeu tourne donc exactement comme avant cette phase, simplement sans
installation possible ni mise en cache explicite — ce qui ne prive le joueur de rien de
réellement utile, puisqu'un fichier déjà sur son disque n'a pas besoin d'être mis en
cache. Le service worker n'apporte de valeur qu'une fois le jeu servi par Netlify, ou
testé localement via `outils/serveur-statique.js` (`http://localhost`).

### Icônes (`outils/generateur-icones.html`, `icones/`)

Une PWA installable a besoin de vraies icônes `.png`. Plutôt que d'introduire une
dépendance de build pour les générer, `outils/generateur-icones.html` les dessine à la
main sur deux `<canvas>` (fond `#0b0b14` de `Config.COULEURS.fond`, losange néon vert
`#39ff88` — rappel du socle de la tour Mitrailleuse — et point rose `#ff2d6b`, la
couleur de la case arrivée) et propose un lien de téléchargement PNG pour chacun.
Volontairement sans `ctx.shadowBlur` (à la différence du reste de l'identité visuelle du
jeu, voir phase 4A) : un halo flouté alourdit inutilement le PNG exporté sans gain de
lisibilité à la taille d'une icône d'application.

**Étape manuelle (la seule de cette phase qui n'est pas automatisée) :** ouvrir
`outils/generateur-icones.html` dans un navigateur, télécharger les deux images via les
liens sous chaque canvas, puis les placer à la racine du projet sous
`icones/icone-192.png` et `icones/icone-512.png`. Cette étape a été effectuée pour cette
session : le bac à sable du navigateur intégré utilisé pour développer ce projet ne
permet ni requête réseau sortante (empêchant un transfert programmatique des octets du
canvas) ni copie fiable d'une chaîne base64 de plusieurs milliers de caractères par ce
canal — une première tentative de copie a d'ailleurs produit un PNG au CRC invalide,
détecté et rejeté avant d'être livré. Les deux fichiers présents dans `icones/` ont donc
été produits par un script Node ponctuel (utilisant uniquement `zlib`, déjà dans le
coeur de Node, aucune dépendance ajoutée) reproduisant à l'identique le dessin de
`outils/generateur-icones.html`, uniquement pour obtenir un résultat fiable dans cet
environnement — l'outil HTML lui-même reste la voie normale si ces icônes doivent être
regénérées ou redessinées un jour.

### Manifeste (`manifest.webmanifest`)

Chemins toujours relatifs (`./...`, jamais `/...`) : un chemin absolu casserait aussi
bien la compatibilité `file://` qu'un déploiement dans un sous-dossier. `background_color`
et `theme_color` reprennent `Config.COULEURS.fond` (`#0b0b14`, palette posée en phase
4A) — à garder synchronisé si cette valeur change un jour. Les balises `apple-*`
ajoutées dans `<head>` (`index.html`) couvrent l'ajout à l'écran d'accueil sur iOS, qui
ne suit pas totalement le standard du manifeste.

### Service worker (`sw.js`)

`CACHE_NOM` (`'defense-neon-v1'`) sert à la fois de clé de cache et de numéro de
version — à incrémenter à chaque mise à jour déployée. `FICHIERS_A_METTRE_EN_CACHE`
liste tous les fichiers du jeu, dressée à partir de l'ordre de chargement des scripts
dans `index.html` (voir en tête de ce document) plus le manifeste et les deux icônes.

À `install` : `cache.addAll(...)` puis `self.skipWaiting()` (la nouvelle version prend
effet sans attendre la fermeture de tous les onglets). À `activate` : suppression de
tout cache dont le nom diffère de `CACHE_NOM` (anciennes versions), puis
`self.clients.claim()` — sans cet appel, un onglet déjà ouvert au moment du déploiement
resterait contrôlé par l'ancien service worker (et donc l'ancien cache) jusqu'à sa
fermeture complète ; `skipWaiting()` seul active le nouveau worker en arrière-plan mais
ne lui donne pas le contrôle des pages déjà ouvertes. À `fetch` : stratégie cache-first
(réponse depuis le cache si présente, sinon requête réseau normale) — la plus simple et
la plus adaptée ici, puisque le jeu ne dépend d'aucune donnée dynamique ni d'API
externe.

### Enregistrement (`jeu.js`)

`navigator.serviceWorker.register('./sw.js')` est appelé en toute fin de `jeu.js`
(après l'écouteur `DOMContentLoaded` existant), avec un `.catch` qui se contente d'un
`console.warn` — jamais une erreur bloquante. Sous `file://`, cet appel échoue
systématiquement (voir plus haut) : c'est attendu, pas une erreur à corriger, d'où le
`.catch` plutôt qu'une exception non gérée qui pourrait laisser croire à un
dysfonctionnement. Même principe de robustesse déjà appliqué à `Progression` et `Son`
face à un `localStorage` indisponible (phases 3A/4B).

### Vérification

Testé via `outils/serveur-statique.js` (`http://localhost:8935`, après ajout des types
MIME `.webmanifest`/`.png`) : le service worker s'enregistre et s'active
(`serviceWorker.getRegistration()` confirme l'état `'activated'`), le cache
`defense-neon-v1` contient les dix-sept fichiers attendus (page, manifeste, CSS, dix
scripts JS, deux icônes), le manifeste est servi avec le type
`application/manifest+json` et son contenu correspond exactement à ce qui est attendu,
et chaque fichier du jeu répond positivement à `caches.match()` — confirmant que la
stratégie cache-first de `sw.js` les servirait hors ligne. Aucune erreur dans la console
au chargement ni au rechargement. Une partie complète a aussi été jouée sur cette
même instance servie en local (déplacement, construction de tour, lancement de vague,
pause) sans erreur ni régression visible.

Le navigateur intégré de développement utilisé pour ces vérifications ne pilote pas de
vrai chrome de navigateur (barre d'adresse, icône d'installation) : il ne pouvait donc
pas confirmer par lui-même le critère d'acceptation n°4 (proposition d'installation).
Ce point a été vérifié séparément par l'auteur du projet dans un vrai navigateur —
Brave (moteur Chromium, donc mécanisme d'installation identique à Chrome) — où
l'icône d'installation apparaît bien dans la barre d'adresse, confirmant que le
manifeste et le service worker sont tous deux jugés valides par un navigateur réel, pas
seulement par les vérifications programmatiques ci-dessus.

Le versionnement du cache (critère d'acceptation n°5) a été simulé explicitement :
`CACHE_NOM` changé sur disque (`v1` → `v2`) pendant qu'un onglet restait ouvert et
contrôlé par l'ancien service worker, sans le recharger ni le fermer. Après
déclenchement du contrôle de mise à jour (`registration.update()`, ce que le
navigateur fait aussi périodiquement de lui-même en arrière-plan), l'événement
`controllerchange` s'est déclenché dans ce même onglet, `caches.keys()` ne listait
plus que `defense-neon-v2` (l'ancien cache purgé par `activate`) et le jeu restait
pleinement fonctionnel ensuite — confirmant que `self.skipWaiting()` et
`self.clients.claim()` fonctionnent ensemble exactement comme prévu, y compris dans le
cas le plus strict (aucun rechargement, pas seulement aucune fermeture d'onglet).

Le comportement sous `file://` n'a pas pu être vérifié dans ce navigateur intégré de
développement (qui rend les fichiers locaux dans un bac à sable `data:` sans API
`serviceWorker` du tout, un environnement encore plus restrictif qu'un vrai navigateur
de bureau) ; il a été vérifié séparément par l'auteur du projet, en ouvrant
`index.html` d'un double-clic dans son navigateur habituel — le jeu fonctionne
normalement, comme attendu.

Les six critères d'acceptation de la phase 5 sont donc tous vérifiés : deux par
l'auteur du projet dans un vrai navigateur (n°4, icône d'installation dans Brave ;
n°1, fonctionnement sous `file://`), les autres programmatiquement comme détaillé
ci-dessus.

## Chemins multiples (phase 6A)

Mise à jour de contenu postérieure au plan initial (phases 1 à 5) : remplace le chemin
unique par `Config.NOMBRE_CHEMINS` (2) chemins distincts, avec leurs propres entrée et
sortie, qui peuvent se croiser librement. Change l'architecture de `carte.js` plus en
profondeur qu'une fonctionnalité additive ; ne touche en revanche à rien du reste du jeu
au-delà des points listés ci-dessous (construction, amélioration, vente, crédits,
niveau de joueur, bonus, son, PWA restent inchangés — voir « Vérification » plus bas).

### Nouvelle structure de données (`carte.js`)

`Carte.chemins` remplace les anciennes `Carte.chemin`/`pointsDePassage`/`caseDepart`/
`caseArrivee` (un seul chemin) par un tableau de `Config.NOMBRE_CHEMINS` objets :

```js
Carte.chemins = [
  { chemin: [...], pointsDePassage: [...], caseDepart: {colonne, ligne}, caseArrivee: {colonne, ligne} },
  { chemin: [...], pointsDePassage: [...], caseDepart: {colonne, ligne}, caseArrivee: {colonne, ligne} }
]
```

`chemin` (les cases brutes, dans l'ordre) est conservé par chemin en plus de
`pointsDePassage` (sa conversion en pixels) : nécessaire pour que `recalculerPixels()`
puisse reconvertir chaque chemin indépendamment après un redimensionnement, et absent
de l'exemple donné dans le prompt de cette phase (qui abrégeait la structure), mais
présent sous ce nom au niveau de `Carte` elle-même avant cette phase — conservé ici par
cohérence. `Carte.grille` ne change pas de nature : une case `'CHEMIN'` peut désormais
appartenir à plusieurs chemins (un croisement), sans que la grille elle-même ne le
distingue — seul `Carte.chemins` sait lequel passe où.

Génération chemin par chemin (0, puis 1), en réutilisant l'algorithme de tracé de la
phase 1A tel quel (`tenterTracerChemin`, `MAX_TENTATIVES_GENERATION`,
`LONGUEUR_CHEMIN_MIN`, chemin de secours en S). La règle d'auto-contact
(`caseValidePourChemin`) n'a nécessité **aucune modification** : elle ne reçoit et ne
compare jamais que les cases du `cheminEnCours` qu'on lui passe explicitement, jamais un
état global des chemins déjà générés — la portée « seulement le chemin en cours » qu'exigeait cette
phase existait donc déjà de fait, simplement parce que cette fonction n'a jamais eu
connaissance d'autre chose que son propre argument.

**Espacement des entrées et sorties** (`Config.ECART_MIN_ENTREES_SORTIES`, purement
visuel — n'influence jamais le tracé lui-même) : `Carte.choisirLigneEspacee(lignesDejaChoisies)`
tire une ligne (jusqu'à dix essais, sinon accepte la dernière tirée) pour l'entrée de
chaque chemin après le premier. Pour la sortie, qui n'est pas tirée indépendamment mais
émerge de la marche aléatoire (elle est simplement là où le chemin atteint la dernière
colonne), la même règle est appliquée en retraçant jusqu'à dix chemins complets depuis
la même ligne d'entrée et en retenant le premier dont la sortie respecte l'espacement —
plutôt que d'ajouter à l'algorithme de tracé une notion de « ligne de sortie visée »,
qu'il n'a jamais eue et que le prompt de cette phase demandait explicitement de ne pas
changer.

### Écarts par rapport au prompt (6A)

- **Ligne d'entrée** : le prompt décrivait la ligne d'entrée comme « tirée entre
  LIGNE_MIN et LIGNE_MAX, comme avant », mais le code réel tirait `Aleatoire.entier(2, 9)`
  en dur depuis la phase 1A — une incohérence latente jamais documentée. Corrigée à
  cette occasion puisque cette ligne de code devait de toute façon être extraite pour
  devenir `choisirLigneEspacee` ; sans effet sur la reproductibilité des anciennes
  graines de toute façon déjà rompue par cette phase (voir plus bas).
- **Flux animé le long du tracé** : le prompt présente la coloration par chemin comme un
  ajustement d'« l'effet de flux animé introduit en phase 4A (`lineDashOffset`) », mais
  cet effet n'a jamais existé dans ce dépôt (ni dans `carte.js`, ni documenté en phase
  4A) — vérifié par recherche de `lineDashOffset`/`setLineDash` dans `js/`, sans
  résultat avant cette phase. Implémenté ici à neuf (une ligne pointillée par chemin,
  défilant avec `performance.now()`, dans la teinte de `Config.COULEURS.cheminsNeon`)
  plutôt que reporté, car sans lui les deux chemins seraient indiscernables à un
  croisement (la case elle-même reste volontairement une simple case `'CHEMIN'`, voir
  ci-dessous) — nécessaire à la fois à l'esprit de cette phase et à son critère
  d'acceptation n°9.
- **Marqueurs départ/arrivée** : reprennent désormais la teinte de leur propre chemin
  (`Config.COULEURS.cheminsNeon`) plutôt que le vert/rose fixe unique posé en phase 4A
  (`Config.COULEURS.depart`/`arrivee`, conservées telles quelles dans `Config` pour ne
  rien casser d'autre qui les lirait, mais plus utilisées par `Carte.dessiner`) — c'est
  ce que demande explicitement le prompt (« reprennent respectivement la même teinte »
  que leur chemin), et cela permet en prime d'apparier visuellement une entrée à sa
  sortie.
- **`Jeu.redimensionner()`** : le prompt la nomme comme devant « boucler sur
  `Carte.chemins` ». Ce bouclage vit en réalité entièrement dans
  `Carte.recalculerPixels()` (qui itère maintenant sur `this.chemins`) : l'unique appel
  `Carte.recalculerPixels();` dans `jeu.js` n'a donc pas eu besoin de changer une seule
  ligne, l'encapsulation existante suffisant à obtenir le même effet sans faire fuiter
  la structure interne de `Carte` dans `jeu.js`.
- **Script de vérification** : le prompt suppose l'existence d'« un script de
  vérification à graine, celui utilisé lors du correctif de la phase 1A ». Aucun script
  de ce nom ou de cet objet n'existe dans ce dépôt (seuls `outils/serveur-statique.js`
  et `outils/simulation-equilibrage.js` y figurent) — probablement un outil ad hoc de
  l'époque, jamais conservé. Réécrit à neuf sous `outils/verification-chemins.js`, avec
  une méthode volontairement indépendante de `carte.js` (revalidation manuelle de
  l'adjacence, des bornes de ligne et de la continuité, plutôt que réutilisation des
  fonctions de `Carte` elle-même) pour ne pas se contenter de vérifier que le
  générateur est d'accord avec lui-même.

### Ciblage des tours (`tour.js`)

`Tour.progressionEnnemi(ennemi)` (déplacée depuis vers `Ennemi.progression()` en phase
7F — voir « Le triangle Flak/Caserne/Drone (phase 7F) » plus bas — pour rester valable
aussi pour un drone, qui n'a ni `cheminIndex` ni `indexPointDePassage`) renvoyait
`ennemi.indexPointDePassage / (Carte.chemins[ennemi.cheminIndex].pointsDePassage.length - 1)`,
protégée contre un chemin d'une seule case (renvoie 0 plutôt qu'une division par zéro,
cas extrême improbable vu `Config.LONGUEUR_CHEMIN_MIN`) — `Ennemi.progression()`
conserve ce même calcul, à l'identique, pour un ennemi au sol. `Tour.chercherCible`
compare cette progression normalisée plutôt que `indexPointDePassage` brut : un
ennemi à l'index 5 d'un chemin de 15 cases (progression ≈ 0,36) est correctement préféré
à un ennemi à l'index 5 d'un chemin de 40 cases (progression ≈ 0,13), alors que l'ancien
critère (index brut) les aurait traités à égalité. Comportement vérifié à la fois en
partie réelle et par un test synthétique isolé (deux faux ennemis à portée égale, l'un
sur un chemin factice court à index bas mais forte progression, l'autre sur le vrai
chemin à index plus élevé mais progression réellement plus faible) : la tour cible bien
le premier.

### Assignation d'un chemin à chaque ennemi (`ennemi.js`, `vagues.js`)

`Ennemi.cheminIndex`, fixé à la création par `Vagues.mettreAJour` via
`Aleatoire.entier(0, Config.NOMBRE_CHEMINS - 1)` (jamais `Math.random()`, pour rester
reproductible à graine égale). `Ennemi.deplacer(dt)` et la position de départ au
constructeur lisent désormais `Carte.chemins[this.cheminIndex].pointsDePassage` au lieu
de l'ancien tableau global — un ennemi ne lit jamais que son propre chemin, y compris à
un point de croisement, il n'a donc structurellement aucun moyen de dévier vers l'autre.

### `outils/simulation-equilibrage.js`

Comme anticipé par la note de phase 3B, toutes les mesures d'équilibrage précédentes
(paliers d'amélioration, bonus permanents) sont désormais **officiellement obsolètes** :
cette phase change la consommation d'`Aleatoire` (nouveau tirage du `cheminIndex` de
chaque ennemi, et nouveaux tirages pour l'espacement des entrées/sorties), donc même les
graines déjà mesurées ne rejouent plus la même suite aléatoire. Aucune tentative de les
préserver n'a été faite ; un nouveau round de mesure est laissé à la phase 6B (commentaire
`// PHASE 6B :` posé en tête du fichier), une fois la limite de tours constructibles
elle-même en place.

Deux références à l'ancienne structure (`Carte.chemin`, `Carte.caseDepart`) ont été
adaptées vers `Carte.chemins[0]` : ce script compare des stratégies sur un seul chemin de
référence, sans notion de plusieurs chemins simultanés, cohérent avec le fait que ses
résultats sont de toute façon marqués obsolètes.

En le relançant pour vérifier cette adaptation, une erreur préexistante et sans rapport
avec cette phase a été découverte : `Tour.tirer()` (depuis la phase 4B) appelle
`Particules.creerTir` et `Son.jouerTir`, mais `creerContexteJeu()` n'a jamais chargé ni
stubé `Particules`/`Son` dans son bac à sable Node — le script plante dès qu'une tour
tire, indépendamment de tout ce qui touche aux chemins. Ce défaut préexistait donc déjà
avant cette phase (depuis la phase 4B) et lui est totalement étranger ; il n'a pas été
corrigé ici pour ne pas élargir le périmètre de la phase 6A, mais a été signalé comme
tâche séparée.

### Hors périmètre à cette étape (traité depuis, voir « Limite de tours (phase 6B) »)

Deux commentaires `// PHASE 6B :` marquaient les points laissés délibérément de côté à
la fin de la phase 6A : le refus de construire au-delà d'une limite de tours
(`Interface.tenterConstruireTour`, `interface.js`) et le nouveau round de mesure qui
devrait suivre cette limite (`outils/simulation-equilibrage.js`). Le premier point est
désormais traité (voir la section dédiée plus bas) ; le round de mesure complet reste
lui seul en attente, une mesure purement informative ayant suffi pour cette étape (voir
la même section).

### Vérification

`outils/verification-chemins.js`, exécuté sur 500 graines (`node
outils/verification-chemins.js 500`) :

- **0 carte en erreur** sur 1000 chemins générés (500 graines × 2 chemins) : chaque
  chemin relie sa colonne 0 à sa dernière colonne sans interruption, reste dans la bande
  `LIGNE_MIN`-`LIGNE_MAX`, et ne se touche jamais lui-même (vérifié indépendamment de
  `carte.js`, voir plus haut) ;
- **0 échec de reproductibilité** : régénérer avec la même graine reproduit exactement
  les mêmes chemins (critère d'acceptation n°7) ;
- **chemin de secours jamais déclenché** (0/1000) sur cet échantillon ;
- **mesure informative — croisement réel** : **93,2 %** des 500 cartes présentent au
  moins une case commune entre les deux chemins (466/500). Largement suffisant pour ne
  pas être un point à retravailler dans l'immédiat, contrairement à l'hypothèse basse
  envisagée par le prompt ;
- **mesure informative — espacement observé** : écart moyen de 4,84 lignes entre
  entrées et 4,85 entre sorties, minimum observé 3 (jamais en-dessous de
  `Config.ECART_MIN_ENTREES_SORTIES`) sur cet échantillon.

Régression phases 1-5 : vérifiée manuellement dans le navigateur (serveur local) —
construction, panneau d'amélioration/vente, lancement de vague, perte d'intégrité à
l'arrivée d'un ennemi (sur l'un ou l'autre chemin), écran de progression joueur, et
enregistrement/activation du service worker (PWA) fonctionnent tous sans erreur console
après cette phase.

## Limite de tours (phase 6B)

Ajoute une limite au nombre de tours constructibles simultanément sur une carte,
**proportionnelle** à sa surface réellement constructible plutôt qu'un nombre fixe :
avec deux chemins qui peuvent se croiser (phase 6A), le nombre de cases `'LIBRE'`
varie d'une carte à l'autre selon la forme exacte des tracés — un chiffre en dur serait
tantôt trop permissif, tantôt trop restrictif.

### Calcul (`jeu.js`)

`Config.PROPORTION_LIMITE_TOURS` (0,5 pour commencer — voir « Valeur mesurée » plus
bas) multiplie le nombre de cases `'LIBRE'` de la carte qui vient d'être générée.
`Jeu.reinitialiser()` compte ces cases juste après `Carte.generer(graine)` (avant toute
construction) et fixe `Jeu.limiteTours = Math.floor(casesLibres * Config.
PROPORTION_LIMITE_TOURS)` — calculé une seule fois par partie, jamais recalculé
ensuite : recalculer en cours de partie ferait bouger la limite elle-même à chaque
construction, puisqu'une case `'LIBRE'` devient `'OCCUPEE'`. À graine égale,
`Carte.generer` produit toujours la même grille, donc toujours la même limite (critère
d'acceptation n°5).

### Application (`interface.js`)

Un seul point de vérité pour la limite : `Jeu.toursActives.length >= Jeu.limiteTours`,
consulté à quatre endroits qui doivent tous rester d'accord entre eux —
- **Construction** (`tenterConstruireTour`) : refuse et affiche « Limite de tours
  atteinte » (même mécanisme que « Crédits insuffisants »), avant même de vérifier le
  coût — une tour ne se construit pas juste parce que les crédits le permettraient ;
- **Barre de sélection** (`mettreAJourBoutonsTypesTours`) : grise les trois boutons de
  type dès que la limite est atteinte, pas seulement celui dont le coût dépasse les
  crédits (comme c'était déjà le cas) — aucun type n'est alors plus constructible ;
- **Aperçu au survol** (`dessinerApercuConstruction`) : une case par ailleurs `'LIBRE'`
  bascule en contour rouge une fois la limite atteinte, alors qu'elle resterait verte
  autrement — visuellement libre, mais plus constructible tant qu'aucune tour n'a été
  vendue ;
- **HUD** (`index.html`, `mettreAJourEcrans`) : nouvel élément « Tours : X / Y » entre
  Intégrité et Vague, X = `Jeu.toursActives.length`, Y = `Jeu.limiteTours`.

Vendre une tour (phase 2B, inchangée) libère naturellement un emplacement : les quatre
points ci-dessus relisent `toursActives.length` à chaque évaluation, aucune logique
supplémentaire n'était nécessaire pour ce cas (vérifié en test manuel : vendre une tour
une fois la limite atteinte permet immédiatement d'en reconstruire une autre).

### Valeur mesurée (`outils/simulation-equilibrage.js`)

Nouvelle mesure informative (`mesurerCasesLibres`, appelée en fin de script) : compte
les cases `'LIBRE'` juste après génération d'une carte à 2 chemins, sur les huit
graines déjà utilisées par les expériences de stratégie. Ne relance aucun des quatre
rounds précédents (voir la note en tête du fichier).

| | Cases libres | Limite (× 0,5) |
|---|---|---|
| Minimum | 171 | 85 |
| Moyenne | 179,1 | 89 |
| Maximum | 187 | 93 |

**`Config.PROPORTION_LIMITE_TOURS = 0,5` reste une première valeur, pas définitive** —
explicitement demandé comme telle : une limite de 85 à 93 tours est probablement très
généreuse en pratique (l'économie du jeu, crédits gagnés au fil des vagues, plafonne
déjà naturellement le nombre de tours qu'un joueur peut se permettre bien avant ce
chiffre pour une partie Standard ou Rapide), donc cette limite ne se fera sûrement
sentir qu'en parties longues ou Sans fin. Le bon réglage se fera par test manuel du jeu
réel plutôt que par un nouveau round automatisé, comme demandé — une future session
pourra resserrer `PROPORTION_LIMITE_TOURS` si le jeu en partie longue montre qu'elle ne
se fait jamais sentir.

### Vérification

Testé manuellement en navigateur (serveur local), limite abaissée temporairement à 2
via la console pour ne pas devoir construire des dizaines de tours : construction
refusée avec le message dédié au-delà de la limite (crédits pourtant largement
suffisants), les trois boutons de type grisés, aperçu au survol rouge sur une case
`'LIBRE'`, vente d'une tour suivie d'une reconstruction immédiate réussie, HUD à jour
(« 2 / 2 » puis retour à « 2 / 2 » après vente+reconstruction), reproductibilité
confirmée (même graine → même `Jeu.limiteTours` sur deux appels successifs de
`reinitialiser`). Aucune erreur console. Service worker et cache (`defense-neon-v2`,
incrémenté pour cette mise à jour de contenu) fonctionnels après ces changements.

## Écart par rapport au prompt

Le prompt décrivait le tirage du type d'ennemi avec un « sinon » entre Blindé et Rapide,
ce qui aurait fait disparaître les Rapides dès qu'une vague débloque les Blindés (vague 6
et au-delà). Le critère d'acceptation n°4 demande explicitement que les Blindés
apparaissent « également » à partir de la vague 6, donc en plus des Rapides et non à leur
place : les deux proportions sont donc cumulées (un même tirage peut tomber dans l'une ou
l'autre plage) plutôt que la seconde n'étant testée que si la première échoue.

Aucun ajustement de formule n'a été nécessaire par ailleurs : avec la configuration
demandée, le plancher `INTERVALLE_APPARITION_MIN` n'est atteint qu'aux alentours de la
vague 37 — au-delà de toutes les durées finies proposées depuis la phase 1D (10, 20, 35
vagues) et bien sûr atteignable en mode Sans fin, où c'est le comportement recherché (la
cadence continue de s'intensifier avec le score).

## Correctifs mobile

Deux correctifs indépendants, découverts en testant sur un vrai téléphone.

### Bouton Son qui chevauchait l'écran d'accueil (`css/style.css`)

**La cause supposée ne correspondait pas au code réel** : `#bouton-son` n'a jamais eu
de `position: fixed`/`absolute` — il partage le style plat des autres boutons du HUD
(`#bouton-lancer-vague, #bouton-pause, #bouton-vitesse, #bouton-son`) et s'insère
normalement dans le flux vertical de `body` (flex column), entre le `<h1>` et
`.conteneur-canvas`. Reproduit à 360px et 320px (`resize_window` + lecture directe de
`getBoundingClientRect`) pour identifier la vraie cause avant de corriger : le contenu
de l'écran d'accueil (`#ecran-accueil`, centré verticalement par flexbox dans une boîte
`inset: 0` calée sur `min-height` de `.conteneur-canvas`) mesurait 461px de haut, contre
une `min-height` de seulement 420px héritée de la phase 1D — un contenu plus haut que sa
boîte déborde de façon symétrique en haut ET en bas, sans qu'aucun `overflow` ne le
limite, et c'est ce débordement du haut qui chevauchait le bouton Son (et le `<h1>`)
juste au-dessus dans le flux normal de la page. Cette valeur de 420px n'avait
simplement jamais été révisée depuis que l'écran d'accueil s'est étoffé (niveau/XP et
liste des cinq paliers de bonus, phases 3A/3B) — la vraie régression, sans rapport avec
le positionnement du bouton lui-même. Corrigé en portant cette `min-height` à 500px
(marge au-delà des 461px mesurés). Testé à 360px et 320px : plus aucun chevauchement, le
bouton reste tapable (`min-height: 44px` déjà en place), écrans de victoire/défaite et
panneau d'amélioration non affectés (leur contenu, plus court, ne débordait déjà pas).

### Aperçu de portée au tap, sur tactile (`interface.js`, `jeu.js`)

`Interface.gererClicCanvas` distingue maintenant souris et tactile
(`this.supportSurvol(evenement)`, la même détection que celle qui pilote déjà le
survol depuis la phase 1D) : sur souris, comportement inchangé (construction immédiate
au clic) ; sur tactile, un premier tap sur une case `'LIBRE'` pose
`Interface.caseEnAttenteConfirmation` et réutilise `caseSurvolee` (donc le même
`dessinerApercuConstruction` déjà écrit pour la souris, aucun code de dessin dupliqué)
sans construire ; un second tap sur cette même case construit et efface l'attente ; un
tap sur une case libre différente déplace simplement l'aperçu ; un tap sur une case
`'OCCUPEE'` ou `'CHEMIN'` efface l'attente et conserve le comportement déjà en place
(sélection de tour / fermeture du panneau). `Jeu.reinitialiser()` efface aussi cette
attente à chaque nouvelle partie (comme `Interface.tourSelectionnee`), et le clic
souris l'efface également par robustesse sur un appareil hybride écran tactile +
souris (sans effet sur un appareil purement souris, où elle reste toujours `null`).

**Piège rencontré et corrigé en le découvrant** : sur beaucoup de navigateurs, un tap
tactile déclenche aussi `pointerleave` juste après le relâchement (le point de contact
« quitte » l'élément puisqu'il cesse d'exister) — l'écouteur `pointerleave` existant,
qui remettait `caseSurvolee` à `null` sans condition, aurait donc effacé l'aperçu
tactile l'instant même où `gererClicCanvas` venait de le poser, avant qu'il ne soit
jamais visible. Corrigé en ne laissant cet écouteur agir que pour la souris
(`this.supportSurvol(evenement)`), où `pointerleave` garde son sens habituel (le
pointeur quitte réellement le canvas).

Comme la limite de tours (phase 6B) et la vérification des crédits sont relues à
chaque frame par `dessinerApercuConstruction`, elles s'appliquent naturellement dès le
premier tap, sans code supplémentaire — vérifié explicitement (limite abaissée
artificiellement à la valeur courante : l'aperçu du premier tap ressort bien rouge).

Testé par événements `PointerEvent` synthétiques (`pointerType: 'touch'` puis
`'mouse'`) plutôt que par le simulateur de clic du navigateur de développement utilisé
pour ce projet, qui envoie toujours `pointerType: 'mouse'` même en émulation mobile
(vérifié : un unique clic y construit toujours immédiatement) — seul un `PointerEvent`
explicite permet donc de tester ici un vrai tap tactile. Les quatre scénarios du prompt
(premier tap, second tap sur la même case, tap sur une case libre différente, tap sur
une case occupée/chemin) confirmés un par un, plus le comportement souris (clic unique,
inchangé) et la reproduction visuelle de l'aperçu (capture d'écran après un premier
tap : contour et cercle de portée bien affichés, aucune tour construite). Aucune
erreur console dans les deux modes.

## Contenu additionnel post-lancement

Nouvelle vague de contenu, discutée et planifiée en dehors de Claude Code, ouverte après
la clôture des chemins multiples et de la limite de tours (phases 6A/6B). Regroupe
plusieurs sous-phases indépendantes ; seul leur ordre d'arrivée dans ce document reflète
l'ordre dans lequel elles sont traitées, pas nécessairement leur numérotation finale (le
prompt de la première sous-phase à être implémentée l'identifiait comme « 7C », sans
préciser à quoi correspondraient 7A/7B pour les autres — cette numérotation n'est donc
pas reprise ici tant qu'elle n'est pas confirmée pour chacune) :

- Tours spéciales (nouveaux types au-delà des trois existants, voir « Types de tours et
  sélection » ci-dessus) — fait, voir « Le triangle Flak/Caserne/Drone (phase 7F) »
  ci-dessous (tours Flak et Caserne).
- **Ennemi volant (« phase 7F »)** — fait, voir « Le triangle Flak/Caserne/Drone (phase
  7F) » ci-dessous.
- **Vagues de boss (« phase 7G »)** — fait, voir « Vagues de boss (phase 7G) »
  ci-dessous.
- Mode difficile — non commencé.
- **Décor d'arrière-plan animé (« phase 7C » selon le prompt qui l'a introduite)** —
  fait, voir « Décor d'arrière-plan en parallaxe (phase 7C) » ci-dessous. Complété par
  une **image de fond fixe (« phase 7C bis »)** — fait, code et fichier réel tous deux en
  place et vérifiés (`images/decor-fond.png`, déposé par l'utilisateur ; voir « Image de
  fond fixe (phase 7C bis) » ci-dessous pour le détail, y compris l'écart de format
  `.webp` → `.png`). Un correctif de transparence du plateau est aussi venu s'y greffer,
  voir « Transparence du plateau (correctif post-7C) ».
- Ennemis et chemins restylés — non commencé.

## Décor d'arrière-plan en parallaxe (phase 7C)

Skyline animé en parallaxe à deux couches, visible dans les marges qui entourent le
plateau de jeu — purement scénographique, sans aucun effet sur le déroulement ou
l'équité d'une partie.

### Un second canvas, jamais un ajout au canvas de jeu

`#canvas-decor` (`index.html`) est un second élément `<canvas>`, entièrement séparé du
canvas de jeu (`#canvas-jeu`) et de son contexte 2D. Nécessaire parce que le canvas de
jeu dessine un fond opaque sur toute sa surface depuis la phase 1A (renforcé en 4A) :
rien ne peut apparaître « à travers » lui. En CSS (`style.css`), `#canvas-decor` est
`position: fixed; inset: 0` avec `width`/`height: 100%` (un `<canvas>` est un élément
remplacé — `inset` seul ne l'étire pas comme il le ferait pour une boîte ordinaire à
dimensions automatiques) et `z-index: -1` : suffisant pour passer derrière tout le reste
du contenu de `body`, puisqu'aucun autre enfant direct de `body` n'a de `z-index` propre
ni de position créant son propre contexte d'empilement — ce `z-index` négatif s'applique
donc bien dans le contexte d'empilement racine de toute la page, pas seulement
localement. Résultat : le décor n'est visible que dans les marges autour de
`.conteneur-canvas` (`max-width: 900px`) — plus larges sur desktop, quasi absentes sous
900px de large où ce conteneur occupe déjà toute la largeur disponible. Aucune tentative
de faire apparaître le décor à travers le plateau lui-même, comme demandé : ça aurait
été un risque inutile pour la lisibilité déjà validée en phase 4A (confirmée sans
régression après cette phase, voir « Vérification » plus bas).

### Génération des bâtiments (`decor.js`)

`Decor.initialiser()` (appelée par `Jeu.initialiser()`) génère une seule fois, au
chargement de la page, `Config.DECOR_NOMBRE_BATIMENTS_LOINTAIN` (8) et `_PROCHE` (6)
bâtiments par couche (`genererCouche`) — jamais régénérés ensuite, y compris à un
redimensionnement (seul le canvas lui-même l'est, voir plus bas). Chaque bâtiment est un
simple rectangle : largeur moyenne dérivée de `window.innerWidth` au chargement (pour
que `nombre` bâtiments couvrent environ deux fois la largeur de la fenêtre, de la marge
avant qu'un défilement ne devienne visible), hauteur tirée dans une fourchette propre à
la couche (`[50, 140]` pour la lointaine, `[90, 220]` pour la proche — plus haute, pour
renforcer l'impression de profondeur en plus du contraste de couleur entre
`Config.COULEURS.decorLointain`/`decorProche`). Environ six bâtiments sur dix reçoivent
deux ou trois petites fenêtres (`Config.COULEURS.decorFenetre`) à des positions fixes,
statiques pour cette phase (pas de clignotement).

**Exception délibérée à la règle du générateur à graine** : `Math.random()` est utilisé
directement dans `genererCouche`, plutôt que `Aleatoire` comme partout ailleurs dans le
jeu depuis la phase 1A. Le décor n'a aucun effet sur le déroulement ni l'équité d'une
partie — c'est de la scénographie pure — donc aucune raison de payer le coût d'une
dépendance à la reproductibilité pour l'aspect de bâtiments purement décoratifs. Même
raisonnement déjà appliqué aux tirages de `particules.js` (phase 4B).

### Défilement, recyclage, et un détail de temporisation important (`decor.js`, `jeu.js`)

`Decor.mettreAJour(dt)` déplace chaque bâtiment de `vitesse * dt` vers la gauche
(`Config.DECOR_VITESSE_LOINTAIN` = 4 px/s, `_PROCHE` = 10 px/s). Un bâtiment dont le bord
droit sort de l'écran par la gauche est replacé juste après le bâtiment le plus à droite
de sa propre couche, avec un nouvel espacement aléatoire — même principe de recyclage que
les projectiles (`tour.js`) ou les particules (`particules.js`), mais appliqué à un
simple repositionnement plutôt qu'à un pool actif/inactif : le nombre de bâtiments par
couche reste constant, invisible pour le joueur puisque ce recyclage n'a lieu que hors
champ.

Appelée depuis `Jeu.boucle()` (`jeu.js`), **sans condition sur `etatPartie` ni
`enPause`** — contrairement à `Jeu.simuler()` — pour que le décor continue de défiler
pendant une pause, sur l'écran d'accueil, ou sur les écrans de victoire/défaite : c'est
un arrière-plan ambiant, pas une partie de la simulation de jeu. Reçoit le `dt` déjà
plafonné à `Config.DT_MAXIMUM` mais **avant** la multiplication par `Jeu.vitesseJeu`
(contrairement au `dt` transmis à `Jeu.simuler()` juste après dans `boucle()`) : la
vitesse de défilement du décor ne varie jamais avec le bouton Vitesse ×2, à la différence
de la vitesse des ennemis/tours/projectiles.

### Dessin (`decor.js`)

`Decor.dessiner(ctx)` : couche lointaine d'abord, couche proche par-dessus, sur un fond
plein (`Config.COULEURS.fond`) posé avant les deux — nécessaire ici, contrairement au
canvas de jeu, puisque ce canvas n'a pas de fond opaque garanti par ailleurs (voir
Section 0 du prompt de cette phase) : sans lui, l'espace entre deux bâtiments espacés
laisserait un bord non dessiné. Un `shadowBlur` léger (`Config.DECOR_HALO_FLOU`) est
utilisé sur les bâtiments, toujours reposé à 0 immédiatement après (même règle
qu'ailleurs dans le jeu). **Ce n'est pas une contradiction avec la règle posée en phase
4A** (éviter `shadowBlur` sur les éléments nombreux et redessinés chaque frame — la
grille de 240 cases, ou les particules potentiellement par centaines) : c'est la même
règle, appliquée cohéremment à un cas différent — ce canvas ne contient jamais plus d'une
quinzaine de formes au total (8 + 6), sans rapport avec l'échelle des éléments du plateau
de jeu, donc le coût de rendu par appel (proportionnel au nombre d'appels) reste
négligeable ici.

### Écart par rapport au prompt (7C)

Le prompt de cette phase donnait les couleurs du décor sous la forme `PALETTE.decorX`,
suggérant un objet `Config.PALETTE` séparé. Aucun tel objet n'existe dans ce dépôt —
`Config.COULEURS` *est* déjà la palette du jeu depuis la phase 4A (`fond`, `depart`,
`arrivee`, `cheminsNeon`, halos...). Les trois nouvelles couleurs
(`decorLointain`/`decorProche`/`decorFenetre`) y ont donc été ajoutées directement plutôt
que dans un second objet parallèle, qui aurait fragmenté les couleurs du jeu en deux
sources de vérité sans raison. `Config.DECOR_HALO_FLOU` a aussi été ajouté (non listé
explicitement dans le prompt) pour rester cohérent avec la règle « aucune constante
numérique magique dans le code » déjà appliquée à tous les autres halos du jeu
(`HALO_FLOU_TOUR_BASE`, etc.) — le prompt demandait explicitement un `shadowBlur`
« léger » sans en préciser la valeur.

### Vérification

Testé en navigateur (serveur local) : skyline à deux couches visible dans les marges à
1400px et 1000px de large (captures d'écran), plateau de jeu inchangé et parfaitement
lisible une fois une partie démarrée (aucune régression). `requestAnimationFrame` ne
tournant pas dans l'onglet du navigateur intégré de développement utilisé pour ce projet
tant qu'il n'est pas réellement au premier plan (`document.hidden` reste vrai même après
mise au premier plan via l'outil dédié — limite déjà rencontrée lors de vérifications
précédentes, voir la phase 3A), les frames ont été pilotées manuellement via des appels
directs et successifs à `Jeu.boucle(horodatage)` avec un horodatage croissant, pour
tester précisément :

- **ratio de vitesse entre couches** : déplacement mesuré sur 1 seconde simulée,
  `depProche / depLointain` = 2,50 — exactement `Config.DECOR_VITESSE_PROCHE /
  Config.DECOR_VITESSE_LOINTAIN` ;
- **vitesse ×2 sans effet** : déplacement du décor identique (à l'arrondi près) avec
  `Jeu.vitesseJeu = 2` qu'avec `1`, pendant une partie réellement démarrée
  (`Jeu.demarrerPartie`) ;
- **pause sans effet** : déplacement identique avec `Jeu.enPause = true` ;
- **recyclage** : un bâtiment forcé juste sous le bord d'écran (bord droit < 0) se
  retrouve, une frame plus tard, replacé juste après le bâtiment le plus à droite de sa
  couche — même tableau, même nombre de bâtiments, aucun objet recréé ;
- **redimensionnement** : `Decor.canvas.width`/`height` suivent `window.innerWidth`/
  `innerHeight` dès qu'un événement `resize` est réellement déclenché sur `window`
  (testé via `dispatchEvent(new Event('resize'))`, qui contourne une limite de l'outil
  de test utilisé — un changement de viewport émulé via cet outil ne déclenche pas
  toujours l'événement natif `resize`, sans rapport avec le code du jeu lui-même,
  confirmé par un appel manuel réussi de `Decor.redimensionner()` juste avant) ; le
  canvas de jeu, lui, reste inchangé par un redimensionnement du décor (et
  réciproquement), les deux étant redimensionnés par deux écouteurs `resize` entièrement
  indépendants.

Aucune erreur console dans aucun de ces scénarios.

## Image de fond fixe (phase 7C bis)

Image de fond fixe et réaliste, affichée par-dessus le skyline procédural (phase 7C)
quand elle est disponible, sans jamais le supprimer : le skyline reste le filet de
sécurité si l'image est absente ou invalide.

### Fichier attendu

`images/decor-fond.png`, référencé en chemin relatif (`./images/decor-fond.png`, jamais
absolu, comme partout ailleurs dans le projet). **Absent du dépôt au moment où cette
phase a été codée** (vérifié : ni `images/` ni aucune image de décor n'existaient avant
que cette phase ne crée le dossier vide) — prévu et géré comme un cas normal par le code
ci-dessous, pas comme une erreur, exactement comme demandé. Les deux comportements
(repli sans image, puis image affichée) ont depuis été vérifiés concrètement une fois le
fichier réellement ajouté au projet par l'utilisateur — voir « Vérification » ci-dessous.

**Écart de format** : le prompt de cette sous-phase prévoyait un `.webp`
(`images/decor-fond.webp`). Le fichier réellement déposé dans le projet est un `.png`
(1408×768, photo de ville néon sous la pluie) ; aucun outil de conversion vers WebP
n'était disponible dans cet environnement au moment de l'intégrer (`convert` résolvait
vers l'utilitaire Windows `convert.exe`, sans rapport avec ImageMagick — confirmé en
l'invoquant directement, qui a renvoyé une erreur explicite de système de fichiers, pas
une erreur de conversion). Le nom et l'extension ont donc été ajustés en conséquence,
partout où ils apparaissent (`index.html`, `sw.js` ×2), plutôt que de bloquer sur un
format indisponible — le choix du format (`.webp` vs `.png`) n'a aucune incidence
fonctionnelle ici, `<img>` et `cache.addAll()` traitant les deux de façon identique.

### Superposition (`index.html`, `style.css`)

`#image-decor` (`<img>`, pas une image de fond CSS — pour pouvoir détecter facilement son
chargement en JavaScript) et `.voile-decor` (un `<div>`) sont insérés dans le DOM juste
après `#canvas-decor`, dans cet ordre. Les trois partagent `z-index: -1` : leur ordre
d'empilement relatif vient alors de leur ordre dans le DOM (canvas peint en premier/en
dessous, puis l'image, puis le voile par-dessus) plutôt que de trois valeurs de
`z-index` distinctes — suffisant pour rester, comme `#canvas-decor`, derrière tout le
contenu normal de `body` (voir le raisonnement détaillé dans le commentaire CSS de
`#canvas-decor`, phase 7C ci-dessus, qui s'applique à l'identique ici). `.image-decor`
utilise `position: fixed` (pas `absolute`, contrairement à l'esquisse CSS du prompt de
cette phase) pour couvrir tout le viewport exactement comme `#canvas-decor` qu'elle
recouvre — cohérence avec l'instruction du prompt de la positionner « exactement comme »
ce canvas, qui est lui-même en `fixed`. `object-fit: cover` remplit la zone sans déformer
l'image quel que soit son ratio d'origine.

Masquée par défaut (`opacity: 0`), rendue visible par la classe `.image-decor--visible`
(transition douce de 0,6s) ajoutée uniquement au chargement réussi — jamais pour masquer
un échec, voir plus bas. `.voile-decor` (`rgba(11, 11, 20, 0.5)`, la teinte de
`Config.COULEURS.fond` à 50 % d'opacité) est toujours présent, pas seulement quand
l'image est visible : sans effet perceptible tant que `.image-decor` reste à `opacity: 0`
(il assombrit alors légèrement le seul skyline procédural, d'une teinte déjà proche de la
sienne), donc rien à conditionner ici non plus.

### Chargement et repli (`decor.js`)

`Decor.initialiserImageFond()` (appelée depuis `Decor.initialiser()`) pose deux
écouteurs sur `#image-decor` : `load` ajoute `.image-decor--visible` ; `error` se
contente d'un `console.warn()` explicite — l'image reste à `opacity: 0`, invisible, et le
skyline procédural en dessous (`Decor.mettreAJour`/`dessiner`, jamais interrompus,
aucune des deux méthodes ne lit l'état de l'image) reste seul visible. C'est ce qui rend
ce repli gratuit : rien de spécial à faire en cas d'échec, seulement à ne rien faire de
plus en cas de succès.

**Piège de course rencontré et corrigé en le découvrant** : un `<img src="...">`
commence à charger dès que le HTML est analysé par le navigateur, bien avant que
`DOMContentLoaded` (et donc `Decor.initialiser()`) ne s'exécute. Sur le serveur local
utilisé pour tester, la réponse 404 à une image absente revient si vite que le
chargement était déjà résolu — en échec — au moment où `initialiserImageFond()` posait
ses écouteurs : vérifié directement (`image.complete === true`, `image.naturalWidth ===
0`, alors qu'aucun des deux écouteurs n'avait encore tourné), et par l'absence de
l'avertissement attendu dans la console malgré un échec de chargement bien réel. Un
écouteur posé après coup ne se redéclenche jamais pour un événement déjà passé. Corrigé
en testant `image.complete` juste après avoir posé les écouteurs : si déjà vrai
(chargement déjà résolu, succès ou échec), appelle manuellement le bon gestionnaire —
`image.naturalWidth > 0` distinguant les deux cas déjà résolus. Un serveur de production
plus lent (ou une image plus lourde) n'aurait peut-être jamais révélé ce piège ; détecté
ici uniquement parce que le repli était systématiquement testé, l'image étant absente du
projet à ce stade.

### Mise en cache PWA (`sw.js`)

`./images/decor-fond.png` ajouté à `FICHIERS_A_METTRE_EN_CACHE`, `CACHE_NOM` incrémenté
à `v7` (fichier encore absent, install cassée par construction — voir ci-dessous), puis à
`v8` (renommage `.webp` → `.png`).

**Alerte, comme demandé explicitement par le prompt de cette phase** : tant que le
fichier était absent du dépôt, `cache.addAll()` — atomique, une seule entrée en échec
(404) fait échouer *toute* la mise en cache, pas seulement celle de l'image — échouait
systématiquement. Vérifié concrètement à ce stade : après un
`navigator.serviceWorker.register('./sw.js')` frais, le cache `defense-neon-v7` était
bien créé (par `caches.open()`, qui précède `cache.addAll()`) mais restait vide (0
fichier), et la registration n'atteignait jamais l'état `active`. Le jeu lui-même
continuait de fonctionner normalement en attendant (repli implicite du navigateur sur le
réseau, sans service worker actif) : pas une régression sur le jeu, mais bien
l'installation/le mode hors ligne (phase 5) qui restait cassée.

**Depuis que l'image a été déposée dans le projet** (fichier `images/decor-fond.png`,
référence mise à jour dans `sw.js` v8) : revérifié avec un service worker et des caches
entièrement purgés, sur un onglet neuf. `registration.active` bien présent, un seul
cache `defense-neon-v8` contenant les dix-neuf fichiers attendus (les dix-huit fichiers
de code/PWA plus `images/decor-fond.png`), aucune erreur console. L'installation/le mode
hors ligne fonctionne donc désormais pleinement.

### Écart par rapport au prompt

Comme pour la phase 7C, le prompt de cette sous-phase référençait `PALETTE.fondPrincipal`
pour la teinte du voile — `Config.PALETTE` n'existe toujours pas dans ce dépôt (voir
l'écart déjà documenté en phase 7C) ; utilisé `Config.COULEURS.fond` à la place, comme
partout ailleurs. `position: absolute` (esquissé dans le prompt pour `.image-decor`) a
été remplacé par `position: fixed`, pour véritablement correspondre au positionnement de
`#canvas-decor` comme demandé — ce dernier utilise `fixed`, pas `absolute` (voir la
phase 7C ci-dessus).

### Vérification

**Cas 1 — image absente** (testé en premier, avant l'ajout du fichier par l'utilisateur) :

- `console.warn` attendu bien affiché (une fois le piège de course ci-dessus corrigé) ;
- `#image-decor` reste à `opacity: 0` (`getComputedStyle`), jamais la classe
  `.image-decor--visible` ;
- skyline procédural inchangé, toujours visible et défilant normalement dans les marges ;
- aucune erreur JS autre que les 404 réseau intrinsèques à une ressource absente ;
- jeu pleinement fonctionnel malgré l'échec d'installation du service worker documenté
  ci-dessus (capture d'écran à l'appui : accueil, décor visible dans les marges, aucune
  apparence cassée).

**Cas 2 — image présente** (`images/decor-fond.png`, après ajout par l'utilisateur) :
retesté service worker et caches entièrement purgés, sur un onglet neuf.

- `#image-decor` : `complete: true`, `naturalWidth: 1408`, `naturalHeight: 768`, classe
  `.image-decor--visible` bien ajoutée (le correctif de piège de course fonctionne aussi
  dans le sens du succès, pas seulement de l'échec) ;
- capture d'écran à l'accueil et en cours de partie : image (ville néon sous la pluie)
  bien visible dans les marges, assombrie par `.voile-decor`, plateau et HUD pleinement
  lisibles et non déformés ; à travers les cases libres du plateau (rendues
  semi-transparentes par le correctif ci-dessous), on distingue en plus une légère
  transparence vers ce décor, cohérent avec ce correctif ;
- service worker : `registration.active` présent, cache `defense-neon-v8` contenant les
  dix-neuf fichiers attendus (voir section précédente) ;
- aucune erreur console sur un onglet neuf avec cache/service worker fraîchement purgés.
  (Deux 404 sur `decor-fond.webp` ont été observés une fois au cours des tests, mais
  confirmés être des entrées historiques de l'ancien nom de fichier conservées dans le
  journal réseau d'un onglet resté ouvert depuis avant le renommage — pas une erreur
  actuelle ; disparues dès la vérification refaite sur un onglet neuf.)

`getComputedStyle(image).opacity` a occasionnellement renvoyé `"0"` malgré la classe
`.image-decor--visible` déjà présente et un ordre des règles CSS pourtant vérifié correct
— écart resté sans conséquence sur le rendu réel (confirmé par capture d'écran), très
probablement une particularité de l'environnement de test sur onglet non premier-plan
(voir la même limitation déjà documentée pour `document.hidden`/`requestAnimationFrame`
plus bas dans ce document) plutôt qu'un bug du jeu — aucun signe similaire n'apparaît sur
les pixels réellement rendus.

## Transparence du plateau (correctif post-7C)

Rend le fond des cases libres du plateau semi-transparent, pour que le décor
d'arrière-plan (phase 7C ci-dessus) transparaisse légèrement à travers le plateau
lui-même — jamais sur les cases de chemin, qui restent pleinement opaques.

### Écart par rapport au prompt

Le prompt de ce correctif faisait référence à un objet `Config.PALETTE`
(`PALETTE.fondPrincipal`, `PALETTE.fondCase`, `PALETTE.chemin`...) et à une « image de
fond » posée par une « phase 7C bis » censée avoir déjà eu lieu. **Aucun des deux
n'existe dans ce dépôt** : vérifié à la fois par `git log` (aucun commit au-delà de ceux
déjà connus) et par recherche de `PALETTE`/`image` dans `js/` avant de commencer — la
seule mention de `PALETTE` dans tout le code est un commentaire expliquant pourquoi cet
objet n'a *pas* été créé en phase 7C (voir plus haut). La palette du jeu reste
`Config.COULEURS`, comme depuis la phase 4A, et il n'existait, *au moment de ce
correctif*, aucun système de chargement d'image d'arrière-plan — seul le skyline
procédural de la phase 7C servait de décor (lui-même toujours en attente de commit/push
à cette date). Le vrai prompt de la phase 7C bis (image de fond, voir la section dédiée
ci-dessus) a été retrouvé et traité juste après ce correctif : la remarque ci-dessus
reste donc un instantané exact de l'état du dépôt à l'instant où ce correctif a été
écrit, pas de son état final. Implémenté
en conséquence contre le code réel plutôt que contre les noms donnés par le prompt : les
deux nouvelles teintes ont été ajoutées à `Config.COULEURS` sous les noms
`fondTranslucide`/`caseLibreTranslucide` (qui correspondent aux propriétés existantes
`fond`/`caseLibre` qu'elles rendent translucides), avec les valeurs `rgba` exactes
demandées par le prompt. L'effet reste valable indépendamment de la nature du décor
affiché derrière (procédural aujourd'hui, une image le jour où elle existera) : la
transparence posée ici n'a aucune connaissance de ce qui se trouve sur le canvas de
décor, elle laisse simplement transparaître, en aval, quoi que ce soit.

### Modifications (`config.js`, `carte.js`)

`Config.COULEURS.fondTranslucide` (`'rgba(10, 14, 23, 0.7)'`) remplace `fond` pour le
remplissage de fond général du canvas dans `Carte.dessiner(ctx)` ;
`Config.COULEURS.caseLibreTranslucide` (`'rgba(18, 24, 43, 0.6)'`) remplace `caseLibre`
pour le remplissage des cases `'LIBRE'`/`'OCCUPEE'` (une tour est de toute façon dessinée
par-dessus). `fond` et `caseLibre` eux-mêmes ne sont pas modifiés, toujours utilisés tels
quels ailleurs si besoin (aucun autre appelant actuellement). Le remplissage des cases
`'CHEMIN'` (`Config.COULEURS.caseChemin`) et le liseré de grille (`Config.COULEURS.lisere`)
ne changent pas : c'est ce qui garantit que le décor ne transparaît jamais à travers le
tracé du chemin.

### Bug découvert et corrigé au passage : absence de `clearRect` (`jeu.js`)

`Jeu.dessinerTout()` ne vidait jamais le canvas de jeu avant de redessiner — sans
conséquence tant que `Carte.dessiner` recouvrait chaque frame l'intégralité du canvas
d'un fond pleinement opaque (`fillRect` en mode de composition par défaut
« source-over » *remplace* la destination quand la source est opaque). Avec des
remplissages semi-transparents, ce n'est plus le cas : une source translucide se
*compose* avec le contenu déjà présent sur le canvas plutôt que de le remplacer. Sans
`clearRect`, chaque frame ajoutait donc un peu plus d'opacité par-dessus celle,
déjà composée, de la frame précédente — jamais réinitialisée — et l'effet de
transparence convergeait visiblement vers l'opacité totale au bout de quelques secondes
de jeu réel (vérifié : après 300 frames simulées sans le correctif, une case libre
passait de l'alpha attendu (~225/255) à 255/255 plein). Détecté en vérifiant la
*stabilité* de l'effet dans le temps plutôt qu'une seule image, pas seulement sa
présence à l'instant du premier rendu. Corrigé par un `ctx.clearRect(0, 0,
this.canvas.width, this.canvas.height)` ajouté en tout début de
`Jeu.dessinerTout()` — `Decor.dessiner()` (phase 7C) le faisait déjà correctement dès le
départ, sur son propre canvas.

### Vérification

Testé en navigateur (serveur local), au niveau du pixel plutôt qu'à l'œil
(`ctx.getImageData` sur `Jeu.ctx`, à la fois immédiatement après le premier rendu et
après 300 frames simulées pilotées manuellement — même limite de `requestAnimationFrame`
en onglet non réellement au premier plan que pour la phase 7C ci-dessus) :

- **case libre** : alpha stable à 225/255 (≈ 0,88, cohérent avec la composition de
  `fondTranslucide` (0,7) puis `caseLibreTranslucide` (0,6) l'un sur l'autre — vérifié de
  façon isolée sur un `<canvas>` de test avant d'incriminer le pipeline de rendu réel),
  identique avant et après 300 frames — confirme que le correctif `clearRect` élimine
  bien la dérive vers l'opacité totale ;
- **case chemin** : alpha stable à 255/255 (pleinement opaque) dans les deux lectures —
  jamais traversée par le décor, comme attendu ;
- **lisibilité** : deux tours construites (crédits/son ajustés en console pour éviter
  l'erreur `AudioContext` déjà documentée en phase 4B — un contexte audio ne se crée
  qu'au premier clic réel sur Jouer, jamais présent dans ce test scripté) restent
  parfaitement lisibles à l'écran (halo, socle, chemin en pointillés) une fois la
  transparence en place — capture d'écran à l'appui.

**Piège de test rencontré et documenté pour de futures vérifications** : la première
tentative de vérification par pixel donnait un résultat incohérent (case libre à
l'ancienne couleur *opaque*, alpha 255 dès le premier rendu) — pas un bug du correctif,
mais le service worker (phase 5), déjà enregistré et actif dans cet onglet depuis les
vérifications de la phase 7C précédente, servant `carte.js`/`config.js` depuis son cache
(`cache-first`, voir `sw.js`) plutôt que depuis le disque fraîchement modifié. Résolu en
purgeant les caches et désenregistrant le service worker dans l'onglet de test avant de
recharger. `CACHE_NOM` incrémenté à `v6` en conséquence (`carte.js`, `config.js` et
`jeu.js` ont tous les trois changé) — sans quoi ce même correctif n'aurait jamais atteint
un appareil ayant déjà installé une version antérieure du jeu, exactement comme lors des
deux précédents oublis de version de cache.

Aucune erreur console dans aucun de ces scénarios.

## Confort en mode paysage sur mobile (correctif post-lancement)

Demande utilisateur : permettre au jeu de basculer confortablement en orientation
paysage sur téléphone. Le jeu l'autorisait déjà techniquement (`orientation: "any"`
dans `manifest.webmanifest`, jamais modifié), mais la mise en page ne le gérait pas :
tout était empilé verticalement (titre, bouton Son, canvas, HUD, barre de tours), pensée
pour un écran plus haut que large. En paysage sur téléphone (large mais bas), le canvas
— dimensionné jusqu'ici sur la seule largeur disponible, voir `Jeu.redimensionner()` —
débordait largement de la hauteur réelle de l'écran, forçant à faire défiler la page en
pleine partie : inconfortable sur un jeu qui demande des taps rapides et précis sur la
grille, à l'opposé du confort demandé.

### Ciblage (`style.css`, `jeu.js`)

`@media (orientation: landscape) and (max-height: 500px)` — cible les téléphones en
paysage (hauteur de viewport réduite, 320 à ~430px selon le modèle), pas les tablettes
ni les ordinateurs en paysage qui ont déjà assez de place verticale avec la mise en page
habituelle (une tablette en paysage dépasse 500px de haut, ex. iPad mini : 768px).
Dupliquée à l'identique côté JS (`Jeu.MEDIA_PAYSAGE_MOBILE`, lue par
`Jeu.enModePaysageMobile()`) plutôt que lue depuis une propriété CSS calculée : plus
simple, et les deux valeurs n'ont pas besoin d'une source unique partagée pour rester
synchronisées en pratique.

### Mise en page (`style.css`)

`body` passe en grille (`display: grid; grid-template-columns: 1fr 200px;`) uniquement
sous cette media query : colonne de gauche pour `.conteneur-canvas`, colonne de droite
(200px) pour le titre, le bouton Son, le HUD et la barre de sélection de tours. Une
grille plutôt que flex : elle permet de placer ces quatre éléments dans une colonne à
droite malgré leur ordre entrecoupé dans le DOM (`.conteneur-canvas` est physiquement
entre `#bouton-son` et `#barre-hud` dans `index.html`) sans avoir à les envelopper dans
un nouvel élément — chaque règle se contente de leur assigner une cellule de la grille
par numéro de ligne, indépendamment de leur position dans le HTML.

`.conteneur-canvas` s'étire sur toutes les lignes de la grille (`grid-row: 1 / -1`) :
c'est ce qui lui donne enfin une vraie hauteur mesurable par
`conteneur.clientHeight` dans `Jeu.redimensionner()`, au lieu de la laisser dériver du
canvas lui-même comme en mise en page habituelle (portrait, où le conteneur n'a pas de
hauteur propre). `#canvas-jeu` perd son étirement habituel (`width: 100%; height: auto`,
qui déformerait son ratio) au profit de `width/height: auto; max-width/max-height: 100%`
— il s'affiche alors à la taille exacte fixée par ses attributs `width`/`height` (posés
par le JS ci-dessous), `.conteneur-canvas` le centrant si un espace résiduel subsiste
dans un sens ou dans l'autre.

### Plafond de hauteur du canvas (`jeu.js`)

`Jeu.redimensionner()` continue de calculer une largeur/hauteur à partir de
`conteneur.clientWidth` comme avant (portrait, desktop — comportement inchangé), mais
plafonne désormais aussi le résultat par `conteneur.clientHeight` **uniquement** quand
`Jeu.enModePaysageMobile()` renvoie vrai. Ce garde-fou est indispensable : hors de ce
mode, `.conteneur-canvas` n'a pas de hauteur propre (elle dérive du rendu précédent du
canvas), donc lire `clientHeight` sans cette condition renverrait une valeur non
significative — et au tout premier appel, avant que le canvas n'ait jamais été
dimensionné, une hauteur de 0, qui figerait le jeu. Le calcul reste un simple
« contenir dans la boîte disponible en conservant le ratio COLONNES:LIGNES », comme pour
la largeur seule en portrait, juste appliqué aux deux dimensions à la fois ici.

### Débordement de la colonne latérale (`style.css`)

Sur les plus petits téléphones visés par cette media query, le contenu de la colonne de
droite (HUD complet + trois types de tours) peut rester plus haut que l'écran malgré sa
mise en page compacte (mesuré : jusqu'à 43px de trop sur un viewport de 375px de haut
avec les trois tours du jeu actuel). Plutôt que de forcer un `overflow: hidden` qui
rendrait le bas de cette colonne définitivement inaccessible, la page est laissée libre
de s'allonger et de défiler dans ce cas (`body` en `min-height: 100dvh`, pas de hauteur
fixe). Pour que ce défilement ne fasse pas aussi défiler le plateau de jeu hors champ —
inacceptable en pleine partie — `.conteneur-canvas` reçoit `position: sticky; top: 8px`
et un `max-height: calc(100dvh - 16px)` : il reste épinglé à l'écran et ne peut jamais
dépasser la hauteur réelle du viewport, quelle que soit la hauteur que la grille prend
par ailleurs à cause de la colonne de droite. Le joueur peut alors faire défiler
uniquement la colonne HUD/tours pour atteindre un bouton qui déborderait, sans jamais
perdre de vue le plateau.

L'écran d'accueil (le plus dense des trois écrans superposés — niveau/XP, cinq paliers
de bonus, boutons de durée) profite du même traitement défensif :
`.ecran-superpose { overflow-y: auto; }` sous cette media query, pour qu'un défilement
interne à cet écran (plutôt que de la page entière, qui décalerait aussi le plateau)
absorbe le cas où son contenu resterait malgré tout plus haut que l'espace, désormais
généreux mais pas infini, que lui laisse le canvas dans cette mise en page.

### Écart par rapport au prompt

Aucun prompt écrit pour cette demande — formulée directement en conversation
(« permettre au jeu de se mettre en vue horizontale »), sans attente de nom d'objet ou
de structure de code particulière à respecter.

### Vérification

Testé en navigateur (serveur local) à plusieurs tailles, en repartant à chaque fois d'un
service worker et de caches purgés :

- **812×375** (téléphone courant en paysage) : accueil et partie en cours, canvas
  correctement plafonné en hauteur (588×352, tient dans les 359px disponibles), colonne
  de droite entièrement lisible (HUD + trois types de tours), aucun débordement de page
  détecté à l'affichage initial ;
- **568×320** (iPhone SE en paysage, cas le plus exigu couramment répandu) : canvas
  toujours proportionné (344×206), aucun débordement horizontal ; débordement vertical
  résiduel de 98px (contenu HUD/tours plus dense que l'espace disponible) absorbé par le
  défilement de page + `.conteneur-canvas` épinglé (`position: sticky`) — vérifié par
  géométrie (`getBoundingClientRect().top` reste à 8 après un défilement complet) que le
  plateau ne bouge pas pendant que la colonne défile, et que le troisième bouton de tour
  (« Sniper »), initialement hors champ, devient entièrement visible une fois défilé ;
- **375×812** (portrait mobile) et résolution desktop : rendu identique à avant ce
  correctif, aucune régression — la media query ne les cible pas.

**Piège de test rencontré** : une capture d'écran prise juste après un défilement à la
molette (`computer scroll`) a montré une fois le plateau semblant occuper toute la
largeur de l'écran, sans colonne latérale visible, en contradiction avec la géométrie
lue au même instant (`getBoundingClientRect` confirmant une colonne de droite bien
présente et dimensionnée). Un défilement programmatique équivalent
(`window.scrollTo`) sur un onglet fraîchement rechargé a produit une capture cohérente
avec la géométrie mesurée. Conclusion : artefact ponctuel de capture d'écran de cet
environnement de test (déjà observé sous d'autres formes pour ce projet — voir les
limites de `requestAnimationFrame`/`document.hidden` en onglet non réellement au premier
plan, phase 7C ci-dessus), pas un bug de la mise en page elle-même.

## Son du tir du Canon inaudible (correctif post-lancement)

Signalé par l'utilisateur : « les tirs [du Canon] n'émettent pas de son ».

### Diagnostic

Pas un bug de code : `Tour.tirer()` appelle bien `Son.jouerTir(this.type)` sans
condition pour les trois types de tours (voir « Particules et son (phase 4B) »
ci-dessus), et rien dans `Son.jouerTir` ne traite `'canon'` différemment d'un point de
vue logique. Vérifié directement dans le navigateur en instrumentant l'API Web Audio
(`AudioContext.state` à `running`, événements `oscillator.frequency.setValueAtTime` et
`gain.gain.exponentialRampToValueAtTime` bien programmés aux valeurs attendues,
`tour.tirer()` appelé sur une vraie instance de `Tour` sans lever d'exception) : le son
du Canon se déclenchait donc bel et bien à chaque tir, exactement comme pour les deux
autres types.

Le problème est resté acoustique plutôt que logique : le Canon utilisait une onde
sinusoïdale pure (`typeOnde: 'sine'`) à 180 Hz, une fréquence grave sans le moindre
harmonique. Les haut-parleurs de téléphone et d'ordinateur portable — contrairement à un
haut-parleur avec caisson de basses — reproduisent très mal les fréquences graves
*et* n'ont, pour un sinus pur, aucune harmonique plus aiguë sur laquelle se rattraper :
le son est correctement joué par le navigateur, mais quasiment inaudible en pratique sur
ce type d'appareil. Les deux autres tirs n'ont jamais eu ce problème : la Mitrailleuse
(1100 Hz, onde carrée) et le Sniper (1900 Hz, onde en dents de scie) sont à la fois plus
aigus et construits sur des formes d'onde riches en harmoniques, largement dans la zone
que ces haut-parleurs reproduisent bien.

### Correctif (`son.js`)

`Son.jouerTir('canon')` remplacé par une onde triangle (harmoniques impaires, mieux
reproduite par un petit haut-parleur qu'un sinus tout en restant plus « sourde » qu'un
carré) avec un glissando descendant 220 Hz → 90 Hz sur 0,16 s, plutôt qu'une note fixe à
180 Hz. Reste la tonalité la plus grave et la plus longue des trois tirs (cohérent avec
un tir de canon plus lourd), mais démarre maintenant sur une fréquence assez haute pour
être effectivement reproduite, le glissando vers le grave n'intervenant qu'une fois le
son déjà perceptible.

### Vérification

Testé en navigateur (serveur local), par instrumentation de l'API Web Audio plutôt qu'à
l'oreille (aucune sortie audio dans cet environnement de test) : `oscillator.type` vaut
bien `'triangle'` au moment de `start()`, `frequency.setValueAtTime(220, …)` puis
`exponentialRampToValueAtTime(90, … + 0.16)` programmés comme attendu, sur un appel
`tour.tirer(...)` réel (instance de `Tour` de type `'canon'`, pas seulement
`Son.jouerTir` isolé) sans aucune erreur console. Mitrailleuse et Sniper revérifiés en
parallèle : toujours `'square'`/`'sawtooth'` à leurs fréquences d'origine, aucune
régression. `CACHE_NOM` incrémenté à `v10` (`son.js` a changé).

## Silhouettes robotiques (phase 7A)

Remplace le rendu des ennemis — un simple cercle coloré depuis la phase 4A — par de
véritables silhouettes de châssis robotiques, distinctes pour chacun des trois types
existants. Purement visuel : aucune donnée de gameplay (points de vie, vitesse, dégâts,
ciblage) ne change.

### Vue du dessus, pas des personnages (`ennemi.js`)

Le plateau (carte, tours) est vu du dessus depuis la phase 1A : un robot en personnage
de profil n'aurait aucun sens sous cet angle. Les trois châssis sont donc conçus comme de
petits véhicules/drones au sol vus depuis une caméra aérienne — un corps polygonal plein,
jamais de jambes ni de silhouette humanoïde.

### Orientation (`Ennemi.deplacer`, `Ennemi.dessiner`)

Nouvelle propriété `this.angleDirection` (radians, via `Math.atan2`), recalculée à
chaque frame dans `deplacer()` à partir du même vecteur direction que le déplacement
lui-même — avant même de savoir si le pas de cette frame atteindra le point de passage
visé, pour qu'un virage fasse tourner le châssis dès qu'il s'y engage. Initialisée aussi
dans le constructeur (même calcul, vers le premier point de passage) : `Vagues.mettreAJour`
(qui crée les ennemis) est appelée après la boucle de déplacement dans `Jeu.simuler()`, un
ennemi tout juste apparu n'a donc pas encore eu de `deplacer()` au moment de son tout
premier `dessiner()`, dans la même frame.

`dessiner()` applique `ctx.translate(this.x, this.y)` puis `ctx.rotate(this.angleDirection)`
avant de dessiner le châssis, entouré d'un `ctx.save()`/`ctx.restore()` : la barre de vie,
dessinée après `restore()` avec les coordonnées absolues `this.x`/`this.y` comme avant
cette phase, reste ainsi toujours horizontale, quelle que soit l'orientation du robot en
dessous — vérifié explicitement au pixel (`getImageData`) sur un ennemi tourné à 90°, pas
seulement à l'œil.

### Les trois châssis (`ennemi.js`)

Tous dessinés en coordonnées locales (après translate/rotate ci-dessus, +x = toujours
l'avant du châssis) avec `beginPath`/`lineTo`/`arc`, sans image. Taille globale dérivée du
même `rayon` qu'avant (fonction des points de vie de base du type) pour rester comparable
aux anciens cercles.

- **Standard (cyan)** : hexagone légèrement allongé dans le sens de la marche
  (`dessinerHexagone`, un helper partagé avec le Blindé — même principe que
  `Tour.dessinerSoclePolygone`), capteur circulaire clair pointant vers l'avant, deux
  chenilles latérales sombres de part et d'autre du corps.
- **Rapide (jaune)** : profil effilé en flèche mousse (un polygone à cinq sommets : nez
  pointu, épaules larges, arrière tronqué), plus étroit et plus long que le Standard, sans
  chenilles ; un petit accent triangulaire clair à l'arrière évoque un réacteur.
- **Blindé (orange)** : hexagone large et trapu (peu allongé, contrairement au Standard),
  deux plaques d'armure latérales sombres en léger surplomb du corps, capteur central
  plus gros que celui du Standard.

Teintes claires/sombres dérivées de la couleur de base de chaque type via deux nouvelles
tables, `COULEURS_CSS_ENNEMIS_CLAIR`/`_SOMBRE` — volontairement incomplètes (seules les
entrées réellement utilisées existent ; le Rapide n'a pas de partie sombre, pas de
chenilles).

`// PHASE 7F :` laissé dans `Ennemi.dessiner()`, à l'endroit où un futur quatrième châssis
(drone volant, plus anguleux et aérien) viendrait s'ajouter aux trois ci-dessus.

### Écart par rapport au prompt : halo retiré (`config.js`, `ennemi.js`)

Le prompt de cette phase affirmait que « la règle de performance posée en phase 4A »
excluait déjà tout `shadowBlur` sur les ennemis. **Ce n'était pas le cas** : `Ennemi.dessiner`
posait bien un halo (`Config.HALO_FLOU_ENNEMI`, retiré aussitôt après comme pour les
tours) depuis la phase 4A elle-même — vérifié directement dans le code avant de commencer,
et documenté comme tel dans ce fichier (« seuls les éléments peu nombreux par frame
(tours, ennemis, départ/arrivée) portent un halo »). L'instruction du prompt (aucun
`shadowBlur` sur ces nouvelles formes) a néanmoins été suivie, mais pour la vraie raison
suivante plutôt que celle avancée par le prompt : un ancien ennemi ne coûtait qu'un seul
appel de `shadowBlur` (un cercle) ; chaque nouveau châssis se compose de plusieurs formes
(corps, capteur, chenilles ou plaques) — y poser un halo sur chacune aurait multiplié ce
coût par autant de formes et par ennemi, jusqu'à 60 à l'écran (le seuil de fluidité visé).
`Config.HALO_FLOU_ENNEMI` est donc supprimé (dernière utilisation retirée), et le
commentaire de `Config.HALO_FLOU_TOUR_BASE` mis à jour en conséquence (voir « Identité
visuelle cyberpunk (phase 4A) » ci-dessus, désormais corrigée pour refléter cet historique
exact plutôt que la version que le prompt en donnait).

### Vérification

Testé en navigateur (serveur local) :

- **orientation** : ennemis construits directement (contournant `Vagues`) avec un
  `angleDirection` fixé à plusieurs valeurs (0, ±90°, 180°) puis dessinés sur un canvas de
  test agrandi (`Carte.tailleCase` porté à 140px temporairement, pour juger des détails à
  l'œil) — capteur et chenilles/plaques suivent bien la rotation. Confirmé au pixel
  (`getImageData`) plutôt qu'à l'œil pour deux orientations (0° et 90°) sur le Standard :
  le capteur clair se déplace exactement à l'endroit attendu (avant du châssis dans les
  deux cas), les chenilles sombres passent de haut/bas à gauche/droite en conséquence ;
- **barre de vie** : vérifiée au pixel sur l'ennemi tourné à 90° — reste bien horizontale
  (dégradé vert → gris de gauche à droite), non affectée par la rotation du châssis ;
- **reconnaissance des trois types** : les trois châssis testés côte à côte à la taille
  réelle du jeu (canvas standard, sans agrandissement) restent distinguables par leur
  forme et leur taille relative, pas seulement leur couleur — vérifié à la fois en
  résolution desktop et en portrait mobile (375px de large) ;
- **fluidité à 60 ennemis** : 60 instances (mélange des trois types) pilotées sur 120
  frames simulées manuellement (limite de `requestAnimationFrame` sur onglet non
  réellement au premier plan, déjà documentée plus haut) — 1,10 ms en moyenne par frame
  pour la boucle complète (déplacement, ciblage, rendu de tous les ennemis), largement
  sous le budget de 16,6 ms d'une image à 60 fps ;
- **ciblage des tours** : une tour construite à proximité d'un ennemi cible et tire
  normalement (`tour.cible` non nul, un projectile activé) — aucune régression sur cette
  mécanique, comme demandé ;
- **aucune erreur console** dans tous les scénarios ci-dessus, y compris la vague réelle
  (`Vagues.demarrer`) jouée sur plusieurs centaines de frames simulées.

**Résumé demandé par le prompt** : oui, les trois silhouettes restent distinguables à la
taille réelle du jeu, y compris sur un petit écran (375px de large, testé) — la
différence de forme globale (hexagone allongé cyan, flèche jaune, hexagone large orange)
et de taille (le Blindé est nettement plus gros, sa taille dérivant déjà de ses points de
vie plus élevés) porte l'essentiel de la reconnaissance à cette échelle ; les détails plus
fins (capteur, chenilles/plaques) restent, eux, surtout visibles de près (capture d'écran
agrandie à l'appui) mais ne sont pas nécessaires pour distinguer les trois types au
premier coup d'œil en jeu.

## Chemins façon route (phase 7B)

Restylise le rendu des cases de chemin pour qu'elles ressemblent à une véritable route
urbaine (asphalte, trottoirs, ligne centrale) plutôt qu'un simple aplat de couleur.
Purement visuel, aucune donnée de gameplay ne change ; réutilise le tracé animé par
chemin (4A/6A) et la transparence du plateau (7C bis).

### Trottoirs par détection de voisinage (`carte.js`)

Plutôt qu'un contour géométrique lissé le long de la courbe du chemin (bien plus
complexe à gérer proprement sur des virages et des croisements qu'une décoration ne le
justifie), `Carte.calculerSegmentsBordure()` exploite le fait que le plateau est déjà une
grille : pour chaque case de chemin, chacune de ses 4 arêtes devient un trottoir
seulement si la case voisine de ce côté n'appartient à aucun chemin (ou est hors grille).
Calculée une seule fois par `generer()`, juste après que la grille définitive soit connue
— jamais recalculée en boucle par `dessiner()`, qui se contente de multiplier des
coordonnées de case déjà connues par `tailleCase` à chaque frame (même principe que le
reste de la grille, aucun recalcul de géométrie). Stockée en unités de case
(`{ colonne, ligne, arete }`), pas en pixels, pour rester valide quel que soit le
redimensionnement du canvas.

Un seul `beginPath()`/`stroke()` pour la totalité des segments (jusqu'à une centaine sur
une carte à deux chemins), pas un appel par segment.

### Texture d'asphalte (`carte.js`)

`Carte.genererTachesAsphalte()` sème `Config.NOMBRE_TACHES_PAR_CASE_CHEMIN` petites
taches par case de chemin (position et rayon en fraction de case, pas en pixels absolus
— même raison que les trottoirs ci-dessus). Tirées via `Aleatoire`, pas `Math.random()` :
contrairement au décor de la phase 7C (purement scénographique, jamais lu par le reste du
jeu), cette texture fait partie du rendu de la carte elle-même et doit rester
reproductible à graine égale, comme le tracé du chemin. Appelée après que la génération
des chemins ait fini de consommer ses propres tirages (nombre variable d'une tentative à
l'autre) : peu importe combien elle en a consommé, `genererTachesAsphalte()` reprend la
même suite là où elle en était, donc à un point déterministe pour une graine donnée —
vérifié directement (`Carte.generer(graine)` appelé deux fois de suite avec la même
graine produit un tableau de taches strictement identique, comparé en JSON).

### Ordre de dessin (`Carte.dessiner`)

Aplat d'asphalte pour chaque case de chemin (remplace l'ancien aplat uni
`Config.COULEURS.caseChemin`, retiré) → une fois **toutes** les cases remplies (chemin
et libres), passe séparée pour les taches d'usure, puis pour les segments de trottoir →
ligne centrale animée par-dessus → marqueurs départ/arrivée (déjà dans la boucle
existante). Taches et trottoirs ne sont dessinés qu'après coup, jamais dans la même
passe que le remplissage des cases, pour une raison précise : un élément dessiné sur sa
propre case pendant cette première passe risquerait d'être partiellement recouvert par
l'aplat opaque d'une case voisine dessinée juste après dans le même balayage ligne par
ligne — en particulier au bord partagé entre deux cases de chemin adjacentes, exactement
là où les trottoirs ne doivent jamais apparaître.

### Écart par rapport au prompt : liseré générique retiré des cases de chemin (`carte.js`)

Non demandé explicitement par le prompt, mais nécessaire pour respecter ses propres
critères d'acceptation (virage « propre, sans trou ni chevauchement disgracieux »,
croisement où « la route continue proprement »). Le liseré de grille générique
(`Config.COULEURS.lisere`, `strokeRect` sur les 4 arêtes de chaque case) restait
auparavant dessiné sur toutes les cases sans distinction. Conservé tel quel sur les cases
libres/occupées (toujours nécessaire pour repérer la grille constructible), mais
désormais sauté sur les cases de chemin : le laisser aurait dessiné un fin contour sur
les arêtes *intérieures* de la route (entre deux cases de chemin adjacentes, y compris à
l'intérieur d'un virage ou d'un croisement) — exactement les coutures que
`calculerSegmentsBordure()` s'attache à ne pas tracer. Les trottoirs en tiennent lieu
pour les cases de chemin, sur leurs seules arêtes extérieures.

`Config.COULEURS.caseChemin` (l'ancien aplat, `'#33334a'`) supprimé une fois plus
référencé nulle part, comme demandé. Les trois nouvelles teintes
(`asphalte`/`bordureRoute`/`tacheAsphalte`) ajoutées dans `Config.COULEURS` plutôt que
dans un objet `Config.PALETTE` séparé comme l'esquissait le prompt — même écart, pour la
même raison, que celui déjà documenté pour le décor (7C) et l'image de fond (7C bis).

### Ligne centrale amincie (`carte.js`)

Épaisseur du tracé animé réduite de moitié (`taille * 0.1` → `taille * 0.05`, plancher à
2px conservé) : à l'ancienne épaisseur, la ligne occupait une bonne partie de la largeur
de la route et se lisait comme un large faisceau plutôt qu'un marquage au sol. Logique
d'animation (`lineDashOffset`) et couleur par chemin (`Config.COULEURS.cheminsNeon`)
inchangées.

### Vérification

Testé en navigateur (serveur local), à la fois visuellement et en inspectant directement
les données produites (plus fiable qu'un jugement à l'œil pour une intersection large de
quelques pixels seulement) :

- **ligne droite** : segments de trottoir uniquement sur les deux arêtes perpendiculaires
  au sens du tracé, jamais sur les deux arêtes dans le sens de la marche — confirmé
  visuellement sur plusieurs graines ;
- **virage** : une case de virage retrouvée par analyse du tracé ordonné (changement
  d'axe horizontal ↔ vertical entre deux pas) porte exactement 2 segments de trottoir,
  sur ses deux arêtes extérieures — un L propre, ni trou ni chevauchement ;
- **croisement le plus serré possible** : recherche automatique parmi 500 graines d'un
  croisement réduit à une seule case partagée (graine 4, case (11, 7)) — ses 4 voisines
  sont bien toutes `'CHEMIN'` et elle ne porte **aucun** segment de trottoir, confirmé
  directement sur `Carte.segmentsBordure`. Un croisement plus large (graine 1, deux
  chemins se chevauchant sur 14 cases) donne le même résultat à plus grande échelle :
  route continue, aucun trottoir intérieur, capture d'écran agrandie à l'appui ;
- **reproductibilité** : `Carte.generer(4)` appelé deux fois de suite produit des
  tableaux `tachesAsphalte` et `segmentsBordure` strictement identiques (comparaison
  JSON) ;
- **transparence du plateau (7C bis)** : vérifié au pixel — une case libre reste à
  alpha 225/255 (translucide, valeur inchangée depuis le correctif de la phase 7C), une
  case de chemin (hors ligne centrale/tache) est à `rgb(35, 38, 46)` = `Config.COULEURS.
  asphalte` exact, alpha 255 (pleinement opaque) ;
- **fluidité** : 60 ennemis simulés sur 180 frames avec la nouvelle carte (110 segments
  de trottoir, 180 taches sur cette graine) — 0,35 ms en moyenne par frame pour la boucle
  complète, aucune perte de fluidité mesurable ;
- **aucune erreur console** dans tous les scénarios ci-dessus.

**Résumé demandé par le prompt** : oui, l'effet de trottoir reste convaincant même sur
l'intersection la plus serrée observée (une seule case partagée entre les deux chemins,
graine 4) — la route y reste visuellement continue dans les deux directions, sans aucun
trottoir parasite traversant l'intersection, exactement le comportement attendu d'un
vrai carrefour. Testé sur plusieurs dizaines de graines différentes (génération
automatisée pour trouver des cas serrés) sans jamais observer de trou ni de
chevauchement disgracieux, y compris quand deux chemins se chevauchent sur une longue
portion plutôt qu'un simple point de croisement.

## Flux animé masqué en vague (correctif post-7B)

Demande utilisateur : faire disparaître les pointillés animés (la ligne centrale de
chaque route, phase 6A/7B) une fois qu'une vague est lancée.

### Implémentation (`carte.js`)

Le tracé animé (`ctx.setLineDash`/`lineDashOffset`) n'est désormais dessiné que si
`!Vagues.enCours`, relu à chaque frame comme le reste de `Carte.dessiner()` — aucun état
propre à gérer : le tracé réapparaît de lui-même dès qu'une vague se termine
(`Vagues.enCours` repasse à `false`), sans rien de spécial à faire à ce moment-là.
N'affecte que ce tracé précis : l'asphalte, les trottoirs, les taches d'usure et les
marqueurs de départ/arrivée (avec leur halo) restent dessinés normalement, vague en
cours ou non — seul le repère de flux, pensé pour se lire au calme (accueil, entre deux
vagues), disparaît une fois que de vrais ennemis avancent réellement sur la route et
rendent ce repère superflu.

### Vérification

Testé en navigateur (serveur local) : tracé animé bien visible avant tout lancement de
vague (écran d'accueil, entre deux vagues) ; disparaît dès `Vagues.demarrer(...)`
appelé (`Vagues.enCours` passe à `true`) — asphalte, trottoirs et marqueurs
départ/arrivée restent affichés normalement, capture d'écran à l'appui ; réapparaît
immédiatement une fois `Vagues.enCours` repassé à `false` (fin de vague). Aucune erreur
console.

## Tour Flak (phase 7D)

Quatrième type de tour, à dégâts de zone plutôt qu'à cible unique — et future seule tour
capable de viser un ennemi volant (phase 7F, hors périmètre ici). Dégâts unitaires
volontairement modestes (comparables à la Mitrailleuse, voir `Config.TYPES_TOURS.flak`) :
sa valeur ne vient pas d'un gros dégât sur une cible mais du fait qu'elle touche
potentiellement plusieurs ennemis à la fois — même principe que la portée du Sniper
(phase 2A) : sa force ne se lit pas dans un simple ratio dégâts/coût.

### `typeDegats`, explicite pour les quatre types (`config.js`, `tour.js`)

`Config.TYPES_TOURS` porte désormais un `typeDegats` (`'unique'` ou `'zone'`) pour
chaque type, y compris les trois existants (auparavant implicite) : `Tour.typeDegats`
le lit à la construction comme `degatsBase`, jamais recalculé (le type de dégâts d'une
tour ne change jamais avec son niveau), et `Tour.tirer()` le transmet au projectile à
l'activation.

### Dégâts de zone (`tour.js`)

Changement de signature : `Projectile.mettreAJour(dt)` devient
`Projectile.mettreAJour(dt, ennemisActifs)` — répercuté dans `Jeu.simuler` (jeu.js) et
dans `outils/simulation-equilibrage.js` (qui duplique cette boucle pour ses propres
besoins), pour tous les projectiles, pas seulement ceux du Flak : les trois autres
types reçoivent ce paramètre sans jamais s'en servir, comportement inchangé pour eux
(vérifié explicitement, voir Vérification ci-dessous).

À l'impact, `Projectile.mettreAJour` bifurque sur `this.typeDegats` : `'unique'` garde
le comportement d'avant (seule `this.cible` reçoit les dégâts) ; `'zone'` parcourt
`ennemisActifs` une seule fois et applique `subirDegats(this.degats)` à tout ennemi
vivant à moins de `Config.FLAK_RAYON_EXPLOSION * Jeu.facteurEchelle` du point d'impact
réel (`this.x`/`this.y`, pas la position de `this.cible`) — un seul passage sur le
tableau garantit qu'un ennemi ne peut être compté qu'une fois par explosion, sans filet
de sécurité supplémentaire à écrire. `Particules.creerExplosion` est déclenchée à chaque
impact de Flak, avec `Config.PARTICULE_NOMBRE_EXPLOSION_ZONE` (16, plus fourni qu'une
explosion de mort ordinaire) particules, **inconditionnellement** — même si personne
n'est touché, pour que le joueur voie toujours où se situe la zone d'effet.
`Particules.creerExplosion(x, y, couleur, nombre)` accepte désormais ce quatrième
paramètre optionnel (par défaut `Config.PARTICULE_NOMBRE_EXPLOSION`, comportement
inchangé pour la mort d'un ennemi).

### Silhouette (`tour.js`)

Carré large (`dessinerSoclePolygone(ctx, taille * 0.38, 4, Math.PI / 4)`) et quatre
canons courts en éventail, chacun décalé de 45° du suivant autour de l'angle de visée
(±22,5° et ±67,5°, pas quatre canons répartis à 90° sur tout le pourtour qui ne
pointeraient pas vers la cible comme les trois autres types) — évoque une batterie
antiaérienne à tir multiple. Teinte `Config.COULEURS.neonVert` (`'#7fff6b'`, militaire/
toxique, distincte des trois couleurs de tour existantes). Même indicateur de niveau
que les trois autres types (intensité du halo, `Config.HALO_FLOU_TOUR_PAR_NIVEAU`) —
partagé par tous les types via le code commun de `dessiner()`, aucun code spécifique à
écrire pour le Flak.

**Piège de rotation rencontré en testant** : `dessinerSoclePolygone(ctx, rayon, 4, 0)`
(cotes=4, sans rotation) produit un **losange** (sommets aux quatre points cardinaux),
pas un carré — vérifié à l'écran avant de choisir la valeur finale. `rotation =
Math.PI/4` donne au contraire un carré aux côtés bien à plat, la forme demandée par le
prompt (« un socle carré ») ; c'est la même rotation que celle déjà utilisée par la
Mitrailleuse, dont le commentaire de phase 4A la décrit pourtant comme un « losange »
— inexact depuis cette phase, sans lien avec le travail actuel, non corrigé ici (hors
périmètre de cette sous-phase). Rester distinct de la Mitrailleuse à l'écran vient donc
de la taille (0,38 contre 0,32), de la couleur et du nombre de canons, pas de
l'orientation du socle lui-même — confirmé par une capture des quatre types de tour
côte à côte.

### Écart par rapport au prompt : indicateur de niveau « en encoches »

Le prompt demandait d'appliquer « le même indicateur de niveau en encoches que les
autres tours (phase 4A, section 3) ». **Aucun système d'encoches n'existe dans ce
dépôt** (vérifié : aucune occurrence de « encoche » dans le code ni dans ce document) —
le seul indicateur de niveau réellement posé en phase 4A est l'intensification du halo
néon (`Config.HALO_FLOU_TOUR_PAR_NIVEAU`, voir `Tour.dessiner`). Appliqué tel quel au
Flak, comme aux trois autres types, puisque c'est le mécanisme partagé et générique déjà
en place — même nature d'écart que les précédentes références à un `Config.PALETTE` ou
une phase antérieure qui n'existaient pas non plus dans ce dépôt.

### Barre de sélection et systèmes existants (`interface.js`)

Aucune modification : `Interface.initialiser()` génère déjà les boutons de type de tour
en itérant sur `Object.entries(Config.TYPES_TOURS)`, et le coût, le grisage (crédits
insuffisants, limite de tours de la phase 6B) et l'aperçu de portée au survol lisent
tous `Config.TYPES_TOURS[type]`/`this.typeSelectionne` de façon générique — le Flak est
donc apparu de lui-même dans la barre, sans changement de code, dès l'ajout de son
entrée dans `Config.TYPES_TOURS`. Même constat pour l'amélioration, la vente
(`Tour.coutAmelioration`/`ameliorer`/`montantVente`) et les bonus de progression
(`Progression.multiplicateurDegats`/`multiplicateurCoutConstruction`/
`multiplicateurCoutAmelioration`) : tous génériques, aucun ne fait référence à un type
précis.

### Hors périmètre (`tour.js`)

Commentaire `// PHASE 7F :` laissé dans `Tour.chercherCible`, à l'endroit où il faudra
exclure les ennemis volants du ciblage des tours qui n'ont pas la capacité de les
viser — le Flak sera la seule exception. Rien codé pour l'instant, aucun ennemi volant
n'existe encore.

### Vérification

Testé en navigateur (serveur local) :

- **silhouette** : les quatre types de tour rendus côte à côte à taille agrandie —
  Flak nettement distinct par la taille, la couleur et l'éventail de quatre canons,
  capture d'écran à l'appui (voir aussi le piège de rotation ci-dessus) ;
- **dégâts de zone** : projectile de test activé avec `typeDegats: 'zone'` au milieu de
  trois ennemis factices (deux à moins du rayon d'explosion, un hors de portée, un déjà
  mort) — les deux ennemis proches perdent chacun exactement `this.degats` une seule
  fois, l'ennemi lointain et l'ennemi mort ne reçoivent rien, 16 particules créées
  (`PARTICULE_NOMBRE_EXPLOSION_ZONE`) ;
- **un seul passage par explosion** : garanti par construction (une seule itération sur
  `ennemisActifs`, chaque ennemi n'y apparaissant qu'une fois) plutôt que vérifié par un
  scénario de test dédié — la boucle ne permet structurellement pas un double comptage ;
- **régression des trois types existants** : même scénario avec un projectile
  `typeDegats: 'unique'` — seule la cible verrouillée perd des points de vie, un ennemi
  non ciblé à 5px de l'impact n'est pas affecté, comportement strictement identique
  à avant cette phase ;
- **en conditions de jeu réelles** (pas seulement des projectiles isolés) : Flak
  construit via `Interface.tenterConstruireTour`, vague réelle lancée via
  `Vagues.demarrer`, trois ennemis groupés devant la tour perdent chacun exactement
  20 PV (dégâts de base) après un tir naturel passé par `chercherCible`/`tirer` — le
  chemin complet fonctionne, pas seulement la logique d'impact isolée ;
- **amélioration/vente/bonus de progression (section 5 du prompt)** : un Flak réel
  amélioré du niveau 1 à 7 via `Interface.ameliorerTourSelectionnee()` (dégâts, cadence
  et portée progressent exactement comme les autres types) ; palier de bonus
  `bonus_degats` (niveau de joueur 16, +20 %) vérifié appliqué à son `degats` recalculé
  (ratio exact 1,2) ; palier `reduction_construction` (-5 %) vérifié sur son coût de
  construction (80 → 76) ; vente via `Interface.vendreTourSelectionnee()` : montant
  remboursé exact (`investissementTotal * VENTE_POURCENTAGE_REMBOURSEMENT`), tour
  retirée, case redevenue `'LIBRE'` — tout, sans une seule ligne de code spécifique au
  Flak dans ces systèmes ;
- **fluidité** : 8 tours Flak actives simultanément contre 60 ennemis groupés en
  grappes (scénario dense), 300 frames simulées — 0,52 ms en moyenne par frame pour la
  boucle complète, aucune perte de fluidité mesurable ;
- **aucune erreur console** dans tous les scénarios ci-dessus (un message d'erreur
  rencontré en cours de route provenait d'un artefact du propre test précédent —
  des ennemis factices sans méthode `deplacer()` laissés dans `Jeu.ennemisActifs`
  et repris par la boucle `requestAnimationFrame` naturelle du jeu entre deux appels
  de script — confirmé sans rapport avec le code livré en reproduisant le même
  scénario réaliste sur un onglet fraîchement ouvert, sans aucune erreur).

**Résumé demandé par le prompt** : oui, le rayon d'explosion (45px de référence) et les
dégâts (20 par ennemi touché) semblent cohérents contre un groupe rapproché — dans le
test à 60 ennemis groupés en grappes de 4 espacées de 6px, une seule explosion touchait
systématiquement plusieurs ennemis de la même grappe, produisant un dégât total par tir
largement supérieur à celui d'une Mitrailleuse (10) ou même d'un Canon (45) dès que deux
ennemis ou plus se trouvaient dans le rayon — tout en restant, comme voulu, la tour la
moins intéressante contre un ennemi strictement isolé (20 dégâts pour un coût de 80,
contre 45 pour 70 chez le Canon). Le rayon (45px à l'échelle de référence, un peu plus
d'une case de 40px) semble bien calibré : assez large pour toucher une grappe serrée
typique d'un chemin étroit, sans pour autant couvrir une zone si grande qu'elle
toucherait systématiquement des ennemis sur un chemin voisin au niveau d'un croisement
(phase 6A/7B).

## Tour Caserne (phase 7E)

Cinquième type de tour, le plus différent des quatre précédents : elle ne tire jamais.
Elle fait apparaître une unité statique (`UniteCaserne`, `unite.js`) qui bloque
physiquement une case de chemin et combat au corps à corps ce qui s'y presse, avec
réapparition différée si elle est détruite.

### Placement contraint à un chemin adjacent (`carte.js`, `interface.js`)

`Carte.estAdjacentAUnChemin(colonne, ligne)` (vraie si au moins une des 4 voisines
orthogonales est une case de chemin) conditionne la construction d'une Caserne dans
`Interface.tenterConstruireTour` — uniquement pour ce type, en plus des vérifications
habituelles (case libre, crédits, limite de tours) ; message dédié « Doit être adjacent
à un chemin » sinon. Le même critère est répercuté dans `dessinerApercuConstruction`
pour que l'aperçu au survol ne mente jamais (contour rouge sur une case pourtant
`LIBRE` mais non adjacente, plutôt que vert).

`Carte.trouverPointBlocagePourCaserne(colonne, ligne)` détermine *quel* point du chemin
la tour bloquera, une seule fois à la construction (jamais recalculé ensuite, pour
toute la durée de vie de la tour) : teste les 4 voisines dans l'ordre fixe déjà renvoyé
par `voisinesOrthogonales` (haut, bas, gauche, droite), retient la première qui
appartient à un chemin — déterministe, donc reproductible à graine égale même dans un
angle proche d'un croisement où plusieurs voisines de chemin seraient candidates. Si
cette case appartient à plusieurs chemins à la fois (croisement, phase 6A), retient le
premier de `Carte.chemins` qui la contient — la grille elle-même ne distingue de toute
façon pas lequel.

### Réutilisation des multiplicateurs d'amélioration existants (`config.js`, `tour.js`)

Aucune nouvelle constante d'amélioration : `Config.TYPES_TOURS.caserne` fixe
délibérément `cadence: 1` et `degats: CASERNE_UNITE_DEGATS_BASE`, pour que
`Tour.recalculerStats()` — strictement inchangée, partagée avec les quatre autres
types — produise directement, sans aucun code spécifique, les deux multiplicateurs
réinterprétés dont la Caserne a besoin : son `this.cadence` générique *est* le
multiplicateur de niveau (`AMELIORATION_MULTIPLICATEUR_CADENCE ** (niveau - 1)`)
appliqué au délai de réapparition (`CASERNE_DELAI_RESPAWN_BASE / this.cadence`,
`Tour.mettreAJourCaserne`). `Tour.statsUniteAuNiveauActuel()` calcule séparément les
points de vie et les dégâts de l'unité à partir des bases dédiées
(`CASERNE_UNITE_PV_BASE`/`CASERNE_UNITE_DEGATS_BASE`, distinctes de `degatsBase` par
clarté même si numériquement égales par construction — voir la note dans
`config.js`) et du même multiplicateur que `recalculerStats()` utilise pour les
dégâts (`AMELIORATION_MULTIPLICATEUR_DEGATS`) — le bonus permanent de dégâts du joueur
(`Progression.multiplicateurDegats`, phase 3B) s'applique aux dégâts de l'unité comme à
ceux de n'importe quelle tour, jamais à ses points de vie (un bonus de dégâts n'a
aucune raison de rendre un soldat plus résistant).

### Comportement de la tour (`Tour.mettreAJour`, `Tour.dessiner`)

`Tour.mettreAJour` bifurque entièrement vers `mettreAJourCaserne(dt)` pour ce type,
avant même de lire `this.cible`/`this.tempsDepuisDernierTir` : aucun ciblage, aucun
tir. `mettreAJourCaserne` ne fait rien tant qu'une unité est présente et vivante (son
combat est résolu ailleurs, voir plus bas) ; sinon incrémente
`this.tempsDepuisDestruction` et fait réapparaître une unité
(`faireApparaitreUnite()`) une fois le délai écoulé. Une unité apparaît aussi
immédiatement à la construction (pas de délai la première fois), dans le constructeur
de `Tour`.

`Tour.dessiner` ajoute un cinquième cas à la chaîne déjà en place depuis la phase 4A :
un pentagone (`dessinerSoclePolygone(ctx, taille * 0.34, 5, -Math.PI / 2)`), dans
`Config.COULEURS.neonBleu`, sans aucun canon — seul type dans ce cas, l'absence de
canon suffit à elle seule à la distinguer des quatre autres tours, toutes armées.

### Blocage et combat corps à corps (`ennemi.js`, `jeu.js`)

`Ennemi.deplacer(dt)` vérifie, avant de faire avancer l'ennemi, l'existence d'une
Caserne dont l'unité est vivante, sur le même `cheminIndex`, dont l'index de blocage
est inférieur ou égal à l'index du point que l'ennemi s'apprête à atteindre
(`indexPointDePassage + 1`) — référence directe à `Jeu.toursActives`, comme
`Jeu.facteurEchelle` déjà lu de la même façon dans cette méthode depuis la phase 1B,
sans changement de signature. Si bloqué, l'ennemi reste figé cette frame, sans avancer.

`Jeu.resoudreCombatsCasernes(dt)`, nouvelle étape de `Jeu.simuler()` juste après le
déplacement des ennemis et avant le nettoyage mort/arrivée : pour chaque Caserne dont
l'unité est vivante, trouve parmi les ennemis actuellement bloqués sur son chemin
(même prédicat que `deplacer`, évalué depuis la tour) celui le plus proche du point de
blocage, puis échange des dégâts continus (`ennemi.degatsCorpsACorps * dt` à l'unité,
`unite.degats * dt` via `ennemi.subirDegats` — exactement comme le ferait un
projectile). La mort de l'ennemi est traitée par la boucle de nettoyage déjà en place
juste après (récompense, explosion, son), sans aucun code dupliqué : c'est cette
réutilisation, pas un traitement spécial, qui garantit qu'une Caserne rapporte des
crédits comme n'importe quelle autre tour. La mort de l'unité, elle, est gérée ici
directement (aucun système générique équivalent n'existe pour une tour) :
`vivante = false`, `tour.unite = null`, `tempsDepuisDestruction` remis à zéro, petite
explosion de particules à sa position.

### Écart par rapport au prompt : silhouette de la tour elle-même

Le prompt ne décrivait la silhouette (Section 2) que pour l'unité, jamais pour le
bâtiment de la Caserne elle-même — contrairement au Flak (phase 7D), dont la Section 3
détaillait explicitement le socle de la tour. Sans forme dédiée, une Caserne serait
tombée dans la branche `else` existante (héritée du Flak) et se serait affichée par
erreur comme un Flak vert à quatre canons. Comblé avec un pentagone sans canon (voir
plus haut) : une forme cohérente avec les quatre autres (même famille de polygones,
même halo par niveau) tout en restant sans ambiguïté la seule tour désarmée.

### Bug découvert et corrigé en testant : amélioration et points de vie de l'unité

`Tour.ameliorer()` fixait initialement `this.unite.pointsDeVieMax` au nouveau plafond
sans jamais toucher `this.unite.pointsDeVie` (la valeur courante), avec l'intention de
ne jamais « soigner gratuitement » l'unité. Testé en améliorant une Caserne flambant
neuve (unité au maximum, jamais encore touchée) jusqu'au niveau 3 avant tout combat :
son ratio de vie affiché s'effondrait à 44 % (150/150 → 150/338) sans qu'elle n'ait
jamais subi le moindre dégât — un artefact contraire à l'intention plutôt que le
comportement voulu. Corrigé en préservant explicitement le *ratio*
`pointsDeVie / pointsDeVieMax` à travers l'amélioration plutôt que la valeur absolue :
une unité à pleine vie reste à pleine vie après amélioration (aucun soin nécessaire
puisqu'il n'y a rien à régénérer), une unité déjà endommagée conserve exactement le
même pourcentage de dégâts subis, ni soignée ni artificiellement réendommagée par le
changement de plafond. Vérifié dans les deux cas après correction (unité fraîche :
100 % avant et après ; unité à 50 % forcée artificiellement : toujours exactement 50 %
après une amélioration supplémentaire).

### Limite assumée, telle que documentée par le prompt

Deux ennemis (ou plus) du même chemin bloqués à proximité du même point se
superposeront visuellement plutôt que de former une file organisée — compromis
volontaire du prompt, non résolu ici, aucune logique de circulation complète n'a été
tentée.

### Comportement observé en testant, au-delà de cette limite déjà documentée

La condition de blocage (index de blocage ≤ index du point visé par l'ennemi) reste
vraie pour *tout* point situé après le point de blocage sur le chemin, pas seulement
pour le point de blocage lui-même. En jeu normal, sans interruption, ceci est
invisible : le premier ennemi à atteindre le point de blocage s'y fige, et tous les
suivants s'y accumulent avant même d'avoir pu le dépasser. Mais si l'unité meurt puis
qu'un ou plusieurs ennemis parviennent à dépasser ce point *pendant* le délai de
réapparition, et que l'unité réapparaît ensuite (toujours au même point, jamais
ailleurs) pendant que ces ennemis progressent déjà plus loin sur le même chemin, ces
ennemis déjà passés se figent de nouveau — comme si la Caserne, une fois son unité de
retour, refermait tout le chemin derrière elle plutôt que de ne bloquer que sa propre
case. Reproduit délibérément dans un test dédié (unité tuée, un ennemi laissé
progresser sur plusieurs points pendant le délai, puis l'unité relancée manuellement) :
confirmé que l'ennemi déjà avancé (`indexPointDePassage` bien supérieur à celui de la
tour) cesse d'avancer dès la réapparition de l'unité, alors qu'il l'avait déjà
dépassée. Non corrigé, dans le même esprit que la limite ci-dessus déjà assumée par le
prompt (pas de vraie logique de circulation pour cette phase) et fidèle à l'algorithme
exact qu'il demande (comparaison `<=`, pas `==`) — mais suffisamment différent d'un
« simple point d'arrêt » pour mériter d'être signalé explicitement plutôt que découvert
en jouant.

### Vérification

Testé en navigateur (serveur local) :

- **placement** : construction refusée avec le message « Doit être adjacent à un
  chemin » sur une case libre mais isolée ; acceptée sur une case libre adjacente, avec
  apparition immédiate de l'unité (pas de délai) à la position exacte du point de
  blocage déterminé ;
- **blocage et combat** : un ennemi réel (`Vagues.demarrer`, pas un objet de synthèse)
  s'immobilise exactement au point de blocage, les deux camps perdent des points de vie
  proportionnellement à `dt` (vérifié à la frame près : un ennemi Standard inflige
  8 dégâts/s à l'unité, l'unité inflige 15 dégâts/s à l'ennemi, valeurs mesurées
  cohérentes avec le temps réellement écoulé) ;
- **un seul ennemi payé par explosion** : découle de la structure même de la boucle
  (une seule itération sur `ennemisActifs`, jamais deux) plutôt que d'un filet de
  sécurité ajouté après coup — comme pour le Flak (phase 7D) ;
- **destruction et réapparition** : une unité réduite à 0 PV déclenche bien
  `vivante = false`, une explosion de particules (10, la taille par défaut d'une
  « petite » explosion), `tour.unite = null`, `tempsDepuisDestruction` remis à zéro ;
  le chemin redevient immédiatement praticable (l'ennemi qui la combattait reprend sa
  progression) ; une nouvelle unité réapparaît exactement au délai attendu
  (`CASERNE_DELAI_RESPAWN_BASE / this.cadence`, vérifié à la frame près à 6,0s au
  niveau 1), à la même position ;
- **crédits à la mort par une Caserne** : un ennemi affaibli puis achevé par l'unité
  disparaît de `ennemisActifs` et rapporte exactement sa récompense de base — aucune
  différence avec une mort par tour classique ;
- **amélioration (niveau 1 à 7)** : points de vie et dégâts de l'unité déjà vivante
  suivent exactement `AMELIORATION_MULTIPLICATEUR_DEGATS ** (niveau - 1)` appliqué aux
  bases dédiées, le délai de réapparition suit exactement
  `CASERNE_DELAI_RESPAWN_BASE / AMELIORATION_MULTIPLICATEUR_CADENCE ** (niveau - 1)` à
  chaque palier (valeurs mesurées : 150→225→338→506→759→1139→1709 PV,
  6,0→5,2→4,5→3,9→3,4→3,0→2,6 s) — voir aussi le bug de ratio de vie découvert et
  corrigé ci-dessus ;
- **vente** : montant remboursé exact
  (`investissementTotal * VENTE_POURCENTAGE_REMBOURSEMENT`), tour retirée, case
  redevenue `'LIBRE'` ;
- **panneau d'amélioration** : libellés « Points de vie de l'unité »/« Dégâts de
  l'unité »/« Délai de réapparition » affichés pour une Caserne sélectionnée, à la
  place de « Dégâts/Cadence/Portée » ;
- **régression des quatre types existants** : Mitrailleuse/Canon/Sniper/Flak testés
  isolément après tous les changements de cette phase (y compris le changement de
  signature indirect d'`Ennemi.deplacer`, qui ne les concerne pas) — dégâts exacts sur
  la seule cible verrouillée (10/45/80/20), aucun effet sur un ennemi voisin non ciblé,
  comportement strictement identique à avant cette phase ;
- **fluidité** : 6 Casernes actives simultanément (12 entités supplémentaires à
  dessiner/mettre à jour par frame en comptant leurs unités) contre 60 ennemis répartis
  sur les deux chemins pour forcer des empilements derrière les points de blocage
  (scénario explicitement demandé par le critère d'acceptation 8) — 0,67 ms en moyenne
  par frame, aucune perte de fluidité mesurable ;
- **aucune erreur console** dans tous les scénarios ci-dessus, y compris avec des
  ennemis accumulés derrière un même point de blocage.

**Résumé demandé par le prompt** : au niveau 1, une unité de base (150 PV, 15 dégâts/s)
perd nettement contre un Blindé isolé (300 PV, 20 dégâts corps-à-corps/s) — l'unité
meurt en 7,5 s sans jamais achever le Blindé, qui ne perd que 112,5 PV sur ses 300
(37,5 %) avant qu'elle ne tombe. Un Blindé « casse » donc bel et bien une unité de base
trop vite pour qu'un seul combat suffise à s'en débarrasser, sans que ce soit
nécessairement un défaut d'équilibrage : l'écart se referme vite avec le niveau — dès
le niveau 3 (338 PV, 33,75 dégâts/s), l'unité inverse le rapport de force et abat le
même Blindé en 8,9 s en conservant 160 PV (47 %). Une Caserne isolée au niveau 1 face à
des Blindés en solo se comporte donc plutôt comme un ralentisseur temporaire et une
source de crédits (elle finit par tomber, mais le Blindé aura perdu du temps et pris
des dégâts) que comme un vrai mur, ce qui semble d'ailleurs cohérent avec un coût de
construction (90) proche de celui du Flak (80) plutôt que d'un Canon (70) : elle
suppose une amélioration assez rapide pour tenir sa fonction de blocage contre les
ennemis les plus résistants, plutôt que d'être un mur fiable dès sa construction.

## Le triangle Flak/Caserne/Drone (phase 7F)

Dernière pièce du trio annoncé dès la phase 7D : un ennemi volant à trajectoire
indépendante des chemins, que seul le Flak peut viser et que les unités de Caserne ne
peuvent jamais arrêter. Contrairement aux sous-phases précédentes (chacune un ajout
isolé), celle-ci généralise plusieurs mécanismes qui supposaient implicitement un
déplacement sur chemin — un changement d'architecture, pas une simple entrée de plus
dans `Config.TYPES_ENNEMIS`.

### Ajouts à `config.js`

`Config.COULEURS.neonBlanc` (`'#e8f4ff'`, teinte glacée) — répétée en dur dans la table
`COULEURS_CSS_ENNEMIS` d'`ennemi.js`, comme les trois couleurs d'ennemi qui l'y ont déjà
précédée, pour la même raison (cette table existe justement parce que ces noms ne sont
pas tous des mots-clés CSS valides, indépendamment de `Config.COULEURS`). Nouveau type
`Config.TYPES_ENNEMIS.drone` (`vole: true`, `degatsCorpsACorps: 0` — jamais lu en
pratique puisqu'un drone ne peut jamais être bloqué, mais posé plutôt qu'omis pour que
la propriété existe uniformément sur les quatre types), et
`VAGUE_APPARITION_DRONE`/`PROPORTION_DRONE` pour son apparition dans les vagues.
`peutViserVolant` ajouté explicitement à `Config.TYPES_TOURS`, `true` uniquement pour le
Flak — la bascule qui active tout le reste de cette phase.

### Généralisation de la progression (`ennemi.js`, `tour.js`)

`Ennemi.progression()` remplace l'ancienne `Tour.progressionEnnemi(ennemi)` (supprimée) :
même calcul qu'avant pour un ennemi au sol
(`indexPointDePassage / (pointsDePassage.length - 1)`, protégé contre un chemin d'une
seule case), et pour un drone `distanceParcourue / distanceTotaleDuTrajet` à partir de
ses points de départ/destination (protégé de façon symétrique contre un trajet de
longueur nulle). `Tour.chercherCible` appelle désormais `ennemi.progression()`
directement plutôt que de faire ce calcul elle-même — centralisé une bonne fois, pour
qu'un éventuel troisième mode de déplacement futur n'oblige plus à retoucher le ciblage
des tours une deuxième fois.

### Déplacement en ligne droite (`ennemi.js`)

Un drone n'a ni `cheminIndex` ni point de passage : à la construction (branche dédiée
dans le constructeur d'`Ennemi`, sur `caracteristiques.vole`), tire un point de départ
sur le bord supérieur de la grille et un point de destination sur le bord inférieur
(colonnes indépendantes l'une de l'autre), via `Aleatoire` — ce tirage affecte le
déroulement du jeu (par où le drone traverse le plateau), contrairement au décor
purement scénographique de la phase 7C qui reste, lui, sur `Math.random()`. `deplacer(dt)`
retourne tout au début pour un ennemi volant, avant même d'atteindre la vérification de
blocage par une Caserne plus bas dans la même méthode : une interpolation directe vers
la destination, `this.arrive = true` une fois atteinte. C'est ce retour anticipé,
`return` avant le code de blocage, qui garantit qu'un drone ignore une case bloquée sans
condition supplémentaire à écrire pour « l'ignorer » — il ne passe simplement jamais par
ce code.

### Arrivée et intégrité : rien à modifier dans `jeu.js`

Vérifié plutôt que supposé : le nettoyage de fin de frame dans `Jeu.simuler()`
(`if (ennemi.arrive) { intégrité -= ... }` / `else if (!ennemi.vivant) { crédits += ... }`)
ne lit que des propriétés déjà génériques (`arrive`, `vivant`, `recompense`, `couleur`,
`type`), jamais `cheminIndex`. Un drone qui atteint sa destination y est donc traité
exactement comme un ennemi au sol qui termine son chemin, sans une seule ligne ajoutée à
cette boucle — confirmé par un test dédié (un drone livré à lui-même, sans aucune tour,
perd de l'intégrité en touchant le bord inférieur de la grille).

De même, `Jeu.resoudreCombatsCasernes` (phase 7E) exclut déjà un drone sans code
supplémentaire : son filtre `ennemi.cheminIndex !== unite.cheminIndex` élimine
naturellement tout ennemi volant, dont `cheminIndex` vaut toujours `null`, qui ne peut
jamais correspondre au `cheminIndex` bien réel d'une unité de Caserne.

### Silhouette (`ennemi.js`)

Seul ennemi dont la forme n'a pas besoin d'adaptation à la vue de dessus (contrairement
aux trois véhicules au sol de la phase 7A) : un vrai quadricoptère vu du dessus est déjà
naturellement cohérent avec cet angle de caméra. Corps central rond, quatre bras courts
en croix (en X, pas en +, plus naturel pour un quadricoptère vu du dessus), chacun
terminé par un petit cercle représentant un rotor, entièrement dans
`Config.COULEURS.neonBlanc` — pas de teinte claire/sombre dérivée comme les trois
autres châssis, un seul blanc glacé suffit à le distinguer d'un coup d'œil de tout le
reste du plateau.

### Exclusion du ciblage et du blocage (`tour.js`, `ennemi.js`, `jeu.js`)

`Tour.chercherCible` lit `Config.TYPES_TOURS[this.type].peutViserVolant` une seule fois
par appel, puis ignore (`continue`) tout ennemi dont `vole` est vrai si ce champ n'est
pas vrai pour cette tour — comme s'il n'existait pas. Le Flak, seule tour à l'avoir à
`true`, cible indifféremment un ennemi au sol ou un drone via leur `progression()`
respective, sans code séparé pour les deux cas. Le blocage par une Caserne (`Ennemi.
deplacer`) et sa résolution (`Jeu.resoudreCombatsCasernes`) ignorent tous deux un drone
nativement, comme détaillé plus haut — les deux commentaires `// PHASE 7F :` laissés en
7D et 7E ont été retirés, remplacés par une explication de la résolution réelle à chacun
des deux endroits.

### Son (`son.js`)

`Son.jouerMort('drone')` : onde carrée, aiguë (1800 Hz) et très brève (0,1 s) avec un
glissando descendant vers 900 Hz — rompt avec le triangle/dents de scie « organique »
des trois autres variantes pour un timbre nettement plus électronique, sans reprendre la
tonalité de tir déjà utilisée par la Mitrailleuse (aussi une onde carrée, mais sans
glissando et à une fréquence de départ différente).

### Vérification

Testé en navigateur (serveur local) :

- **trajectoire** : un drone construit directement (`new Ennemi('drone', 1, null)`)
  tire un point de départ sur la ligne 0 et une destination sur la dernière ligne, sur
  des colonnes indépendantes — suivi sur 400 frames simulées : position et
  `progression()` évoluent bien linéairement (0,00 → 0,16 → 0,32 → … → 0,96), `arrive`
  devient vrai en fin de trajet, l'intégrité baisse de exactement
  `Config.DEGATS_INTEGRITE_PAR_ENNEMI` au moment précis de l'arrivée ;
- **ciblage exclusif** : les cinq types de tour placés directement sur un drone
  (distance nulle, largement à portée) — seul le Flak lui trouve une cible
  (`peutViserVolant: true`), les quatre autres (Mitrailleuse, Canon, Sniper, Caserne)
  ne lui en trouvent aucune, comme s'il n'existait pas ;
- **arbitrage par progression()** : un Flak à portée d'un drone à 90 % de son trajet et
  d'un Standard à 0 % du sien cible le drone ; le scénario inversé (Standard à 97 %,
  drone à 10 %) fait cibler le Standard — dans les deux sens, la comparaison directe des
  deux `progression()` fonctionne, malgré la nature radicalement différente des deux
  trajectoires ;
- **traversée d'un blocage** : un drone lancé droit à travers le point de blocage d'une
  Caserne (unité vivante) le traverse sans dévier ni ralentir — position toujours
  différente d'une frame à l'autre, l'unité ne perd aucun point de vie, jusqu'à
  l'arrivée du drone en bas de la grille ;
- **mort et récompense** : un drone achevé (`subirDegats`) disparaît de la liste des
  ennemis actifs, rapporte exactement `Config.TYPES_ENNEMIS.drone.recompense` (20)
  crédits, et déclenche `Son.jouerMort('drone')` (confirmé par instrumentation :
  oscillateur `'square'`) — le tout via le même nettoyage générique que n'importe quel
  autre ennemi, sans code spécifique ;
- **apparition naturelle en vague réelle** : `Vagues.demarrer(8)` (le seuil configuré)
  fait bien apparaître un drone parmi les types générés, aux côtés des trois types au
  sol, sur une vague qui se termine normalement (`Vagues.enCours` retombe à `false`,
  tous les ennemis traités) ;
- **régression des quatre types de tours, des ennemis au sol et de la Caserne** :
  dégâts exacts (10/45/80/20) sur un ennemi au sol pour Mitrailleuse/Canon/Sniper/Flak,
  blocage et combat corps à corps d'une Caserne toujours fonctionnels sur un ennemi au
  sol — aucun changement de comportement malgré la généralisation de `progression()` et
  le nouveau champ `vole` ;
- **fluidité et robustesse** : 24 tours (dont 4 Casernes, chacune avec son unité) et 60
  ennemis (40 au sol + 20 drones) simulés sur 300 frames — 2,0 ms en moyenne par frame,
  aucune perte de fluidité mesurable, aucune erreur console dans ce scénario ni dans
  aucun des précédents ;
- **piège de test rencontré** : un premier test d'équilibrage (voir plus bas) donnait
  0 drone abattu sur 20 avec un Flak apparemment bien placé — `Carte.tailleCase` valait
  0 dans cet onglet de test (non réellement au premier plan, quirk déjà documenté
  ailleurs dans ce fichier), annulant totalement la portée du Flak
  (`portee * facteurEchelle = 110 * 0 = 0`). Refait sur un onglet neuf
  (`tailleCase` confirmée non nulle avant de lancer le test) pour obtenir les chiffres
  réels ci-dessous.

### Vérification de l'équilibrage demandé

Un Flak seul, positionné au centre exact de la grille, face à 20 drones tirés avec des
points de départ/destination indépendants et aléatoires (comme en vague réelle) :
**seulement 1 drone sur 20 abattu**, les 19 autres atteignant le bas de la grille intacts.
Creusé plus loin avec un scénario contrôlé (un seul drone forcé à traverser exactement
le centre du Flak, la meilleure interception géométriquement possible) : ce drone
n'encaisse que 2 tirs (40 dégâts, à `degats: 20`) avant de sortir de portée et survit
avec 10 PV sur 50. Le calcul explique pourquoi : à portée 110 (soit 123,75 px à l'échelle
mesurée) et vitesse de drone 90 (101,25 px/s), une traversée parfaitement centrée ne
reste à portée que ~2,44 s ; à la cadence de base du Flak (1,2 tir/s, un tir toutes les
0,83 s), cela ne permet que 2 tirs, jamais 3 — et il en fallait 3 (60 dégâts à l'ancienne
valeur) pour abattre les 50 PV d'un drone. Un Flak de niveau 1 ne pouvait donc
structurellement jamais tuer un drone en un seul passage, même dans le meilleur cas
géométrique possible — pas un bug (le ciblage, le tir et les dégâts fonctionnaient
exactement comme demandé, vérifié séparément ci-dessus), mais un déséquilibre numérique
entre la portée/cadence du Flak et les points de vie du drone.

**Correction appliquée (contenu additionnel post-lancement, sur signalement de ce
déséquilibre)** : `Config.TYPES_TOURS.flak.degats` relevé de `20` à `26`, seule valeur
touchée — portée, cadence et coût du Flak inchangés, de même que PV/vitesse/récompense du
drone, puisque le seul problème identifié était le seuil de dégâts par rapport aux PV du
drone, pas la fréquence ou la portée de tir. Avec cette valeur, 2 tirs valent
2 × 26 = 52 dégâts, au-dessus des 50 PV du drone : un passage à deux tirs devient une
destruction garantie plutôt qu'une survie systématique à 10 PV. Revérifié après
correction avec exactement les mêmes deux scénarios que ci-dessus :
- **scénario contrôlé** (drone forcé au centre exact, meilleur cas géométrique) :
  désormais tué au deuxième tir (52 ≥ 50), confirmé par test isolé (`Jeu.simuler` piloté
  manuellement, comme pour les tests précédents) ;
- **scénario réaliste** (20 drones à trajectoires indépendantes aléatoires contre un
  Flak isolé) : **15 drones sur 20 abattus**, contre 1 sur 20 avant correction — un
  Flak de niveau 1 devient donc efficace sans être infaillible : un drone qui ne
  traverse qu'en bordure de portée (moins de 2,44 s dans la zone de tir) peut encore
  passer avec un seul tir encaissé, ce qui correspond bien à l'équilibre demandé par le
  prompt (« sans être totalement débordé, mais sans non plus les abattre sans effort »)
  plutôt qu'à une garantie d'interception à 100 %.

Aucune régression constatée sur les ennemis au sol ni sur les trois autres tours
tirantes (Mitrailleuse, Canon, Sniper) : seule la valeur `degats` du Flak a changé, et
aucun autre calcul (ciblage, portée, cadence, dégâts de zone) n'en dépend ailleurs dans
le code.

## Vagues de boss (phase 7G)

Tous les `Config.VAGUE_INTERVALLE_BOSS` paliers (5 par défaut, donc les vagues 5, 10,
15…), un ennemi massif apparaît en tête d'une escorte réduite. Le boss est un ennemi au
sol ordinaire à tous égards sauf son gabarit et ses points de vie : aucune mécanique
nouvelle n'a été nécessaire, seulement une nouvelle entrée dans `Config.TYPES_ENNEMIS`
et une composition de vague spéciale — même philosophie que le Flak (phase 7D) et le
drone (phase 7F) : généraliser plutôt que dupliquer, et vérifier plutôt que supposer que
les systèmes existants encaissent le nouveau cas.

### Ajouts à `config.js`

`Config.COULEURS.neonRouge` (`'#ff2b2b'`) suit le même écart déjà documenté pour
`neonBlanc` (phase 7F) : le prompt de cette phase suggérait un objet `PALETTE` séparé,
inexistant dans ce dépôt — `Config.COULEURS` en tient lieu depuis la phase 4A.

`Config.TYPES_ENNEMIS.boss` : `pointsDeVie: 2000`, `vitesse: 40`, `recompense: 150`,
`couleur: 'neonRouge'`, `vole: false` (explicite, comme le `true` du drone, sans effet
fonctionnel différent d'une simple absence de champ), `degatsCorpsACorps: 35`.

`Config.VAGUE_INTERVALLE_BOSS` (5) et `Config.PROPORTION_ESCORTE_VAGUE_BOSS` (0.5),
consommées par `Vagues.demarrer` ci-dessous.

**Écart signalé, non corrigé** : le prompt décrit le boss comme « volontairement lent,
plus lent que le Blindé », mais fournit une vitesse de 40 alors que le Blindé
(`Config.TYPES_ENNEMIS.blinde.vitesse`) vaut 35 — le boss est donc en réalité
légèrement *plus rapide* que le Blindé, à l'opposé de la description qui l'accompagne.
La valeur numérique explicite (40) a été conservée telle quelle plutôt que corrigée
pour coller à la prose, cette dernière étant vraisemblablement une approximation
erronée du prompt plutôt qu'une intention numérique précise — mais l'écart mérite
d'être tranché si la vitesse relative du boss doit vraiment rester sous celle du
Blindé.

### Composition d'une vague de boss (`vagues.js`)

`Vagues.demarrer(numero)` calcule `estVagueBoss = numero % Config.VAGUE_INTERVALLE_BOSS
=== 0` — un simple modulo, valable aussi bien en mode Sans fin qu'au-delà du nombre de
vagues d'une partie Standard/Longue, puisqu'il ne dépend jamais de `Jeu.nombreDeVagues`.
Si vrai : `ennemisRestantsAGenerer` vaut `1 + tailleEscorte`, où `tailleEscorte =
Math.max(1, Math.round(nombreNormalEnnemis * Config.PROPORTION_ESCORTE_VAGUE_BOSS))` —
`nombreNormalEnnemis` étant le total qu'aurait généré une vague ordinaire de ce même
numéro (`5 + numero * 2`, formule de la phase 1B, inchangée). Le multiplicateur de
points de vie déjà appliqué à tous les ennemis selon le numéro de vague (`1 + (numero -
1) * 0.15`) s'applique tel quel au boss, à partir de ses 2000 PV de base — aucune
formule séparée.

`bossEnAttente` (vrai uniquement pour la durée d'une vague de boss, jusqu'à ce que le
boss ait effectivement été généré) garantit qu'il apparaît en tête de file : dans
`Vagues.mettreAJour`, le tout premier ennemi généré d'une vague de boss l'est via une
branche dédiée (`cheminIndex` tiré normalement, comme n'importe quel ennemi au sol —
jamais `null`, contrairement au drone, puisque le boss suit bel et bien un chemin) qui
saute entièrement le tirage habituel (`tirerTypeEnnemi`/tirage du drone) plutôt que d'en
biaiser le résultat. Une fois consommé, l'escorte suit exactement le chemin de
génération déjà en place (mêmes proportions de Rapide/Blindé/Drone selon le numéro de
vague) sans aucune distinction avec une vague normale.

### Annonce de la vague de boss (`vagues.js`, `interface.js`, `son.js`)

`Interface.afficherMessageConstruction(texte, duree = 1.5)` — généralisée avec un
second paramètre optionnel — affiche `« ⚠ VAGUE DE BOSS »` pendant 3 secondes, appelée
une seule fois depuis `Vagues.demarrer` (elle-même protégée par le garde-fou `if
(this.enCours) return;` en tête de la méthode, qui empêche tout second appel tant que
la vague est en cours). Réutilise le mécanisme déjà en place pour les messages
d'erreur de construction plutôt que d'en créer un second en parallèle — voir l'écart
ci-dessous sur le nom de la méthode, resté inchangé malgré ce second usage.
`Son.jouerAlerteBoss()`, appelée au même endroit, joue une tonalité grave et dramatique
(deux tons superposés en dents de scie/carré, bien plus bas que tout autre son du jeu
hors victoire/défaite) — vérifié par un test dédié (une fonction espionne à la place de
`Son.jouerAlerteBoss`) qu'elle n'est appelée qu'une seule fois par vague de boss, jamais
en boucle pendant son déroulement.

`Son.jouerMort('boss')` ajoute une variante grave et longue (0,55 s, contre 0,32 s au
maximum pour les trois variantes existantes), deux tonalités superposées comme
l'alerte, pour un moment de mort qui se distingue nettement des trois autres.

### Silhouette visuelle (`ennemi.js`)

Le châssis Boss ne dérive pas sa taille de la formule proportionnelle aux points de vie
utilisée par les trois types au sol existants (`tailleCase * (0.12 + pointsDeVieBase /
1000)`) : avec 2000 PV contre une centaine pour les autres, cette formule donnerait un
châssis totalement disproportionné. Sa taille est calculée séparément dans
`Ennemi.dessiner`, directement à partir du rayon du Blindé (le plus gros châssis
existant jusqu'ici) multiplié par 2,5 — plutôt qu'un nombre en dur indépendant, pour
rester cohérente si `Config.TYPES_ENNEMIS.blinde.pointsDeVie` changeait un jour. Vérifié
par calcul direct : rayon Boss = 2,50 × rayon Blindé, exactement.

`dessinerChassisBoss` utilise un nouvel octogone (`dessinerOctogone`, même principe que
`dessinerHexagone` mais à huit côtés) plutôt que l'hexagone commun aux trois types au
sol existants, avec quatre protubérances d'armure (contre deux plaques pour le Blindé)
aux quatre coins diagonaux du corps, et un capteur central nettement plus large (0,5 ×
rayon, contre 0,38 pour le Blindé) — distinct du Blindé par la forme et le niveau de
détail, pas seulement par la taille.

La barre de vie suit exactement la même logique que pour les trois autres types
(`largeurBarre = rayon * 2`, fixe pour un ennemi donné puisque `rayon` ne dépend que du
type, jamais des points de vie courants ; seul le remplissage — `pointsDeVie /
pointsDeVieMax` — varie) : aucune règle particulière n'a été nécessaire pour le boss,
sa barre est simplement proportionnellement plus large, à l'image de son châssis.

### Vérification que les systèmes existants généralisent

Comme pour le Flak (7D) et le drone (7F), vérifié concrètement plutôt que supposé, via
des tests isolés pilotant directement `Jeu.simuler`/`Jeu.resoudreCombatsCasernes` :

- **ciblage par les quatre tours au sol** : le boss n'a pas `vole` à `true`, donc
  `Tour.chercherCible` le traite comme n'importe quel ennemi au sol, sans aucune
  condition supplémentaire ;
- **blocage et combat au corps à corps avec une unité de Caserne** : une unité fictive
  bloquant un Blindé perd 20 PV/s, la même unité bloquant un boss en perd 35/s — exactement
  `degatsCorpsACorps` de chacun, sans code spécifique au boss dans
  `Jeu.resoudreCombatsCasernes` ;
- **récompense en crédits et son de mort à sa destruction** : un boss réduit à 0 PV par
  plusieurs Canons de niveau maximum déclenche `Jeu.credits += 150` et
  `Son.jouerMort('boss')`, via le même nettoyage générique que tout autre ennemi
  (`jeu.js`, `simuler()`) ;
- **réduction d'intégrité à l'arrivée** : un boss livré à lui-même sans tour à portée
  atteint l'arrivée et déclenche la perte d'intégrité générique, sans code ajouté.

Scénario de non-régression : une partie réelle (carte générée normalement, graine
aléatoire), 8 tours des cinq types dont une Caserne, vague 5 (vague de boss) jouée
jusqu'à son terme complet (2888 frames simulées) sans aucune erreur console ni
exception.

### Vérification du calibrage demandé (2000 PV dès la vague 5)

Testé avec 6 Canons de niveau maximum concentrés sur le chemin du boss : celui-ci est
détruit en quelques dixièmes de seconde à peine, largement avant d'avoir traversé une
fraction significative du plateau — un calibrage de tours extrême et non représentatif
d'une vague 5 réelle (un joueur atteint rarement le niveau maximum de plusieurs tours
dès la cinquième vague), mais qui confirme au moins que la mécanique de mort/récompense
fonctionne correctement à haute pression de feu.

Avec un déploiement plus réaliste de tours de niveau 1 (scénario de non-régression
ci-dessus, 8 tours réparties sur toute la carte sans concentration délibérée sur le
chemin du boss), le boss n'a pas systématiquement été détruit avant l'arrivée dans tous
les essais — cohérent avec 2000 PV représentant 20 fois les PV d'un Standard, alors
qu'un joueur en vague 5 n'a typiquement que quelques tours de bas niveau — un boss très
difficile à abattre à ce stade, avec seulement 4 à 8 tours proches du niveau 1-2 face à
lui. **Confirmé comme le comportement recherché plutôt qu'un déséquilibre à corriger** :
la difficulté de la toute première vague de boss est intentionnelle, contrairement au
déséquilibre du Flak face au drone (phase 7F, corrigé), qui allait à l'encontre de
l'équilibre demandé. Les 2000 PV de base sont donc conservés tels quels, sans
multiplicateur réduit pour les premières vagues de boss.

## Avancement (feuille de route)

- **1A — Socle et carte** : fait. Génération, affichage, redimensionnement, reproductibilité
  par graine.
- **1B — Ennemis et vagues** : fait. Déplacement le long du chemin, trois types d'ennemis,
  vagues progressives, intégrité, pause automatique sur `visibilitychange`, HUD minimal.
- **1C — Tours, ciblage, projectiles, crédits** : fait. Un seul type de tour, construction
  par clic direct, ciblage stable de l'ennemi le plus avancé à portée, projectiles
  recyclés via un pool, crédits (départ, récompense de kill, bonus de fin de vague),
  correctif de mise à l'échelle des distances (`Jeu.facteurEchelle`) appliqué aux
  vitesses d'ennemis en plus des nouvelles valeurs de portée et de vitesse de
  projectile.
- **1D — Interface complète** : fait. Écran d'accueil avec choix de durée (Rapide,
  Standard, Longue, Sans fin), HUD définitif, aperçu de construction au survol (souris
  uniquement), écrans de victoire et de défaite, pause manuelle et vitesse ×2, le tout
  piloté par `Jeu.etatPartie` et séparé en deux fichiers (`interface.js` pour
  l'affichage/interactions, `jeu.js` pour l'état/la simulation). Éléments provisoires des
  phases précédentes retirés (bouton « Nouvelle carte », message de défaite temporaire,
  bouton « Reprendre » isolé).
- **2A — Types de tours et sélection** : fait. Trois types de tours (Mitrailleuse,
  Canon, Sniper — voir « Types de tours et sélection » ci-dessus) remplaçant l'unique
  type de la phase 1C, barre de sélection générée dynamiquement à côté du HUD, coût et
  aperçu de portée dépendant du type sélectionné, tours visuellement distinctes
  (couleur + lettre, remplacée par des formes propres à chaque type en phase 4A).
  Anciennes constantes `Config.TOUR_PORTEE`/`TOUR_DEGATS`/`TOUR_CADENCE`/`TOUR_COUT`
  supprimées au profit de `Config.TYPES_TOURS`.
- **2B — Améliorations de tour et vente** : fait. Voir « Niveaux, amélioration et
  vente » ci-dessus : jusqu'à `Config.NIVEAU_MAX_TOUR` niveaux par tour (3 à l'origine,
  ajusté à 7 après coup — voir la note d'équilibrage dans `config.js`), panneau dédié
  ouvert par clic sur une tour déjà construite, coût de palier croissant, vente au
  prorata de l'investissement total. **La phase 2 (types de tours, amélioration,
  vente) est maintenant entièrement close.**
- **3A — Niveau de joueur, XP, sauvegarde** : fait. Voir « Progression du joueur
  (phase 3A) » ci-dessus : niveau et XP du joueur persistés via `localStorage`
  (nouveau fichier `progression.js`), chargés une seule fois au démarrage de la page,
  sauvegardés une seule fois à la fin de chaque partie (jamais pendant qu'elle est en
  cours), résistants à un `localStorage` indisponible (navigation privée).
- **3B — Bonus permanents** : fait. Voir « Bonus permanents (phase 3B) » ci-dessus :
  cinq paliers indépendants débloqués par niveau (crédits et intégrité de départ,
  réduction du coût de construction et d'amélioration, bonus de dégâts), tous
  consultés exclusivement via `Progression`, jamais en lisant `Config.PALIERS_BONUS`
  directement ailleurs, et une liste dédiée sous la barre d'XP de l'écran d'accueil
  distinguant débloqués et verrouillés. **La phase 3 (niveau de joueur, XP,
  sauvegarde, bonus permanents) est maintenant entièrement close.**
- **4A — Identité visuelle cyberpunk** : fait. Voir « Identité visuelle cyberpunk
  (phase 4A) » ci-dessus : palette bleu-nuit assortie de halos néon sur départ/arrivée,
  tours et ennemis, trois formes de socle distinctes par type de tour (losange, octogone,
  triangle) remplaçant la lettre M/C/S de la phase 2A, halo qui s'intensifie légèrement
  avec le niveau d'une tour, touches de lueur CSS sur les éléments actifs/sélectionnés.
- **4B — Particules et son** : fait. Voir « Particules et son (phase 4B) » ci-dessus :
  système de particules recyclées via un pool (flash de tir, impact, explosion) sans
  aucun halo pour préserver les performances, huit effets sonores entièrement
  synthétisés via l'API Web Audio (aucun fichier audio), `AudioContext` créé à la
  demande au premier clic sur Jouer, préférence son persistée via `localStorage` et
  bouton dédié toujours visible. **La phase 4 (identité visuelle, particules, son) est
  maintenant entièrement close : le jeu est complet en contenu.**
- **5 — PWA installable et hors ligne** : fait. Voir « Installation et fonctionnement
  hors ligne (phase 5) » ci-dessus : manifeste (`manifest.webmanifest`) et service
  worker (`sw.js`) écrits à la main sans dépendance, cache-first sur l'intégralité des
  fichiers du jeu, versionnement du cache avec purge des anciennes versions à
  l'activation, icônes réelles produites via l'outil dédié `outils/generateur-icones.html`
  (étape manuelle documentée). Le jeu continue de fonctionner à l'identique sous
  `file://`, comme convenu depuis la phase 1A — seuls l'installation et le cache
  explicite y sont indisponibles, sans que cela prive le joueur de quoi que ce soit.

**Le plan initial (phases 1 à 5) est complet** : boucle de jeu, progression du joueur,
habillage cyberpunk, son, et installation/fonctionnement hors ligne. Prêt à être
déployé sur Netlify (racine du dossier `defense-neon`, aucune étape de build) puis
distribué via Payhip.

Mises à jour de contenu postérieures au plan initial :

- **6A — Chemins multiples** : fait. Voir « Chemins multiples (phase 6A) » ci-dessus :
  `Config.NOMBRE_CHEMINS` (2) chemins distincts par carte, avec entrée/sortie propres et
  espacées, pouvant se croiser librement sans jamais se toucher eux-mêmes ; chaque
  ennemi assigné à un chemin dès sa création (reproductible à graine égale) et n'en
  dévie jamais ; ciblage des tours corrigé pour comparer une progression normalisée par
  chemin plutôt qu'un index brut ; script de vérification à neuf sur 500 graines (0
  erreur, 93,2 % de croisements réels). La limite de tours constructibles elle-même
  était explicitement laissée à la phase 6B (commentaires `// PHASE 6B :` posés à
  l'époque dans `interface.js` et `outils/simulation-equilibrage.js`, depuis remplacés
  par du code réel — voir ci-dessous).
- **6B — Limite de tours** : fait pour la limite elle-même. Voir « Limite de tours
  (phase 6B) » ci-dessus : `Config.PROPORTION_LIMITE_TOURS` (0,5, valeur de départ,
  pas définitive) appliqué au nombre de cases libres de la carte générée, calculé une
  seule fois par partie et jamais recalculé ; appliqué à la construction, à la barre de
  types, à l'aperçu au survol et à un nouvel indicateur HUD « Tours : X / Y » ; mesure
  informative des cases libres sur les huit graines déjà utilisées (85 à 93 tours selon
  la carte). **Le nouveau round de mesure d'équilibrage complet (expériences 1-4 avec
  cette limite active) reste volontairement hors périmètre** : la valeur de
  `PROPORTION_LIMITE_TOURS` n'est pas encore stabilisée par du jeu réel, et la relancer
  maintenant risquerait de devoir être refaite une nouvelle fois après un premier
  ajustement.

Nouvelle vague de contenu additionnel post-lancement (voir « Contenu additionnel
post-lancement » ci-dessus pour la liste complète des sous-phases à venir) :

- **Décor d'arrière-plan en parallaxe (« phase 7C »)** : fait. Voir « Décor
  d'arrière-plan en parallaxe (phase 7C) » ci-dessus : skyline à deux couches sur un
  second canvas (`#canvas-decor`) indépendant du canvas de jeu, visible dans les marges
  autour du plateau, défilement continu (couche proche plus rapide que la lointaine)
  jamais affecté par la pause, l'écran d'accueil, les écrans de fin ou la vitesse ×2,
  recyclage des bâtiments hors champ, `shadowBlur` léger justifié par le faible nombre
  de formes (une quinzaine). Aucune régression sur le rendu du plateau de jeu.
- **Image de fond fixe (« phase 7C bis »)** : fait, code et fichier réel. Voir « Image
  de fond fixe (phase 7C bis) » ci-dessus : `<img id="image-decor">` + voile sombre,
  superposés au skyline procédural sans jamais le remplacer, fondu à l'apparition en cas
  de succès, simple avertissement console en cas d'échec (piège de course avec le
  chargement de l'image, déjà résolu au moment où le script s'exécute, détecté et corrigé
  au passage — vérifié dans les deux sens, succès et échec). **`images/decor-fond.png`**
  (renommé depuis `.webp`, prévu par le prompt initial mais aucun outil de conversion
  disponible dans cet environnement) **est désormais présent et vérifié** : image bien
  visible en fondu par-dessus le skyline, voile appliqué, plateau et HUD inchangés, et
  l'installation du service worker (mode hors ligne, phase 5) réussit à nouveau
  pleinement — les dix-neuf fichiers du jeu, image comprise, sont mis en cache.
- **Transparence du plateau (correctif post-7C)** : fait. Voir « Transparence du
  plateau (correctif post-7C) » ci-dessus : fond des cases libres du plateau rendu
  semi-transparent (`Config.COULEURS.fondTranslucide`/`caseLibreTranslucide`) pour
  laisser transparaître le décor à travers le plateau lui-même, cases de chemin
  toujours pleinement opaques. A aussi révélé et corrigé un bug latent (absence de
  `ctx.clearRect` dans `Jeu.dessinerTout()`, sans conséquence tant que tous les
  remplissages étaient opaques) qui aurait fait dériver l'effet vers l'opacité totale
  au fil du temps sans ce correctif.
- **Confort en mode paysage sur mobile (correctif post-lancement)** : fait. Voir
  « Confort en mode paysage sur mobile (correctif post-lancement) » ci-dessus : mise en
  page en grille sous `@media (orientation: landscape) and (max-height: 500px)`
  (téléphones en paysage uniquement, jamais tablettes/desktop) — plateau à gauche prenant
  toute la hauteur disponible, titre/bouton Son/HUD/barre de tours en colonne compacte à
  droite ; `Jeu.redimensionner()` plafonne désormais aussi la hauteur du canvas dans ce
  mode (jusqu'ici seule la largeur comptait) ; plateau épinglé (`position: sticky`) pour
  rester visible même si la colonne latérale doit occasionnellement défiler sur les plus
  petits téléphones. Portrait et desktop strictement inchangés.
- **Son du tir du Canon inaudible (correctif post-lancement)** : fait. Voir « Son du tir
  du Canon inaudible (correctif post-lancement) » ci-dessus : pas un bug de code (le son
  se déclenchait bien à chaque tir, vérifié par instrumentation de l'API Web Audio), mais
  une onde sinusoïdale pure à 180 Hz quasiment inaudible sur les haut-parleurs de
  téléphone/ordinateur portable. Remplacée par une onde triangle avec glissando
  220 Hz → 90 Hz, plus riche en harmoniques et donc effectivement audible, tout en
  restant la tonalité de tir la plus grave et la plus longue des trois.
- **Silhouettes robotiques (« phase 7A »)** : fait. Voir « Silhouettes robotiques
  (phase 7A) » ci-dessus : remplace le cercle uni des ennemis (phase 4A) par trois
  châssis distincts vus de haut (Standard : hexagone + capteur + chenilles ; Rapide :
  flèche mousse sans chenilles ; Blindé : hexagone large + plaques d'armure + gros
  capteur), orientés dans le sens du déplacement via une nouvelle propriété
  `Ennemi.angleDirection`. Halo neon retiré des ennemis à cette occasion (existait
  depuis la 4A, contrairement à ce qu'affirmait le prompt de cette phase) : plusieurs
  formes par châssis en auraient multiplié le coût de rendu. Repère `// PHASE 7F :`
  laissé pour un futur châssis de drone volant. Aucune régression sur le ciblage, la
  barre de vie reste horizontale, fluide à 60 ennemis (1,1 ms/frame en moyenne).
- **Chemins façon route (« phase 7B »)** : fait. Voir « Chemins façon route (phase 7B) »
  ci-dessus : asphalte opaque + taches d'usure (reproductibles à graine égale, via
  `Aleatoire`) + trottoirs sur les seules arêtes extérieures d'une case de chemin
  (détectées par simple voisinage de grille, calculées une fois à la génération), ligne
  centrale animée existante conservée mais amincie. Croisement le plus serré possible
  (une case partagée) vérifié sans aucun trottoir parasite. Liseré générique de grille
  retiré des cases de chemin (nécessaire pour des jonctions propres, non prévu tel quel
  par le prompt). `Config.COULEURS.caseChemin` supprimé, remplacé par
  `asphalte`/`bordureRoute`/`tacheAsphalte`. Aucune régression sur la transparence du
  plateau (7C bis) ni sur la fluidité (0,35 ms/frame en moyenne à 60 ennemis).
- **Flux animé masqué en vague (correctif post-7B)** : fait. Voir « Flux animé masqué
  en vague (correctif post-7B) » ci-dessus : le tracé pointillé animé de chaque route ne
  se dessine plus tant que `Vagues.enCours` est vrai, et réapparaît de lui-même à la fin
  de la vague — asphalte, trottoirs et marqueurs départ/arrivée restent, eux, affichés
  sans condition.
- **Tour Flak (« phase 7D »)** : fait. Voir « Tour Flak (phase 7D) » ci-dessus :
  quatrième type de tour à dégâts de zone (`typeDegats`, désormais explicite sur les
  quatre types), socle carré large et quatre canons en éventail dans une teinte vert
  néon distincte, changement de signature de `Projectile.mettreAJour` répercuté partout
  sans changer le comportement des trois types existants. Amélioration, vente et bonus
  de progression fonctionnent nativement, vérifié en jouant (niveau 1 à 7, palier
  +20 % dégâts, vente). Explosion toujours visible même sans ennemi touché. Fluide à
  8 tours actives contre 60 ennemis groupés (0,52 ms/frame). Écart signalé : aucun
  système d'« encoches » de niveau n'existe dans ce dépôt — l'indicateur réel (halo
  intensifié) s'applique déjà au Flak sans code spécifique.
- **Tour Caserne (« phase 7E »)** : fait. Voir « Tour Caserne (phase 7E) » ci-dessus :
  cinquième type de tour, le seul qui ne tire jamais — fait apparaître une unité
  statique (`UniteCaserne`, nouveau fichier `unite.js`) qui bloque physiquement une
  case de chemin adjacente à la construction (`Carte.estAdjacentAUnChemin`) et combat
  au corps à corps ce qui s'y presse, avec réapparition différée après destruction.
  Réutilise telles quelles les formules de montée en niveau des autres tours
  (réinterprétées : dégâts/PV de l'unité montent avec le multiplicateur de dégâts,
  délai de réapparition diminue avec le multiplicateur de cadence). Amélioration,
  vente et crédits à la mort fonctionnent nativement, vérifié en jouant. Bug découvert
  et corrigé en testant : une amélioration figeait la valeur absolue des PV de l'unité
  au lieu de préserver son ratio, faisant chuter artificiellement le pourcentage de vie
  affiché d'une unité pourtant jamais touchée. Comportement observé au-delà de la
  limite déjà assumée par le prompt (ennemis superposés) : un ennemi ayant dépassé le
  point de blocage pendant que l'unité était morte se refige si celle-ci réapparaît
  ensuite — fidèle à l'algorithme demandé, documenté comme tel. Fluide à 6 Casernes
  actives contre 60 ennemis répartis sur deux chemins (0,67 ms/frame). Aucune
  régression sur les quatre types existants.
- **Le triangle Flak/Caserne/Drone (« phase 7F »)** : fait. Voir « Le triangle
  Flak/Caserne/Drone (phase 7F) » ci-dessus : ennemi volant à trajectoire indépendante
  des chemins (ligne droite tirée via `Aleatoire`, du bord haut au bord bas), ciblable
  par le seul Flak (`peutViserVolant`), ignorant totalement le blocage des Casernes.
  `Ennemi.progression()` généralise le calcul de progression (sol et air) à la place de
  l'ancienne `Tour.progressionEnnemi`. Arrivée/intégrité et exclusion du blocage
  fonctionnent nativement, vérifié plutôt que supposé : aucune ligne ajoutée à
  `Jeu.simuler` ni à `Jeu.resoudreCombatsCasernes`. Aucune régression sur les ennemis au
  sol, les quatre autres tours ou la Caserne. **Déséquilibre mesuré, signalé puis
  corrigé** (contenu additionnel post-lancement) : un Flak de niveau 1 ne pouvait
  structurellement jamais abattre un drone en un seul passage, même dans le meilleur cas
  géométrique (2 tirs possibles au mieux, 3 nécessaires à `degats: 20`) — 1 seul drone
  sur 20 abattu dans un test avec trajectoires aléatoires réalistes contre un Flak isolé
  bien placé. Corrigé en relevant `Config.TYPES_TOURS.flak.degats` à `26` (2 tirs = 52
  dégâts > 50 PV) : le même test passe à 15 drones sur 20 abattus, sans toucher à la
  portée, à la cadence ni au coût du Flak, ni aux PV/vitesse/récompense du drone. Voir
  « Vérification de l'équilibrage demandé » ci-dessus pour le détail.
- **Vagues de boss (« phase 7G »)** : fait. Voir « Vagues de boss (phase 7G) »
  ci-dessus : un ennemi au sol ordinaire (suit un chemin, bloqué par une Caserne,
  ciblé par les quatre tours au sol) mais avec un gabarit et des PV très supérieurs
  (2000), apparaissant en tête d'une escorte réduite tous les `VAGUE_INTERVALLE_BOSS`
  paliers (5), y compris en mode Sans fin au-delà de la vague 20. Silhouette octogonale
  à quatre protubérances, nettement distincte du Blindé, taille fixée à 2,5× la sienne
  plutôt que dérivée de la formule proportionnelle aux PV. Bandeau d'annonce et son
  d'alerte dédiés, déclenchés une seule fois par vague de boss (vérifié). Ciblage,
  blocage/combat de Caserne (35 dégâts/s contre 20 pour le Blindé), récompense et perte
  d'intégrité fonctionnent tous nativement, vérifié plutôt que supposé : aucune ligne
  ajoutée à `Jeu.simuler` ni à `Tour.chercherCible`. Aucune régression constatée
  (partie réelle jusqu'à la fin d'une vague de boss, 2888 frames, aucune erreur
  console). **Calibrage vérifié et confirmé intentionnel** : 2000 PV de base rendent la
  toute première vague de boss (vague 5 sur 20 en partie Standard) très difficile à
  abattre pour un joueur qui ne dispose typiquement que de quelques tours de bas
  niveau à ce stade — confirmé être le comportement recherché plutôt qu'un
  déséquilibre à corriger, contrairement au Flak face au drone (phase 7F). Écart
  signalé séparément : la vitesse fournie par le prompt (40) contredit sa propre
  description (« plus lent que le Blindé », qui vaut 35) — conservée telle quelle, en
  signalant la
  contradiction plutôt qu'en la tranchant unilatéralement.
