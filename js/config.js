// config.js — Rassemble toutes les valeurs réglables du jeu au même endroit.
// Aucune constante numérique « magique » ne doit apparaître ailleurs dans le code :
// si on veut changer l'allure du jeu, c'est ici et seulement ici qu'on touche.

const Config = {
    // Dimensions de la grille de jeu, en nombre de cases.
    COLONNES: 20,
    LIGNES: 12,

    // Un chemin trop court traverserait l'écran en ligne quasi droite : peu intéressant
    // pour placer des tours plus tard. On impose donc une longueur minimale de cases.
    LONGUEUR_CHEMIN_MIN: 32,

    // Empêche le chemin de zigzaguer verticalement sans jamais avancer : au bout de ce
    // nombre de pas verticaux consécutifs, on force une progression vers la droite.
    MAX_DEPLACEMENTS_VERTICAUX: 3,

    // Le chemin ne doit jamais longer la toute première ou la toute dernière ligne de
    // la grille : sinon les tours ne pourraient être posées que d'un seul côté sur ces
    // portions, et la ligne opposée resterait inutilisée faute d'ennemi à portée.
    // LIGNE_MAX est calculée juste après cet objet, une fois LIGNES connu.
    LIGNE_MIN: 1,

    // Nombre de tentatives de génération avant d'abandonner et d'utiliser un chemin de
    // secours codé en dur. Garantit que le jeu ne reste jamais bloqué à générer une carte.
    MAX_TENTATIVES_GENERATION: 100,

    // Chemins multiples (phase 6A) : nombre de chemins distincts générés sur chaque
    // carte, chacun avec sa propre entrée et sortie (voir Carte.chemins dans carte.js).
    // Un chemin peut croiser un autre, mais jamais se toucher lui-même — voir la note
    // sur caseValidePourChemin dans carte.js.
    NOMBRE_CHEMINS: 2,
    // Écart minimal, en lignes, entre deux entrées (et indépendamment, entre deux
    // sorties) : purement visuel, pour qu'elles restent des points d'entrée/sortie
    // distincts à l'œil plutôt que de se chevaucher. N'influence jamais le tracé
    // lui-même (voir caseValidePourChemin), seulement le choix de la ligne de départ.
    ECART_MIN_ENTREES_SORTIES: 3,

    // Limite de tours constructibles (phase 6B) : une proportion plutôt qu'un nombre
    // fixe, puisque la surface réellement constructible d'une carte à deux chemins
    // varie d'une génération à l'autre (les tracés se croisent plus ou moins selon la
    // graine). Calculée une seule fois par partie, juste après la génération de la
    // carte (voir Jeu.limiteTours dans jeu.js) :
    // Math.floor(nombreDeCasesLibres * PROPORTION_LIMITE_TOURS). Valeur de départ
    // choisie arbitrairement (la moitié des cases libres reste toujours disponible,
    // l'autre moitié peut être construite) ; à ajuster par test manuel du jeu réel
    // plutôt que par un nouveau round de outils/simulation-equilibrage.js — voir la
    // mesure informative de cases libres qui y a été ajoutée pour cette phase.
    PROPORTION_LIMITE_TOURS: 0.5,

    // Poids de probabilité pour chaque direction lors du tracé du chemin (doivent
    // sommer à peu près à 1). Favoriser la droite fait avancer le chemin plus sûrement
    // vers le bord opposé.
    POIDS_DROITE: 0.55,
    POIDS_HAUT: 0.225,
    POIDS_BAS: 0.225,

    // Palette cyberpunk (phase 4A) : fond bleu-nuit très sombre, cases dans les mêmes
    // tons pour ne jamais rivaliser avec les néons (tours, ennemis, projectiles,
    // départ/arrivée) qui doivent rester les seuls points lumineux de la scène.
    COULEURS: {
        fond: '#0b0b14',
        caseLibre: '#14141f',
        lisere: '#26263a',

        // Variantes semi-transparentes de `fond`/`caseLibre` ci-dessus, pour que le
        // décor d'arrière-plan (phase 7C, decor.js) transparaisse légèrement à travers
        // le plateau lui-même sur ses cases libres, jamais sur les cases de chemin
        // (Carte.dessiner y peint désormais `asphalte`, pleinement opaque — voir plus
        // bas et « Chemins façon route (phase 7B) »). Mêmes teintes que
        // `fond`/`caseLibre`, seulement rendues translucides ; aucune des deux valeurs
        // ci-dessus n'est modifiée, toujours utilisées telles quelles ailleurs si
        // besoin.
        fondTranslucide: 'rgba(10, 14, 23, 0.7)',
        caseLibreTranslucide: 'rgba(18, 24, 43, 0.6)',
        depart: '#39ff88',
        arrivee: '#ff2d6b',

        // Chemins façon route (phase 7B, contenu additionnel post-lancement) :
        // remplacent l'ancien aplat uni `caseChemin` ('#33334a', retiré — plus
        // référencé nulle part une fois Carte.dessiner mis à jour). `asphalte` est
        // l'aplat de base des cases de chemin ; `tacheAsphalte` une légère texture
        // d'usure semée dessus (voir Carte.genererTachesAsphalte) ; `bordureRoute` les
        // segments de trottoir sur les arêtes extérieures du tracé (voir
        // Carte.calculerSegmentsBordure). Ajoutées ici, dans Config.COULEURS plutôt
        // que dans un objet Config.PALETTE séparé comme l'esquissait le prompt de
        // cette phase — même écart, pour la même raison, que celui déjà documenté
        // pour le décor (phase 7C) et l'image de fond (7C bis) juste plus bas.
        asphalte: '#23262e',
        bordureRoute: 'rgba(210, 214, 225, 0.5)',
        tacheAsphalte: 'rgba(0, 0, 0, 0.15)',
        // Teinte distincte par chemin (phase 6A), indexée par cheminIndex : utilisée
        // pour le flux animé le long du tracé et pour les marqueurs de départ/arrivée
        // de ce chemin (qui remplacent, pour cet usage, `depart`/`arrivee` ci-dessus —
        // conservées telles quelles pour ne rien casser d'autre qui les lirait). C'est
        // ce qui rend un croisement lisible à l'œil : deux chemins qui se touchent
        // restent chacun reconnaissables à leur couleur. Étendre ce tableau si
        // Config.NOMBRE_CHEMINS dépasse un jour sa longueur.
        cheminsNeon: ['#22e8ff', '#ff2df5'],

        // Décor d'arrière-plan en parallaxe (phase 7C, contenu additionnel
        // post-lancement) : deux couches de silhouettes de bâtiments visibles dans les
        // marges autour du plateau, sur le second canvas dédié (voir decor.js). Ajoutées
        // ici, dans Config.COULEURS plutôt que dans un objet Config.PALETTE séparé comme
        // l'esquissait le prompt de cette phase — Config.COULEURS *est* déjà la palette
        // du jeu depuis la phase 4A ; lui ajouter un second objet parallèle aurait
        // fragmenté les couleurs en deux sources de vérité sans raison. decorProche est
        // délibérément plus claire/saturée que decorLointain pour renforcer l'impression
        // de profondeur (en plus de sa vitesse de défilement supérieure, voir plus bas).
        decorLointain: '#0d1326',
        decorProche: '#161f3d',
        // Fenêtres éclairées, teinte cyan discrète — statiques pour cette phase (pas de
        // clignotement, voir decor.js).
        decorFenetre: 'rgba(0, 255, 240, 0.35)',

        // Tour Flak (phase 7D, contenu additionnel post-lancement) : teinte
        // militaire/toxique, distincte des trois couleurs de tour existantes (cyan,
        // orange, magenta — voir TYPES_TOURS ci-dessous). Nommée ici comme demandé,
        // mais `TYPES_TOURS.flak.couleur` en répète la valeur littéralement plutôt que
        // de lire `Config.COULEURS.neonVert` : les quatre types de tour stockent déjà
        // chacun leur couleur en dur (`'cyan'`, `'orange'`, `'magenta'`), jamais via
        // une référence à Config.COULEURS, et un objet en cours de construction ne
        // peut de toute façon pas encore se lire lui-même à ce stade du fichier.
        neonVert: '#7fff6b',

        // Unité de la tour Caserne (phase 7E, unite.js) : seule couleur de ce groupe
        // effectivement *lue* via Config.COULEURS (UniteCaserne.dessiner n'est pas
        // construite dans ce même objet Config, contrairement à TYPES_TOURS.caserne
        // ci-dessous qui répète la valeur en dur pour la même raison qu'expliqué
        // pour neonVert juste au-dessus).
        neonBleu: '#3b82f6',

        // Drone (phase 7F, ennemi.js) : teinte glacée réservée à cet ennemi, pour
        // qu'il tranche visuellement avec tout le reste du plateau (aucun autre
        // ennemi ni tour ne s'approche du blanc). Répétée en dur dans la table
        // COULEURS_CSS_ENNEMIS d'ennemi.js (comme 'cyan'/'jaune'/'orange' déjà
        // avant elle) plutôt que lue ici par référence — cette table de
        // correspondance existe justement parce que ces noms ne sont pas tous des
        // mots-clés CSS valides pour un canvas, indépendamment de Config.COULEURS.
        neonBlanc: '#e8f4ff',

        // Boss (phase 7G, ennemi.js) : rouge franc, sans équivalent parmi les couleurs
        // des trois types au sol existants (cyan/jaune/orange) ni du drone (blanc
        // glacé) — associe naturellement la teinte à la menace la plus dangereuse du
        // jeu. Répétée en dur dans COULEURS_CSS_ENNEMIS d'ennemi.js, même écart déjà
        // documenté pour neonBlanc juste au-dessus.
        neonRouge: '#ff2b2b',

        // Cases bloquées près des chemins (contenu additionnel post-lancement,
        // carte.js) : gris sombre neutre, délibérément terne — contrairement à toutes
        // les autres couleurs de cette palette, cet obstacle ne doit surtout pas
        // attirer l'œil comme le ferait un élément néon du thème cyberpunk, au risque
        // de le faire ressembler à quelque chose d'interactif.
        gravats: '#4a4d55'
    },

    // Rayon de flou (ctx.shadowBlur) des halos néon (phase 4A). Toujours posé puis
    // retiré (ctx.shadowBlur = 0) immédiatement après l'élément concerné, sous peine
    // de faire baver le halo sur tout ce qui est dessiné ensuite dans la même frame.
    // Seuls les éléments peu nombreux par frame *et* dessinés en une seule forme
    // (tours, départ/arrivée) portent un halo : les particules (phase 4B,
    // potentiellement des centaines) et les projectiles (jusqu'à
    // TAILLE_POOL_PROJECTILES actifs) en sont volontairement privés, le flou ayant un
    // coût de rendu par appel qui ne vaudrait pas le gain visuel à cette échelle. Les
    // ennemis en faisaient partie jusqu'à la phase 7A (un simple cercle, un seul
    // appel de shadowBlur) ; leurs silhouettes de robot, composées de plusieurs
    // formes par ennemi (corps, capteur, chenilles/plaques), en ont perdu le halo à
    // cette occasion — même principe de coût par appel, mais désormais multiplié par
    // le nombre de formes de chaque châssis plutôt qu'un seul cercle (voir
    // Ennemi.dessiner, ennemi.js).
    HALO_FLOU_TOUR_BASE: 6,
    // Le halo d'une tour s'intensifie légèrement à chaque amélioration, pour que le
    // niveau d'une tour se lise aussi d'un coup d'œil sans dépendre uniquement du
    // panneau d'amélioration (voir Tour.dessiner dans tour.js).
    HALO_FLOU_TOUR_PAR_NIVEAU: 1.2,
    HALO_FLOU_POINT_CHEMIN: 10,
    // Halo léger des bâtiments du décor (phase 7C) : ce second canvas ne contient
    // jamais plus d'une quinzaine de formes au total (DECOR_NOMBRE_BATIMENTS_LOINTAIN +
    // _PROCHE), sans rapport avec les dizaines d'ennemis ou centaines de particules du
    // plateau de jeu — voir la note détaillée dans Decor.dessinerCouche (decor.js) sur
    // pourquoi ce n'est pas une contradiction avec la règle « pas de shadowBlur sur les
    // éléments nombreux » posée juste au-dessus.
    DECOR_HALO_FLOU: 8,

    // Décor d'arrière-plan en parallaxe (phase 7C, voir decor.js) : deux couches de
    // silhouettes de bâtiments, visibles dans les marges autour du plateau de jeu.
    // Vitesses en pixels par seconde ; la couche proche défile plus vite que la
    // lointaine, comme dans tout effet de parallaxe.
    DECOR_VITESSE_LOINTAIN: 4,
    DECOR_VITESSE_PROCHE: 10,
    DECOR_NOMBRE_BATIMENTS_LOINTAIN: 8,
    DECOR_NOMBRE_BATIMENTS_PROCHE: 6,

    // Chemins façon route (phase 7B, voir carte.js) : nombre de petites taches
    // d'usure semées sur chaque case de chemin (Carte.genererTachesAsphalte, tirées
    // via Aleatoire — contrairement au décor ci-dessus, ceci fait partie du rendu de
    // la carte elle-même et doit rester reproductible à graine égale), et épaisseur
    // des segments de trottoir (Carte.calculerSegmentsBordure), en pixels à l'échelle
    // de référence — multipliée par Jeu.facteurEchelle au moment du tracé, comme
    // toute autre distance du jeu (voir la note sur ce facteur dans jeu.js).
    NOMBRE_TACHES_PAR_CASE_CHEMIN: 3,
    LARGEUR_BORDURE_ROUTE: 2,

    // Cases inconstructibles près des chemins (contenu additionnel post-lancement) :
    // une case autrement 'LIBRE' orthogonalement adjacente à un chemin a cette
    // probabilité de devenir 'BLOQUEE' à la génération (Carte.genererCasesBloquees,
    // via Aleatoire — même principe que NOMBRE_TACHES_PAR_CASE_CHEMIN ci-dessus,
    // reproductible à graine égale), inconstructible en permanence pour toute la
    // partie, y compris pour la Caserne. `gravats` (ci-dessous, Config.COULEURS) est
    // ajoutée directement à la palette existante plutôt que dans un objet `PALETTE`
    // séparé — même écart déjà documenté pour `neonBlanc`/`neonRouge` plus haut.
    PROPORTION_CASES_BLOQUEES_PRES_CHEMIN: 0.3,

    // Caractéristiques de chaque type d'ennemi. La vitesse est en pixels par seconde,
    // à l'échelle de référence de la carte (20 colonnes) : sur une carte plus large ou
    // plus étroite en pratique, la vitesse relative resterait la même car le nombre de
    // cases à traverser change dans les mêmes proportions.
    // `degatsCorpsACorps` (phase 7E) : dégâts par seconde infligés à une unité de
    // Caserne qui bloque cet ennemi (voir Jeu.resoudreCombatsCasernes) — jamais lus
    // ailleurs, sans effet sur le ciblage des tours à distance. Le Blindé, déjà lent
    // et résistant, est aussi le plus dangereux au corps à corps : cohérent avec son
    // rôle de brute lourde plutôt qu'un simple porteur de gros points de vie.
    // `vole` (phase 7F) : true seulement pour le drone — aucune notion de chemin, un
    // trajet en ligne droite du bord haut au bord bas de la grille (voir
    // Ennemi.deplacer). `degatsCorpsACorps: 0` : un drone ne peut de toute façon
    // jamais être bloqué par une Caserne (il l'ignore entièrement, voir la note
    // correspondante dans Ennemi.deplacer), cette valeur ne sera donc jamais lue en
    // pratique, mais reste posée à 0 plutôt qu'omise pour que la propriété existe de
    // façon uniforme sur les quatre types, sans condition supplémentaire à écrire
    // ailleurs pour un champ qui manquerait. Volontairement fragile (50 PV, bien
    // moins qu'un Standard) : sa menace vient de ce qu'il contourne toute la défense
    // au sol, pas de sa résistance — un Flak bien placé doit pouvoir l'abattre sans
    // difficulté excessive.
    //
    // `boss` (phase 7G) : un ennemi au sol ordinaire à tous égards (suit un chemin,
    // peut être bloqué par une Caserne, ciblé par les quatre tours au sol comme
    // n'importe quel autre type — `vole` explicitement à `false`, comme les trois
    // types ci-dessus, par symétrie avec le `true` du drone plutôt que pour un effet
    // fonctionnel différent) sauf son gabarit et ses points de vie, très supérieurs à
    // tout le reste (2000, contre 300 au maximum jusqu'ici pour le Blindé) : sa
    // menace vient entièrement de sa capacité d'encaissement.
    // Écart signalé plutôt que corrigé unilatéralement (voir ARCHITECTURE.md) : le
    // prompt de cette phase décrit le boss comme « volontairement lent, plus lent que
    // le Blindé », mais fournit une vitesse de 40, alors que le Blindé (ci-dessus)
    // vaut 35 — le boss est donc en réalité légèrement plus rapide que le Blindé, pas
    // plus lent. La valeur numérique explicite du prompt (40) a été conservée telle
    // quelle plutôt que la description contradictoire, cette dernière n'étant sans
    // doute qu'une approximation erronée du rapport entre les deux vitesses.
    // `degatsCorpsACorps: 35`, nettement au-dessus du Blindé (20) : en fait la menace
    // la plus sérieuse au corps-à-corps contre une unité de Caserne rencontrée
    // jusqu'ici.
    TYPES_ENNEMIS: {
        standard: { pointsDeVie: 100, vitesse: 60, recompense: 10, couleur: 'cyan', degatsCorpsACorps: 8 },
        rapide: { pointsDeVie: 60, vitesse: 110, recompense: 15, couleur: 'jaune', degatsCorpsACorps: 4 },
        blinde: { pointsDeVie: 300, vitesse: 35, recompense: 25, couleur: 'orange', degatsCorpsACorps: 20 },
        drone: { pointsDeVie: 50, vitesse: 90, recompense: 20, couleur: 'neonBlanc', vole: true, degatsCorpsACorps: 0 },
        boss: { pointsDeVie: 2000, vitesse: 40, recompense: 150, couleur: 'neonRouge', vole: false, degatsCorpsACorps: 35 }
    },

    // À partir de quelle vague le drone commence à apparaître, et dans quelle
    // proportion des ennemis générés ce jour-là (phase 7F) — même mécanisme que
    // VAGUE_APPARITION_RAPIDE/BLINDE ci-dessous, mais consommé séparément dans
    // Vagues.mettreAJour (le drone n'est pas un quatrième choix de
    // Vagues.tirerTypeEnnemi, qui ne concerne que les ennemis au sol assignés à un
    // chemin : un tirage dédié décide d'abord si cette apparition est un drone,
    // avant même de songer à un chemin).
    VAGUE_APPARITION_DRONE: 8,
    PROPORTION_DRONE: 0.15,

    // Vagues de boss (phase 7G) : tous les VAGUE_INTERVALLE_BOSS paliers (5, 10, 15…,
    // y compris au-delà du nombre de vagues d'une partie Standard/Longue puisqu'un
    // simple modulo sur le numéro de vague ne dépend jamais de Jeu.nombreDeVagues —
    // valable aussi bien en mode Sans fin qu'au-delà de la vague 20), la composition
    // habituelle d'une vague (voir Vagues.demarrer) est remplacée par un unique boss
    // en tête de file suivi d'une escorte réduite à environ
    // PROPORTION_ESCORTE_VAGUE_BOSS fois son effectif normal.
    VAGUE_INTERVALLE_BOSS: 5,
    PROPORTION_ESCORTE_VAGUE_BOSS: 0.5,

    // Nombre de points d'intégrité au départ. Chaque ennemi qui atteint l'arrivée en
    // retire un peu ; à zéro, la partie est perdue.
    INTEGRITE_DEPART: 20,
    DEGATS_INTEGRITE_PAR_ENNEMI: 1,

    // Cadence d'apparition des ennemis au sein d'une vague : l'intervalle de départ
    // diminue à chaque vague pour accélérer le rythme, avec un plancher pour ne
    // jamais faire apparaître les ennemis les uns sur les autres.
    INTERVALLE_APPARITION_INITIAL: 1.2,
    REDUCTION_INTERVALLE_PAR_VAGUE: 0.03,
    INTERVALLE_APPARITION_MIN: 0.4,

    // À partir de quelle vague chaque type avancé commence à apparaître, et dans
    // quelle proportion parmi les ennemis générés ce jour-là.
    VAGUE_APPARITION_RAPIDE: 3,
    PROPORTION_RAPIDE: 0.25,
    VAGUE_APPARITION_BLINDE: 6,
    PROPORTION_BLINDE: 0.20,

    // Durées de partie proposées à l'écran d'accueil. `nombreDeVagues` vaut Infinity
    // pour le mode Sans fin : tout code qui affiche ou calcule une progression à
    // partir de cette valeur doit vérifier Number.isFinite() avant, sous peine
    // d'afficher NaN ou de mal se comporter.
    DUREES_PARTIE: [
        { id: 'rapide',   label: 'Rapide',   nombreDeVagues: 10,       description: '10 vagues — environ 6 minutes' },
        { id: 'standard', label: 'Standard', nombreDeVagues: 20,       description: '20 vagues — environ 12 minutes' },
        { id: 'longue',   label: 'Longue',   nombreDeVagues: 35,       description: '35 vagues — environ 20 minutes' },
        { id: 'sansfin',  label: 'Sans fin', nombreDeVagues: Infinity, description: 'Survivez le plus longtemps possible' }
    ],
    DUREE_PAR_DEFAUT: 'standard',

    // Plafond appliqué à dt (en secondes) dans la boucle de jeu. Sans lui, revenir sur
    // l'onglet après une longue absence produirait un dt énorme (le navigateur suspend
    // l'exécution pendant que l'onglet est en arrière-plan) et les ennemis
    // traverseraient la carte instantanément au réveil.
    DT_MAXIMUM: 0.05,

    // Largeur de canvas pour laquelle toutes les valeurs de vitesse et de distance
    // ci-dessus (et ci-dessous) ont été calibrées, soit une case de 40 px
    // (800 / COLONNES). Voir Jeu.facteurEchelle dans jeu.js pour le mécanisme qui
    // adapte ces valeurs à la taille réelle du canvas.
    LARGEUR_REFERENCE: 800,

    // Crédits de départ, dépensés pour construire des tours.
    CREDITS_DEPART: 150,

    // Caractéristiques de chaque type de tour (phase 2A). Portée en pixels, à
    // l'échelle de référence (comme Config.TYPES_ENNEMIS, voir Jeu.facteurEchelle).
    // Équilibrage voulu : la Mitrailleuse a le meilleur ratio dégâts/seconde par
    // crédit dépensé, le Canon un ratio intermédiaire, et le Sniper le plus faible
    // des trois sur ce seul critère — sa valeur vient de sa portée bien supérieure,
    // qui lui permet de tirer sur un ennemi bien avant que celui-ci n'entre dans la
    // portée des deux autres types sur un même chemin. Une tour n'a donc pas besoin
    // d'être rentable en dégâts/coût pour être utile.
    // `typeDegats` ('unique' ou 'zone', phase 7D) rend explicite partout, plutôt que
    // supposé par défaut, comment une tour répartit ses dégâts à l'impact — voir
    // Projectile.mettreAJour (tour.js) qui bifurque dessus. Le Flak est pour l'instant
    // la seule tour à valoir 'zone' : ses dégâts unitaires sont volontairement
    // modestes (comparables à la Mitrailleuse), parce que sa valeur ne vient pas d'un
    // gros dégât sur une cible mais du fait qu'il touche potentiellement plusieurs
    // ennemis à la fois — contre un ennemi isolé, il reste nettement moins rentable
    // qu'un Canon. Même principe que la portée du Sniper (phase 2A, voir la note
    // juste au-dessus) : sa force ne se lit pas dans un simple ratio dégâts/coût.
    // La Caserne (phase 7E) ne tire pas : `degats`/`cadence` ci-dessous ne pilotent
    // jamais un tir (voir Tour.mettreAJour, qui bifurque entièrement sur
    // typeDegats === 'caserne' avant même de lire ces deux champs pour ça), mais sont
    // volontairement fixés à des valeurs qui, une fois passées dans la même formule
    // de montée en niveau que les autres tours (Tour.recalculerStats, inchangée),
    // produisent exactement les nombres réinterprétés dont la Caserne a besoin :
    // `cadence: 1` fait que `this.cadence` (générique) *est* directement le
    // multiplicateur de niveau à appliquer au délai de réapparition
    // (CASERNE_DELAI_RESPAWN_BASE / this.cadence, voir Tour.mettreAJourCaserne) ; et
    // `degats: CASERNE_UNITE_DEGATS_BASE` (même valeur que la constante dédiée plus
    // bas, délibérément) documente que le degatsBase générique de cette tour
    // correspond bien aux dégâts de base de son unité — même si, par clarté, le
    // calcul réel des stats de l'unité relit directement les constantes CASERNE_*
    // dédiées plutôt que `this.degats`, voir Tour.statsUniteAuNiveauActuel.
    // `peutViserVolant` (phase 7F) : la bascule qui active tout le ciblage du drone —
    // voir Tour.chercherCible, qui ignore complètement un ennemi volant pour toute
    // tour dont ce champ n'est pas vrai, comme s'il n'existait pas. Le Flak est pour
    // l'instant la seule tour à valoir true.
    TYPES_TOURS: {
        mitrailleuse: { nom: 'Mitrailleuse', portee: 100, degats: 10, cadence: 4, cout: 40, couleur: 'cyan', typeDegats: 'unique', peutViserVolant: false },
        canon: { nom: 'Canon', portee: 120, degats: 45, cadence: 1, cout: 70, couleur: 'orange', typeDegats: 'unique', peutViserVolant: false },
        sniper: { nom: 'Sniper', portee: 200, degats: 80, cadence: 0.5, cout: 100, couleur: 'magenta', typeDegats: 'unique', peutViserVolant: false },
        flak: { nom: 'Flak', portee: 110, degats: 26, cadence: 1.2, cout: 80, couleur: '#7fff6b', typeDegats: 'zone', peutViserVolant: true },
        caserne: { nom: 'Caserne', portee: 60, degats: 15, cadence: 1, cout: 90, couleur: '#3b82f6', typeDegats: 'caserne', peutViserVolant: false }
    },
    TYPE_TOUR_PAR_DEFAUT: 'mitrailleuse',

    // Unité de blocage de la Caserne (phase 7E, voir tour.js/unite.js). Comme pour les
    // autres tours, ces bases montent avec le niveau de la tour via les mêmes
    // multiplicateurs d'amélioration que les autres types — jamais de nouvelle
    // constante d'amélioration dédiée, voir Tour.statsUniteAuNiveauActuel : `degats`
    // et `pointsDeVie` de l'unité montent avec AMELIORATION_MULTIPLICATEUR_DEGATS
    // (une Caserne de niveau supérieur forme un soldat plus solide et plus mordant),
    // et le délai de réapparition diminue avec AMELIORATION_MULTIPLICATEUR_CADENCE
    // (une Caserne améliorée réagit plus vite à la perte de son unité).
    CASERNE_DELAI_RESPAWN_BASE: 6,
    CASERNE_UNITE_PV_BASE: 150,
    CASERNE_UNITE_DEGATS_BASE: 15,

    // Améliorations de tour (phase 2B) : jusqu'à NIVEAU_MAX_TOUR paliers, chacun
    // multipliant dégâts, cadence et portée de base (voir Tour.recalculerStats), ces
    // deux premiers multiplicateurs se composant (chaque palier pèse proportionnellement
    // plus que le précédent sur les dégâts par seconde). Valeur choisie après mesure via
    // outils/simulation-equilibrage.js (rounds 1-3, huit graines, vague 15) : un plafond
    // à 3 (valeur d'origine) donnait un avantage écrasant à la diversification des
    // tours (écart moyen d'intégrité restante de -210,6), un plafond à 8 inversait
    // l'avantage vers une tour unique poussée à fond (+24,6) ; 7 (comme 6) se situe dans
    // la zone où l'écart mesuré entre les deux stratégies reste modéré (-6,3) plutôt
    // qu'écrasant dans un sens ou l'autre.
    NIVEAU_MAX_TOUR: 7,
    AMELIORATION_MULTIPLICATEUR_DEGATS: 1.5,
    AMELIORATION_MULTIPLICATEUR_CADENCE: 1.15,
    AMELIORATION_MULTIPLICATEUR_PORTEE: 1.1,
    // Coût d'un palier = coût d'achat du type * niveau actuel * ce facteur (voir
    // Tour.coutAmelioration) : le palier suivant coûte donc de plus en plus cher.
    AMELIORATION_COUT_FACTEUR: 0.75,
    // Part de l'investissement total (achat + améliorations payées) remboursée à la
    // vente d'une tour (voir Tour.montantVente).
    VENTE_POURCENTAGE_REMBOURSEMENT: 0.7,

    // Caractéristiques des projectiles tirés par les tours. Vitesse en pixels par
    // seconde, à l'échelle de référence.
    PROJECTILE_VITESSE: 400,
    PROJECTILE_RAYON_IMPACT: 6,
    TAILLE_POOL_PROJECTILES: 200,

    // Rayon de l'explosion d'un tir de Flak (phase 7D), en pixels à l'échelle de
    // référence — multiplié par Jeu.facteurEchelle au moment de l'impact, comme toute
    // autre distance du jeu (voir Projectile.mettreAJour, tour.js). Un ennemi vivant
    // situé à moins de cette distance du point d'impact reçoit les dégâts, qu'il ait
    // été la cible verrouillée du projectile ou non.
    FLAK_RAYON_EXPLOSION: 45,

    // Progression du joueur (phase 3A) : niveau et XP qui survivent d'une partie à
    // l'autre (voir Progression dans progression.js), sans aucun effet de gameplay
    // pour l'instant — ni bonus, ni déblocage, voir phase 3B. XP gagnée à la fin
    // d'une partie, par vague effectivement terminée (tous ses ennemis morts ou
    // arrivés) : XP_BASE_PAR_VAGUE + numéro de la vague * XP_BONUS_PAR_NUMERO_VAGUE,
    // pour valoriser un peu plus les vagues tardives que les premières. Un bonus
    // unique s'ajoute en cas de victoire.
    XP_BASE_PAR_VAGUE: 5,
    XP_BONUS_PAR_NUMERO_VAGUE: 1,
    XP_BONUS_VICTOIRE: 50,

    // Le seuil d'XP pour passer du niveau n au niveau n + 1 est
    // XP_SEUIL_NIVEAU_1 * (CROISSANCE_XP_NIVEAU ^ (n - 1)) : chaque niveau demande
    // 15 % d'XP de plus que le précédent (voir Progression.seuilNiveauSuivant). Au
    // niveau maximum, plus aucun seuil n'est calculé : l'XP continue de s'accumuler
    // dans Progression.xpTotale pour d'éventuelles statistiques, sans faire progresser
    // le niveau plus loin.
    //
    // XP_SEUIL_NIVEAU_1 relevé de 100 à 180 après une première mesure : une partie
    // Standard (20 vagues) gagnée rapporte toujours 360 XP (voir le calcul dans
    // Jeu.finaliserPartie), et à 100 les trois premiers seuils cumulés (100+115+132)
    // restaient sous ce total, ce qui faisait gagner 3 niveaux dès la toute première
    // victoire. À 180, ce même calcul (180, puis 180+207=387>360) plafonne la toute
    // première victoire à exactement 1 niveau, sans changer la forme de la courbe :
    // elle continue de se resserrer par la suite exactement comme avant, seulement
    // décalée (environ 45 victoires Standard pour atteindre le niveau maximum au lieu
    // de 25).
    NIVEAU_MAX_JOUEUR: 20,
    CROISSANCE_XP_NIVEAU: 1.15,
    XP_SEUIL_NIVEAU_1: 180,

    // Clé localStorage sous laquelle Progression sauvegarde son état (voir
    // Progression.charger/sauvegarder dans progression.js).
    CLE_SAUVEGARDE: 'defense-neon-progression',

    // Bonus permanents débloqués par niveau de joueur (phase 3B) : actifs dès le
    // début de chaque nouvelle partie une fois débloqués, quelle que soit la durée
    // choisie, et jamais perdus. Indépendants les uns des autres — un joueur de
    // niveau 12 bénéficie des quatre premiers en même temps, pas seulement du
    // dernier atteint. Consultés exclusivement via Progression (estDebloque,
    // bonusCreditsDepart, bonusIntegriteDepart, multiplicateurCoutConstruction,
    // multiplicateurCoutAmelioration, multiplicateurDegats dans progression.js) :
    // aucun autre fichier ne lit ce tableau directement, pour ne jamais avoir qu'un
    // seul endroit à modifier si un palier change. N'ajoute pas de palier
    // supplémentaire ici sans repasser par une réflexion d'équilibrage dédiée (voir
    // outils/simulation-equilibrage.js) : ces cinq-là suffisent à observer pour
    // l'instant.
    PALIERS_BONUS: [
        { niveauRequis: 3, id: 'credits_depart', description: '+20 crédits de départ', valeur: 20 },
        { niveauRequis: 6, id: 'reduction_construction', description: '-5 % sur le coût de construction des tours', valeur: 0.05 },
        { niveauRequis: 9, id: 'integrite_bonus', description: '+2 points d\'intégrité de départ', valeur: 2 },
        { niveauRequis: 12, id: 'reduction_amelioration', description: '-10 % sur le coût des améliorations', valeur: 0.10 },
        { niveauRequis: 16, id: 'bonus_degats', description: '+20 % de dégâts pour toutes les tours', valeur: 0.20 }
    ],

    // Système de particules (phase 4B, voir particules.js) : recyclées via un pool,
    // exactement comme les projectiles (voir la note en tête de tour.js), jamais
    // créées avec `new` en cours de partie.
    PARTICULES_TAILLE_POOL: 300,
    PARTICULE_NOMBRE_EXPLOSION: 10,
    // Explosion d'un tir de Flak (phase 7D) : nettement plus fournie qu'une explosion
    // de mort ordinaire, pour bien matérialiser l'étendue de la zone touchée — voir
    // Particules.creerExplosion (particules.js), dont le nombre de particules est
    // désormais un paramètre optionnel (par défaut PARTICULE_NOMBRE_EXPLOSION
    // ci-dessus, pour ne rien changer aux explosions de mort existantes).
    PARTICULE_NOMBRE_EXPLOSION_ZONE: 16,
    PARTICULE_NOMBRE_IMPACT: 3,
    PARTICULE_NOMBRE_TIR: 3,
    PARTICULE_DUREE_VIE_EXPLOSION: 0.4,
    PARTICULE_DUREE_VIE_IMPACT: 0.2,
    PARTICULE_DUREE_VIE_TIR: 0.12,
    PARTICULE_VITESSE_MIN: 60,
    PARTICULE_VITESSE_MAX: 180,

    // Son entièrement synthétisé (phase 4B, voir son.js) : aucun fichier audio.
    // Volume modéré par défaut, jamais à pleine échelle.
    SON_VOLUME_MAITRE: 0.3,
    CLE_SAUVEGARDE_SON: 'defense-neon-son-actif'
};

// Dernière ligne autorisée pour le chemin, calculée ici plutôt qu'écrite en dur pour
// rester correcte si Config.LIGNES change (soit 10 pour une grille de 12 lignes).
Config.LIGNE_MAX = Config.LIGNES - 2;
