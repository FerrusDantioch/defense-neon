# Défense Néon — Architecture

HTML/CSS/JS vanilla, sans module ES6 ni dépendance. Fichiers chargés dans cet ordre par
`index.html` : `config.js`, `aleatoire.js`, `carte.js`, `ennemi.js`, `vagues.js`, `tour.js`,
`progression.js`, `particules.js`, `son.js`, `interface.js`, `jeu.js`.

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
  État : `grille`, `chemins` (un chemin unique avant la phase 6A), `tailleCase`.
  Fonctions publiques : `generer(graine)`, `estConstructible(colonne, ligne)`,
  `pixelsVersCase(x, y)`, `caseVersPixels(colonne, ligne)`, `recalculerPixels()`,
  `dessiner(ctx)`.
- **`js/ennemi.js`** — classe `Ennemi` : une unité qui suit son propre chemin
  (`Carte.chemins[this.cheminIndex].pointsDePassage`, `cheminIndex` fixé à la
  création — un seul chemin global avant la phase 6A). Propriétés : `x`, `y`, `type`,
  `pointsDeVie`, `pointsDeVieMax`, `vitesse`, `cheminIndex`, `indexPointDePassage`,
  `recompense`, `vivant`, `arrive`. Méthodes : `deplacer(dt)`, `subirDegats(montant)`
  (sans appelant avant la phase 1C), `dessiner(ctx)`. Une petite table interne
  (`COULEURS_CSS_ENNEMIS`) convertit les noms de couleur de `Config.TYPES_ENNEMIS`
  (ex. `'jaune'`) en couleurs CSS valides pour le canvas.
- **`js/vagues.js`** — objet `Vagues` : décide combien d'ennemis apparaissent, de quel
  type et à quel rythme pour chaque vague, et détecte sa fin. État : `numeroVagueActuelle`,
  `enCours`, `ennemisRestantsAGenerer`, `intervalleCourant`,
  `tempsDepuisDerniereGeneration`, `multiplicateurPointsDeVie`, `credits` (accumulés en
  fin de vague ; récupérés et remis à zéro par `Jeu.boucle`, voir phase 1C ci-dessous).
  Fonctions publiques : `demarrer(numero)`, `mettreAJour(dt, listeEnnemis)`
  (tire aussi, depuis la phase 6A, le `cheminIndex` de chaque ennemi généré via
  `Aleatoire.entier(0, Config.NOMBRE_CHEMINS - 1)` — toujours le générateur à graine,
  jamais `Math.random()`, pour que la répartition reste reproductible), `reinitialiser()`.
- **`js/tour.js`** — classes `Tour` et `Projectile` (phase 1C ; plusieurs types de
  tours depuis la phase 2A ; niveaux, amélioration et vente depuis la phase 2B).
  `Tour` : `colonne`, `ligne`, `x`, `y` (centre de case), `type` (clé de
  `Config.TYPES_TOURS`), `couleur`, `degatsBase`/`cadenceBase`/`porteeBase` (valeurs du
  type au niveau 1, jamais modifiées), `niveau` (1 à `Config.NIVEAU_MAX_TOUR`),
  `investissementTotal` (achat + améliorations payées, base du remboursement à la
  vente), `degats`/`cadence`/`portee` (statistiques effectives courantes, recalculées
  par `recalculerStats()`), `tempsDepuisDernierTir`, `cible`. Méthodes :
  `recalculerStats()` (voir « Niveaux, amélioration et vente » ci-dessous ; intègre
  aussi, depuis la phase 3B, le bonus permanent de dégâts du joueur via
  `Progression.multiplicateurDegats()`), `coutAmelioration()` (idem avec
  `Progression.multiplicateurCoutAmelioration()`, voir « Bonus permanents (phase 3B) »),
  `ameliorer()`, `montantVente()`, `progressionEnnemi(ennemi)` (phase 6A ; voir
  « Chemins multiples (phase 6A) » ci-dessous), `chercherCible(ennemis)`
  (conserve la cible en cours tant qu'elle reste valide et à portée, pour éviter que le
  canon tremble entre deux ennemis à progression égale ; sinon retient l'ennemi à
  portée dont `progressionEnnemi()` est la plus élevée — l'`indexPointDePassage` brut
  avant la phase 6A, quand un seul chemin existait), `mettreAJour(dt, ennemis,
  pool)`, `dessiner(ctx)` (formes distinctes par type et halo néon depuis la phase 4A —
  voir « Identité visuelle cyberpunk (phase 4A) » ci-dessous — plus, depuis la phase 4B,
  déclenchement du flash de tir et du son au moment où `tirer(pool)` active un
  projectile).
  `Projectile` : `x`, `y`, `cible` (référence directe à un `Ennemi`), `degats`,
  `couleur` (celle de la tour tireuse, phase 4B, utilisée uniquement pour teinter la
  particule d'impact — le projectile reste dessiné en blanc), `actif`. Méthodes :
  `activer(x, y, cible, degats, couleur)` (réinitialise une instance du pool au lieu
  d'en créer une nouvelle), `mettreAJour(dt)` (suit la position courante de la cible,
  se désactive sans dégâts si la cible est déjà morte, inflige `degats`, déclenche une
  particule d'impact si la cible survit au coup — phase 4B — et se désactive à
  l'impact), `dessiner(ctx)`.
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
  Voir « Particules et son (phase 4B) » ci-dessous.
- **`js/interface.js`** — objet `Interface` (phase 1D) : tout ce qui concerne l'affichage
  et les interactions — écrans superposés, HUD, clics et survol sur le canvas, messages
  temporaires. Voir « Interface et états de partie » ci-dessous.
- **`js/jeu.js`** — objet `Jeu` : point d'entrée, état de partie et boucle de simulation
  (l'affichage et les interactions vivent dans `interface.js`). État : `etatPartie`,
  `nombreDeVagues`, `idDureeActuelle`, `vitesseJeu`, `ennemisActifs`, `toursActives`,
  `poolProjectiles`, `integrite`, `credits`, `enPause`, `facteurEchelle` (voir « Mise à
  l'échelle des distances » ci-dessous), `limiteTours` (phase 6B, voir « Limite de
  tours (phase 6B) » ci-dessous), `derniereProgression` (résumé de la dernière
  partie terminée pour l'affichage, voir phase 3A). Fonctions publiques :
  `initialiser()`, `redimensionner()`, `initialiserPoolProjectiles()`, `dessinerTout()`,
  `boucle(horodatage)`, `simuler(dt)`, `verifierFinDePartie()`, `finaliserPartie(estVictoire)`,
  `demarrerPartie(idDuree)`, `rejouer()`, `retourAccueil()`, `reinitialiser(idDuree, graine)`.
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
`Carte.dessiner`), tours et ennemis (halo néon de la couleur du type, voir
`Tour.dessiner`/`Ennemi.dessiner`). Ces halos utilisent `ctx.shadowBlur`, toujours reposé
à 0 immédiatement après l'élément concerné pour ne jamais déteindre sur le reste de la
scène dessinée ensuite dans la même frame (voir `Config.HALO_FLOU_TOUR_BASE`,
`HALO_FLOU_ENNEMI`, `HALO_FLOU_POINT_CHEMIN`). Volontairement absent de la grille
elle-même (240 cases dessinées chaque frame) et des particules/projectiles (phase 4B,
potentiellement nombreux) : le coût de rendu par appel de `shadowBlur` n'en vaudrait pas
le gain visuel à cette échelle — seuls les éléments peu nombreux par frame en portent un.

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

`Tour.progressionEnnemi(ennemi)` renvoie
`ennemi.indexPointDePassage / (Carte.chemins[ennemi.cheminIndex].pointsDePassage.length - 1)`,
protégée contre un chemin d'une seule case (renvoie 0 plutôt qu'une division par zéro,
cas extrême improbable vu `Config.LONGUEUR_CHEMIN_MIN`). `Tour.chercherCible` compare
maintenant cette progression normalisée plutôt que `indexPointDePassage` brut : un
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
