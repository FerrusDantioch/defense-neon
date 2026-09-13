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
        caseChemin: '#33334a',
        depart: '#39ff88',
        arrivee: '#ff2d6b',
        // Teinte distincte par chemin (phase 6A), indexée par cheminIndex : utilisée
        // pour le flux animé le long du tracé et pour les marqueurs de départ/arrivée
        // de ce chemin (qui remplacent, pour cet usage, `depart`/`arrivee` ci-dessus —
        // conservées telles quelles pour ne rien casser d'autre qui les lirait). C'est
        // ce qui rend un croisement lisible à l'œil : deux chemins qui se touchent
        // restent chacun reconnaissables à leur couleur. Étendre ce tableau si
        // Config.NOMBRE_CHEMINS dépasse un jour sa longueur.
        cheminsNeon: ['#22e8ff', '#ff2df5']
    },

    // Rayon de flou (ctx.shadowBlur) des halos néon (phase 4A). Toujours posé puis
    // retiré (ctx.shadowBlur = 0) immédiatement après l'élément concerné, sous peine
    // de faire baver le halo sur tout ce qui est dessiné ensuite dans la même frame.
    // Seuls les éléments peu nombreux par frame (tours, ennemis, départ/arrivée)
    // portent un halo : les particules (phase 4B, potentiellement des centaines) et
    // les projectiles (jusqu'à TAILLE_POOL_PROJECTILES actifs) en sont volontairement
    // privés, le flou ayant un coût de rendu par appel qui ne vaudrait pas le gain
    // visuel à cette échelle.
    HALO_FLOU_TOUR_BASE: 6,
    // Le halo d'une tour s'intensifie légèrement à chaque amélioration, pour que le
    // niveau d'une tour se lise aussi d'un coup d'œil sans dépendre uniquement du
    // panneau d'amélioration (voir Tour.dessiner dans tour.js).
    HALO_FLOU_TOUR_PAR_NIVEAU: 1.2,
    HALO_FLOU_ENNEMI: 5,
    HALO_FLOU_POINT_CHEMIN: 10,

    // Caractéristiques de chaque type d'ennemi. La vitesse est en pixels par seconde,
    // à l'échelle de référence de la carte (20 colonnes) : sur une carte plus large ou
    // plus étroite en pratique, la vitesse relative resterait la même car le nombre de
    // cases à traverser change dans les mêmes proportions.
    TYPES_ENNEMIS: {
        standard: { pointsDeVie: 100, vitesse: 60, recompense: 10, couleur: 'cyan' },
        rapide: { pointsDeVie: 60, vitesse: 110, recompense: 15, couleur: 'jaune' },
        blinde: { pointsDeVie: 300, vitesse: 35, recompense: 25, couleur: 'orange' }
    },

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
    TYPES_TOURS: {
        mitrailleuse: { nom: 'Mitrailleuse', portee: 100, degats: 10, cadence: 4, cout: 40, couleur: 'cyan' },
        canon: { nom: 'Canon', portee: 120, degats: 45, cadence: 1, cout: 70, couleur: 'orange' },
        sniper: { nom: 'Sniper', portee: 200, degats: 80, cadence: 0.5, cout: 100, couleur: 'magenta' }
    },
    TYPE_TOUR_PAR_DEFAUT: 'mitrailleuse',

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
