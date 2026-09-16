// carte.js — Génère Carte.nombreChemins chemins aléatoires valides du bord gauche
// au bord droit de la grille (phase 6A ; un seul chemin avant ; nombre de chemins
// lui-même variable par carte depuis le troisième chemin occasionnel, contenu
// additionnel post-lancement — voir Carte.generer), stocke l'état de chaque case et
// sait dessiner le résultat sur le canvas (palette cyberpunk et halos néon depuis la
// phase 4A, une teinte distincte par chemin depuis la phase 6A).

const Carte = {
    // Grille d'état : grille[ligne][colonne] vaut 'LIBRE', 'CHEMIN', 'OCCUPEE' (une
    // tour posée sur la case, voir Jeu.tenterConstruireTour dans jeu.js) ou, depuis
    // le contenu additionnel post-lancement traitant des cases inconstructibles,
    // 'BLOQUEE' (obstacle généré une fois pour toute la carte, voir
    // genererCasesBloquees ci-dessous — jamais constructible, y compris pour une
    // Caserne adjacente à un chemin). Une case 'CHEMIN' peut appartenir à plusieurs
    // chemins à la fois (un croisement) : la grille ne distingue pas lequel, seul
    // Carte.chemins le sait.
    grille: [],

    // Gravats (contenu additionnel post-lancement) : gravats[ligne][colonne] vaut un
    // tableau de morceaux de débris si cette case est 'BLOQUEE', `null` sinon — même
    // principe de lookup en O(1) par case que `grille` elle-même, plutôt qu'une liste
    // plate cherchée par colonne/ligne à chaque frame dessinée (voir dessiner()).
    // Chaque morceau : { xFraction, yFraction, largeurFraction, hauteurFraction,
    // angle }, en fraction de tailleCase / radians — même principe que
    // `tachesAsphalte` ci-dessous (converti en pixels réels seulement au dessin).
    gravats: [],

    // Un élément par chemin (Carte.nombreChemins au total, voir plus bas), chacun
    // avec :
    // - chemin : suite ordonnée des cases du chemin, du départ à l'arrivée,
    //   [{colonne, ligne}, ...] ;
    // - pointsDePassage : même information convertie en centres de pixels, recalculée
    //   à chaque redimensionnement (voir recalculerPixels ci-dessous) — c'est ce que
    //   suit un ennemi assigné à ce chemin (Ennemi.deplacer, via son cheminIndex) ;
    // - caseDepart / caseArrivee : première et dernière case du chemin.
    // Remplace, depuis la phase 6A, les anciennes propriétés `chemin`/`pointsDePassage`
    // /`caseDepart`/`caseArrivee` au niveau de Carte elle-même (un seul chemin).
    chemins: [],

    // Nombre de chemins de la carte actuellement générée (contenu additionnel
    // post-lancement, troisième chemin occasionnel) : calculé une seule fois par
    // generer(), tout au début, avant de tracer le moindre chemin — remplace
    // l'ancienne constante fixe Config.NOMBRE_CHEMINS (retirée), puisque ce nombre
    // varie désormais d'une carte à l'autre (2 la plupart du temps, 3
    // occasionnellement, voir Config.PROBABILITE_TROISIEME_CHEMIN). Toujours égal à
    // `this.chemins.length` une fois la génération terminée ; conservé comme
    // propriété à part entière (plutôt que de relire systématiquement
    // `this.chemins.length` ailleurs) parce qu'il est déjà connu avant que
    // `this.chemins` ne soit rempli, au moment précis où generer() en a besoin pour
    // sa boucle de tracé.
    nombreChemins: Config.NOMBRE_CHEMINS_PAR_DEFAUT,

    // Taille d'une case en pixels, fixée par jeu.js selon la taille du canvas. Toutes
    // les conversions pixels <-> case en dépendent.
    tailleCase: 0,

    // Chemins façon route (phase 7B). Les deux tableaux ci-dessous sont calculés une
    // seule fois par generer() (jamais recalculés en boucle : la grille ne change pas
    // en cours de partie) et stockés en unités de case/fraction de case plutôt qu'en
    // pixels bruts — dessiner() les convertit en coordonnées réelles à chaque frame en
    // multipliant simplement par tailleCase, exactement comme il le fait déjà pour
    // chaque case de la grille (x = colonne * taille) : aucun recalcul de géométrie,
    // seulement une multiplication, donc sans impact sur la fluidité même si le
    // canvas est redimensionné.
    //
    // Un segment par arête extérieure d'une case de chemin (voir
    // calculerSegmentsBordure) : { colonne, ligne, arete } où arete vaut 'haut',
    // 'bas', 'gauche' ou 'droite'.
    segmentsBordure: [],
    // Une tache d'usure par tirage (voir genererTachesAsphalte) : { colonne, ligne,
    // xFraction, yFraction, rayonFraction }, les trois derniers dans [0, 1] — une
    // fraction de tailleCase, pas un pixel absolu, pour rester valides quelle que
    // soit la taille du canvas au moment du tracé.
    tachesAsphalte: [],

    // Renvoie les 4 cases orthogonalement adjacentes à (colonne, ligne) — haut, bas,
    // gauche, droite. On ignore volontairement les diagonales : les ennemis se
    // déplaceront uniquement en orthogonal (phase 1B), donc deux cases qui ne se
    // touchent qu'en coin ne créent aucun raccourci réel pour eux.
    voisinesOrthogonales(colonne, ligne) {
        return [
            { colonne, ligne: ligne - 1 },
            { colonne, ligne: ligne + 1 },
            { colonne: colonne - 1, ligne },
            { colonne: colonne + 1, ligne }
        ];
    },

    // Vraie si (colonne, ligne) est à l'intérieur de la grille.
    dansLaGrille(colonne, ligne) {
        return colonne >= 0 && colonne < Config.COLONNES && ligne >= 0 && ligne < Config.LIGNES;
    },

    // Vraie si au moins une des 4 cases orthogonalement voisines appartient à un
    // chemin (phase 7E) : condition de construction propre à la tour Caserne, qui a
    // besoin d'un chemin adjacent où poser son unité — voir
    // Interface.tenterConstruireTour, seul appelant qui applique cette règle
    // uniquement pour ce type de tour.
    estAdjacentAUnChemin(colonne, ligne) {
        for (const voisine of this.voisinesOrthogonales(colonne, ligne)) {
            if (this.dansLaGrille(voisine.colonne, voisine.ligne)
                && this.grille[voisine.ligne][voisine.colonne] === 'CHEMIN') {
                return true;
            }
        }
        return false;
    },

    // Détermine toutes les cases de chemin candidates pour le point de blocage d'une
    // Caserne construite en (colonne, ligne) — ses voisines orthogonales qui
    // appartiennent à un chemin, dans l'ordre fixe déjà renvoyé par
    // voisinesOrthogonales (haut, bas, gauche, droite) — déterministe, pour qu'à
    // graine égale l'ordre des candidates (et donc, dans le cas à une seule
    // candidate, le choix automatique) reste toujours le même d'une partie à
    // l'autre. Si une case appartient à plusieurs chemins à la fois (croisement,
    // phase 6A), retient le premier de Carte.chemins qui la contient — la grille
    // elle-même ne distingue de toute façon pas lequel (voir la note en tête de ce
    // fichier).
    //
    // Renvoie un tableau (potentiellement vide si estAdjacentAUnChemin renverrait
    // faux pour cette case — ne devrait normalement jamais arriver ici, l'appelant
    // étant censé avoir déjà vérifié cette condition avant de construire) d'objets
    // `{ colonne, ligne, cheminIndex, indexPointDePassage }` — `colonne`/`ligne`
    // (contenu additionnel post-lancement, absents avant) identifient la case
    // elle-même, nécessaires pour la mettre en surbrillance et détecter qu'un clic
    // du joueur y tombe bien (voir Interface.caserneEnAttenteChoix) ; les deux
    // autres champs, comme avant cette phase, identifient le point de passage du
    // chemin que l'unité viendra bloquer (Tour.faireApparaitreUnite). Avant cette
    // phase, un unique appelant (le constructeur de Tour) ne retenait que la
    // première candidate trouvée ; il continue de le faire pour le cas à une seule
    // candidate, mais peut désormais aussi recevoir plusieurs candidates à faire
    // choisir au joueur.
    candidatsBlocagePourCaserne(colonne, ligne) {
        const candidats = [];
        for (const voisine of this.voisinesOrthogonales(colonne, ligne)) {
            if (!this.dansLaGrille(voisine.colonne, voisine.ligne)) continue;
            if (this.grille[voisine.ligne][voisine.colonne] !== 'CHEMIN') continue;

            for (let cheminIndex = 0; cheminIndex < this.chemins.length; cheminIndex++) {
                const indexPointDePassage = this.chemins[cheminIndex].chemin.findIndex(
                    c => c.colonne === voisine.colonne && c.ligne === voisine.ligne
                );
                if (indexPointDePassage !== -1) {
                    candidats.push({ colonne: voisine.colonne, ligne: voisine.ligne, cheminIndex, indexPointDePassage });
                    break;
                }
            }
        }
        return candidats;
    },

    // Vraie si la ligne fait partie de la bande autorisée pour un chemin. On exclut
    // la toute première et la toute dernière ligne : un chemin qui longerait un bord
    // ne laisserait poser des tours que d'un seul côté, et la ligne opposée resterait
    // inutilisée faute d'ennemi à portée.
    ligneAutoriseePourChemin(ligne) {
        return ligne >= Config.LIGNE_MIN && ligne <= Config.LIGNE_MAX;
    },

    // Vérifie qu'une case candidate peut être ajoutée au chemin EN COURS de tracé
    // (`cheminEnCours`, uniquement les cases de ce chemin précis — jamais celles d'un
    // chemin déjà généré auparavant, voir la note de phase 6A ci-dessous) :
    // - elle doit être dans la grille, sur une ligne autorisée, et pas déjà utilisée
    //   par ce chemin ;
    // - aucune de ses 4 voisines orthogonales ne doit déjà appartenir à ce même
    //   chemin, à l'exception de la case précédente (celle d'où l'on vient, forcément
    //   orthogonalement adjacente à la nouvelle case). Deux segments du MÊME chemin
    //   qui se longeraient côte à côte restent ainsi interdits, tandis que les tracés
    //   en escalier (droite, haut, droite, haut…) redeviennent possibles.
    //
    // Phase 6A : cette fonction ne reçoit et ne connaît que `cheminEnCours`, jamais
    // les autres chemins déjà générés sur la même carte — c'est précisément ce qui
    // permet à un chemin de croiser librement un chemin précédent tout en s'interdisant
    // de se toucher lui-même. Aucune modification n'a donc été nécessaire ici : la
    // portée voulue existait déjà du simple fait que cette fonction ignore tout état
    // global.
    caseValidePourChemin(candidate, cheminEnCours) {
        if (!this.dansLaGrille(candidate.colonne, candidate.ligne)) return false;
        if (!this.ligneAutoriseePourChemin(candidate.ligne)) return false;

        const dejaDansChemin = cheminEnCours.some(
            c => c.colonne === candidate.colonne && c.ligne === candidate.ligne
        );
        if (dejaDansChemin) return false;

        const casePrecedente = cheminEnCours[cheminEnCours.length - 1];

        for (const voisine of this.voisinesOrthogonales(candidate.colonne, candidate.ligne)) {
            if (voisine.colonne === casePrecedente.colonne && voisine.ligne === casePrecedente.ligne) {
                continue;
            }
            const voisineDansChemin = cheminEnCours.some(
                c => c.colonne === voisine.colonne && c.ligne === voisine.ligne
            );
            if (voisineDansChemin) return false;
        }

        return true;
    },

    // Choisit une direction pondérée parmi celles restées valides. `poidsParDirection`
    // est un objet du type { droite: 0.55, haut: 0.225, bas: 0.225 } ; on ne garde que
    // les clés présentes dans `directionsPossibles`.
    tirerDirectionPonderee(directionsPossibles, poidsParDirection) {
        const total = directionsPossibles.reduce((somme, d) => somme + poidsParDirection[d], 0);
        let tirage = Aleatoire.nombre() * total;
        for (const direction of directionsPossibles) {
            tirage -= poidsParDirection[direction];
            if (tirage <= 0) return direction;
        }
        // Filet de sécurité contre les arrondis flottants : on renvoie la dernière option.
        return directionsPossibles[directionsPossibles.length - 1];
    },

    // Plus petite distance entre `valeur` et chacune des lignes déjà choisies —
    // Infinity si `lignesDejaChoisies` est vide (aucune contrainte, n'importe quelle
    // valeur est alors « infiniment » bien espacée). Factorisée ici, utilisée à la
    // fois par choisirLigneEspacee (entrées) et par la boucle d'espacement des
    // sorties dans generer() ci-dessous (contenu additionnel post-lancement,
    // troisième chemin occasionnel — voir la note sur ces deux appelants pour le
    // contexte).
    distanceMinimaleAuxLignes(valeur, lignesDejaChoisies) {
        if (lignesDejaChoisies.length === 0) return Infinity;
        return Math.min(...lignesDejaChoisies.map(l => Math.abs(l - valeur)));
    },

    // Tire une ligne (entre LIGNE_MIN et LIGNE_MAX) espacée d'au moins
    // Config.ECART_MIN_ENTREES_SORTIES de toutes les lignes déjà choisies (entrées
    // entre elles, ou sorties entre elles — jamais les deux mélangées, voir les deux
    // appels séparés dans generer() ci-dessous). Jusqu'à Config.MAX_ESSAIS_
    // ESPACEMENT_CHEMIN essais ; au-delà, on retient le meilleur candidat rencontré
    // parmi TOUS les essais (celui dont la distance minimale aux lignes déjà
    // choisies est la plus grande — jamais seulement le dernier tiré, voir la note
    // sur ce choix dans config.js) plutôt que de bloquer la génération pour un
    // simple critère esthétique. Un tableau vide (premier chemin) valide toujours
    // le premier tirage, puisque `lignesDejaChoisies.length === 0` renvoie toujours
    // Infinity ci-dessus.
    choisirLigneEspacee(lignesDejaChoisies) {
        let meilleureCandidate = null;
        let meilleureDistance = -1;

        for (let essai = 0; essai < Config.MAX_ESSAIS_ESPACEMENT_CHEMIN; essai++) {
            const candidate = Aleatoire.entier(Config.LIGNE_MIN, Config.LIGNE_MAX);
            const distance = this.distanceMinimaleAuxLignes(candidate, lignesDejaChoisies);

            if (distance >= Config.ECART_MIN_ENTREES_SORTIES) return candidate;

            if (distance > meilleureDistance) {
                meilleureDistance = distance;
                meilleureCandidate = candidate;
            }
        }

        return meilleureCandidate;
    },

    // Tente de tracer un chemin complet en une seule fois, depuis la ligne d'entrée
    // donnée. Renvoie le tableau des cases du chemin en cas de succès, ou null si le
    // tracé s'est bloqué (aucune direction valide) avant d'atteindre le bord droit.
    tenterTracerChemin(ligneEntree) {
        const cheminEnCours = [{ colonne: 0, ligne: ligneEntree }];
        let deplacementsVerticauxConsecutifs = 0;

        const poids = {
            droite: Config.POIDS_DROITE,
            haut: Config.POIDS_HAUT,
            bas: Config.POIDS_BAS
        };

        while (cheminEnCours[cheminEnCours.length - 1].colonne < Config.COLONNES - 1) {
            const caseActuelle = cheminEnCours[cheminEnCours.length - 1];

            // On ne propose « haut » et « bas » que si le quota de déplacements
            // verticaux consécutifs n'est pas déjà atteint : cela force le chemin à
            // reprendre sa progression vers la droite au bout d'un moment.
            let directionsPossibles = ['droite', 'haut', 'bas'];
            if (deplacementsVerticauxConsecutifs >= Config.MAX_DEPLACEMENTS_VERTICAUX) {
                directionsPossibles = ['droite'];
            }

            // On élimine ensuite les directions qui mèneraient à une case invalide,
            // en tirant au sort parmi ce qu'il reste à chaque élimination plutôt que
            // de tester toujours dans le même ordre, pour ne pas biaiser le tracé.
            let directionValide = null;
            let candidateRetenue = null;
            const decalages = { droite: { dc: 1, dl: 0 }, haut: { dc: 0, dl: -1 }, bas: { dc: 0, dl: 1 } };

            while (directionsPossibles.length > 0 && directionValide === null) {
                const direction = this.tirerDirectionPonderee(directionsPossibles, poids);
                const decalage = decalages[direction];
                const candidate = { colonne: caseActuelle.colonne + decalage.dc, ligne: caseActuelle.ligne + decalage.dl };

                if (this.caseValidePourChemin(candidate, cheminEnCours)) {
                    directionValide = direction;
                    candidateRetenue = candidate;
                } else {
                    directionsPossibles = directionsPossibles.filter(d => d !== direction);
                }
            }

            // Plus aucune direction possible depuis cette case : le tracé est dans une
            // impasse, on abandonne cette tentative pour en recommencer une nouvelle.
            if (directionValide === null) return null;

            if (directionValide === 'droite') {
                deplacementsVerticauxConsecutifs = 0;
            } else {
                deplacementsVerticauxConsecutifs++;
            }

            cheminEnCours.push(candidateRetenue);
        }

        return cheminEnCours;
    },

    // Chemin de secours en forme de S, utilisé uniquement si toutes les tentatives de
    // génération d'un chemin ont échoué. Il garantit que le jeu peut toujours démarrer.
    cheminDeSecours() {
        const chemin = [];
        const ligneHaute = 2;
        const ligneBasse = Config.LIGNES - 3;
        const troisième = Math.floor(Config.COLONNES / 3);

        for (let colonne = 0; colonne <= troisième; colonne++) {
            chemin.push({ colonne, ligne: ligneHaute });
        }
        for (let ligne = ligneHaute + 1; ligne <= ligneBasse; ligne++) {
            chemin.push({ colonne: troisième, ligne });
        }
        for (let colonne = troisième + 1; colonne <= troisième * 2; colonne++) {
            chemin.push({ colonne, ligne: ligneBasse });
        }
        for (let ligne = ligneBasse - 1; ligne >= ligneHaute; ligne--) {
            chemin.push({ colonne: troisième * 2, ligne });
        }
        for (let colonne = troisième * 2 + 1; colonne < Config.COLONNES; colonne++) {
            chemin.push({ colonne, ligne: ligneHaute });
        }
        return chemin;
    },

    // Trace un chemin complet depuis `ligneEntree` : jusqu'à Config.MAX_TENTATIVES_
    // GENERATION tirages aléatoires (tenterTracerChemin), le premier assez long
    // (Config.LONGUEUR_CHEMIN_MIN) étant retenu ; à défaut, le chemin de secours.
    genererUnChemin(ligneEntree) {
        for (let tentative = 0; tentative < Config.MAX_TENTATIVES_GENERATION; tentative++) {
            const resultat = this.tenterTracerChemin(ligneEntree);
            if (resultat !== null && resultat.length >= Config.LONGUEUR_CHEMIN_MIN) {
                return resultat;
            }
        }
        console.warn('Défense Néon : aucune tentative de génération de chemin n\'a abouti, utilisation du chemin de secours.');
        return this.cheminDeSecours();
    },

    // Trottoirs façon route (phase 7B). Ne calcule aucun contour géométrique lissé le
    // long de la courbe du chemin — avec des virages et des croisements (phase 6A),
    // gérer proprement les jointures serait bien plus complexe que nécessaire pour un
    // effet purement décoratif. Exploite à la place le fait que le plateau est déjà
    // une grille : pour chaque case de chemin, chacune de ses 4 arêtes devient un
    // trottoir si et seulement si la case voisine de ce côté n'appartient à aucun
    // chemin (ou est hors grille). Ce principe simple gère tout sans cas particulier :
    // une ligne droite ne produit des trottoirs que sur ses deux côtés longs, un
    // virage en produit un en L (les deux arêtes extérieures du virage n'ont, chacune,
    // pas de voisine-chemin de leur côté), et un croisement entre deux chemins n'en
    // produit aucun à l'endroit où ils se rejoignent (la case voisine y appartient
    // bien à un chemin, peu importe lequel — la grille ne distingue pas lequel, voir
    // la note en tête de ce fichier, et ça n'a pas besoin de le faire ici non plus).
    calculerSegmentsBordure() {
        this.segmentsBordure = [];

        const aretesParDirection = [
            { dc: 0, dl: -1, arete: 'haut' },
            { dc: 0, dl: 1, arete: 'bas' },
            { dc: -1, dl: 0, arete: 'gauche' },
            { dc: 1, dl: 0, arete: 'droite' }
        ];

        for (let ligne = 0; ligne < Config.LIGNES; ligne++) {
            for (let colonne = 0; colonne < Config.COLONNES; colonne++) {
                if (this.grille[ligne][colonne] !== 'CHEMIN') continue;

                for (const { dc, dl, arete } of aretesParDirection) {
                    const voisineColonne = colonne + dc;
                    const voisineLigne = ligne + dl;
                    const voisineEstChemin = this.dansLaGrille(voisineColonne, voisineLigne)
                        && this.grille[voisineLigne][voisineColonne] === 'CHEMIN';

                    if (!voisineEstChemin) {
                        this.segmentsBordure.push({ colonne, ligne, arete });
                    }
                }
            }
        }
    },

    // Texture d'asphalte (phase 7B) : quelques petites taches d'usure par case de
    // chemin, position et rayon tirés via Aleatoire — pas Math.random() : contrairement
    // au décor de la phase 7C (purement scénographique, jamais lu par le reste du
    // jeu), cette texture fait partie du rendu de la carte elle-même et doit rester
    // reproductible à graine égale, comme le tracé du chemin lui-même. Appelée après
    // que tenterTracerChemin/genererUnChemin aient fini de consommer leurs propres
    // tirages pour cette carte : peu importe combien ils en ont consommé (variable
    // d'une tentative à l'autre), cette fonction reprend la même suite là où elle en
    // était, donc à un point déterministe pour une graine donnée.
    genererTachesAsphalte() {
        this.tachesAsphalte = [];

        for (let ligne = 0; ligne < Config.LIGNES; ligne++) {
            for (let colonne = 0; colonne < Config.COLONNES; colonne++) {
                if (this.grille[ligne][colonne] !== 'CHEMIN') continue;

                for (let i = 0; i < Config.NOMBRE_TACHES_PAR_CASE_CHEMIN; i++) {
                    this.tachesAsphalte.push({
                        colonne,
                        ligne,
                        xFraction: Aleatoire.nombre(),
                        yFraction: Aleatoire.nombre(),
                        rayonFraction: 0.03 + Aleatoire.nombre() * 0.05
                    });
                }
            }
        }
    },

    // Cases inconstructibles près des chemins (contenu additionnel post-lancement) :
    // pour chaque case 'LIBRE' orthogonalement adjacente à au moins une case de
    // chemin (réutilise estAdjacentAUnChemin, déjà écrite pour la Caserne en phase
    // 7E — la condition est exactement la même), tire via Aleatoire si elle devient
    // 'BLOQUEE', avec une probabilité de Config.PROPORTION_CASES_BLOQUEES_PRES_CHEMIN.
    // Appelée par generer() juste après avoir marqué les cases 'CHEMIN' dans la
    // grille (dont dépend estAdjacentAUnChemin) et AVANT tout calcul dépendant du
    // nombre de cases 'LIBRE' restantes — en particulier la limite de tours (phase
    // 6B, Jeu.reinitialiser), qui compte les cases 'LIBRE' juste après l'appel à
    // Carte.generer() : comme cette méthode s'exécute entièrement à l'intérieur de
    // generer(), avant qu'il ne rende la main, ce comptage se fait déjà sur la grille
    // définitive, cases bloquées comprises, sans aucune modification nécessaire côté
    // jeu.js (vérifié plutôt que supposé, voir ARCHITECTURE.md).
    //
    // Une case bloquée le reste pour toute la partie : ni cette méthode ni aucune
    // autre n'est rappelée en cours de partie, exactement comme le tracé des chemins
    // lui-même.
    genererCasesBloquees() {
        this.gravats = [];
        for (let ligne = 0; ligne < Config.LIGNES; ligne++) {
            const rangeeGravats = [];
            for (let colonne = 0; colonne < Config.COLONNES; colonne++) {
                rangeeGravats.push(null);
            }
            this.gravats.push(rangeeGravats);
        }

        for (let ligne = 0; ligne < Config.LIGNES; ligne++) {
            for (let colonne = 0; colonne < Config.COLONNES; colonne++) {
                if (this.grille[ligne][colonne] !== 'LIBRE') continue;
                if (!this.estAdjacentAUnChemin(colonne, ligne)) continue;
                if (Aleatoire.nombre() >= Config.PROPORTION_CASES_BLOQUEES_PRES_CHEMIN) continue;

                this.grille[ligne][colonne] = 'BLOQUEE';

                // Trois morceaux de débris par case bloquée, tirés via Aleatoire pour
                // rester reproductibles à graine égale (même principe que
                // genererTachesAsphalte ci-dessus) — un rendu simple (rectangles
                // légèrement pivotés) suffit, l'important étant que la case se
                // distingue clairement d'une case libre, pas un décor élaboré.
                const morceaux = [];
                for (let i = 0; i < 3; i++) {
                    morceaux.push({
                        xFraction: 0.2 + Aleatoire.nombre() * 0.6,
                        yFraction: 0.2 + Aleatoire.nombre() * 0.6,
                        largeurFraction: 0.18 + Aleatoire.nombre() * 0.22,
                        hauteurFraction: 0.14 + Aleatoire.nombre() * 0.18,
                        angle: Aleatoire.nombre() * Math.PI
                    });
                }
                this.gravats[ligne][colonne] = morceaux;
            }
        }
    },

    // Point d'entrée de la génération : initialise l'aléatoire avec la graine donnée,
    // détermine le nombre de chemins de cette carte précise (voir this.nombreChemins
    // ci-dessus), puis génère ce nombre de chemins l'un après l'autre (chemin 0, puis
    // chemin 1, etc.), chacun avec sa propre entrée et sortie espacées des entrées et
    // sorties déjà choisies (Config.ECART_MIN_ENTREES_SORTIES), avant de reconstruire
    // la grille.
    generer(graine) {
        Aleatoire.initialiser(graine);

        // Troisième chemin occasionnel (contenu additionnel post-lancement) : tiré
        // ici, tout au premier tirage de cette génération (avant le moindre tracé de
        // chemin ou choix de ligne d'entrée/sortie), via Aleatoire — donc
        // reproductible à graine égale, comme le reste de la génération. La plupart
        // des cartes gardent NOMBRE_CHEMINS_PAR_DEFAUT (2) chemins ; une carte sur
        // quatre (PROBABILITE_TROISIEME_CHEMIN) en gagne un troisième.
        this.nombreChemins = Config.NOMBRE_CHEMINS_PAR_DEFAUT
            + (Aleatoire.nombre() < Config.PROBABILITE_TROISIEME_CHEMIN ? 1 : 0);

        const lignesEntreesChoisies = [];
        const lignesSortiesChoisies = [];
        this.chemins = [];

        for (let index = 0; index < this.nombreChemins; index++) {
            const ligneEntree = this.choisirLigneEspacee(lignesEntreesChoisies);

            // La ligne de sortie n'est pas tirée indépendamment comme celle d'entrée :
            // elle émerge de la marche aléatoire (tenterTracerChemin), qui n'a aucune
            // notion de « ligne visée ». Pour lui appliquer la même règle d'espacement
            // sans changer l'algorithme de tracé lui-même (voir la note de phase 6A du
            // prompt), on retrace jusqu'à Config.MAX_ESSAIS_ESPACEMENT_CHEMIN chemins
            // complets depuis la même ligneEntree et on retient le premier dont la
            // sortie respecte l'espacement — ou, faute de mieux, le meilleur tracé
            // rencontré parmi TOUS les essais (celui dont la sortie a la plus grande
            // distance minimale aux sorties déjà choisies), plutôt que seulement le
            // dernier tracé au hasard : ce dernier point s'est révélé nécessaire en
            // testant le troisième chemin occasionnel (contenu additionnel
            // post-lancement) — avec deux sorties déjà choisies à espacer plutôt
            // qu'une seule, ne retenir que le dernier essai laissait passer des
            // cartes à 3 chemins avec deux sorties sur la même ligne, même en
            // augmentant fortement le nombre d'essais (voir la note sur
            // MAX_ESSAIS_ESPACEMENT_CHEMIN dans config.js) — le problème n'était pas
            // un manque d'essais mais le fait de jeter l'information des tentatives
            // précédentes à chaque nouvel essai infructueux.
            let cheminRetenu = null;
            let meilleureDistanceSortie = -1;
            for (let essaiSortie = 0; essaiSortie < Config.MAX_ESSAIS_ESPACEMENT_CHEMIN; essaiSortie++) {
                const candidat = this.genererUnChemin(ligneEntree);
                const ligneSortie = candidat[candidat.length - 1].ligne;
                const distance = this.distanceMinimaleAuxLignes(ligneSortie, lignesSortiesChoisies);

                if (distance >= Config.ECART_MIN_ENTREES_SORTIES) {
                    cheminRetenu = candidat;
                    break;
                }

                if (distance > meilleureDistanceSortie) {
                    meilleureDistanceSortie = distance;
                    cheminRetenu = candidat;
                }
            }

            lignesEntreesChoisies.push(ligneEntree);
            lignesSortiesChoisies.push(cheminRetenu[cheminRetenu.length - 1].ligne);

            this.chemins.push({
                chemin: cheminRetenu,
                // Les positions en pixels dépendent de la taille du canvas : elles
                // seront calculées par recalculerPixels(), appelée par jeu.js une fois
                // la taille de case connue.
                pointsDePassage: [],
                caseDepart: cheminRetenu[0],
                caseArrivee: cheminRetenu[cheminRetenu.length - 1]
            });
        }

        this.grille = [];
        for (let ligne = 0; ligne < Config.LIGNES; ligne++) {
            const rangee = [];
            for (let colonne = 0; colonne < Config.COLONNES; colonne++) {
                rangee.push('LIBRE');
            }
            this.grille.push(rangee);
        }
        // Un croisement écrit 'CHEMIN' sur la même case plusieurs fois : sans effet,
        // la grille ne distingue de toute façon pas quel chemin traverse quelle case.
        for (const infoChemin of this.chemins) {
            for (const c of infoChemin.chemin) {
                this.grille[c.ligne][c.colonne] = 'CHEMIN';
            }
        }

        // Cases inconstructibles près des chemins (contenu additionnel
        // post-lancement) : juste après le tracé des chemins (dont dépend
        // estAdjacentAUnChemin, utilisée ci-dessous) et avant tout calcul dépendant
        // du nombre de cases 'LIBRE' restantes — voir la note de genererCasesBloquees
        // ci-dessus pour le détail sur la limite de tours (phase 6B).
        this.genererCasesBloquees();

        // Chemins façon route (phase 7B) : les deux dépendent de la grille
        // définitive ci-dessus (trottoirs : quelles arêtes sont extérieures ; taches :
        // quelles cases sont des cases de chemin), donc calculés seulement maintenant,
        // une seule fois par carte générée — jamais recalculés en boucle par
        // Carte.dessiner().
        this.calculerSegmentsBordure();
        this.genererTachesAsphalte();
    },

    // Vraie si la case existe et peut recevoir une construction. Une case 'BLOQUEE'
    // (contenu additionnel post-lancement) y est déjà refusée sans aucune
    // modification de cette fonction : elle ne renvoie vrai que pour une égalité
    // stricte avec 'LIBRE', jamais par élimination des seuls états 'CHEMIN'/'OCCUPEE'
    // — vérifié plutôt que supposé, comme le reste des vérifications listées dans le
    // prompt de cette phase (voir ARCHITECTURE.md).
    estConstructible(colonne, ligne) {
        return this.dansLaGrille(colonne, ligne) && this.grille[ligne][colonne] === 'LIBRE';
    },

    // Convertit une position en pixels vers des indices de case.
    pixelsVersCase(x, y) {
        return {
            colonne: Math.floor(x / this.tailleCase),
            ligne: Math.floor(y / this.tailleCase)
        };
    },

    // Renvoie le centre d'une case donnée, en pixels.
    caseVersPixels(colonne, ligne) {
        return {
            x: colonne * this.tailleCase + this.tailleCase / 2,
            y: ligne * this.tailleCase + this.tailleCase / 2
        };
    },

    // Recalcule `pointsDePassage` de chaque chemin à partir de son `chemin` et de la
    // taille de case courante. À appeler chaque fois que le canvas est redimensionné
    // (Jeu.redimensionner, un seul appel à cette fonction qui boucle elle-même sur
    // Carte.chemins — voir ARCHITECTURE.md pour ce choix d'encapsulation).
    recalculerPixels() {
        for (const infoChemin of this.chemins) {
            infoChemin.pointsDePassage = infoChemin.chemin.map(c => this.caseVersPixels(c.colonne, c.ligne));
        }
    },

    // Dessine l'intégralité de la carte dans le contexte 2D fourni.
    dessiner(ctx) {
        const taille = this.tailleCase;

        // Fond translucide (phase 7C, correctif transparence) plutôt qu'opaque : laisse
        // transparaître le décor d'arrière-plan (Decor, sur son propre canvas fixé
        // derrière celui-ci, voir style.css) à travers tout le canvas de jeu — y
        // compris les marges hors grille éventuelles, sans conséquence puisque la
        // grille elle-même recouvre déjà tout l'espace utile dessiné ci-dessous.
        ctx.fillStyle = Config.COULEURS.fondTranslucide;
        ctx.fillRect(0, 0, Config.COLONNES * taille, Config.LIGNES * taille);

        for (let ligne = 0; ligne < Config.LIGNES; ligne++) {
            for (let colonne = 0; colonne < Config.COLONNES; colonne++) {
                const etat = this.grille[ligne][colonne];
                const x = colonne * taille;
                const y = ligne * taille;

                // Toutes les cases 'CHEMIN' partagent le même aplat d'asphalte, qu'il
                // s'agisse d'un croisement entre deux chemins ou non (phase 6A) : la
                // distinction entre chemins se fait uniquement via le flux animé et
                // les marqueurs départ/arrivée dessinés par-dessus, plus bas. Cette
                // case reste pleinement opaque (phase 7C, correctif transparence) —
                // c'est ce qui garantit que le décor d'arrière-plan ne transparaît
                // jamais à travers le tracé du chemin, contrairement aux cases
                // 'LIBRE'/'OCCUPEE' juste en dessous, rendues translucides.
                if (etat === 'CHEMIN') {
                    ctx.fillStyle = Config.COULEURS.asphalte;
                    ctx.fillRect(x, y, taille, taille);
                    // Pas de liseré générique ici (voir juste en dessous, hors chemin)
                    // : il dessinerait un fin contour sur les QUATRE arêtes de chaque
                    // case de chemin, y compris celles partagées avec une case de
                    // chemin voisine — exactement les coutures que
                    // calculerSegmentsBordure() s'attache à ne PAS tracer à
                    // l'intérieur d'une route continue (ligne droite, virage,
                    // croisement). Les trottoirs, dessinés plus bas une fois toutes
                    // les cases remplies, en tiennent lieu pour les cases de chemin.
                    continue;
                }

                ctx.fillStyle = Config.COULEURS.caseLibreTranslucide;
                ctx.fillRect(x, y, taille, taille);

                // Un liseré plus clair garde la grille visible : sans lui, les cases
                // libres formeraient un bloc uniforme sans repère pour poser des tours.
                ctx.strokeStyle = Config.COULEURS.lisere;
                ctx.lineWidth = 1;
                ctx.strokeRect(x + 0.5, y + 0.5, taille - 1, taille - 1);

                // Gravats (contenu additionnel post-lancement) : dessinés ici, dans la
                // même passe que le fond/liseré de leur propre case, jamais dans une
                // passe séparée comme les taches d'asphalte ou les trottoirs plus bas
                // — contrairement à ceux-ci, un morceau de débris reste toujours
                // contenu à l'intérieur des 20 %-80 % de sa case (xFraction/
                // yFraction ci-dessus), jamais à cheval sur une case voisine, donc
                // aucun risque qu'une case dessinée juste après dans cette même
                // boucle ne le recouvre partiellement.
                if (etat === 'BLOQUEE') {
                    ctx.fillStyle = Config.COULEURS.gravats;
                    for (const morceau of this.gravats[ligne][colonne]) {
                        ctx.save();
                        ctx.translate(x + morceau.xFraction * taille, y + morceau.yFraction * taille);
                        ctx.rotate(morceau.angle);
                        const largeur = morceau.largeurFraction * taille;
                        const hauteur = morceau.hauteurFraction * taille;
                        ctx.fillRect(-largeur / 2, -hauteur / 2, largeur, hauteur);
                        ctx.restore();
                    }
                }
            }
        }

        // Chemins façon route (phase 7B) : taches d'usure d'abord, trottoirs ensuite
        // — tous deux dans une passe séparée, une fois que la boucle ci-dessus a fini
        // de remplir TOUTES les cases (chemin comme libres). Une tache ou un trottoir
        // dessiné pendant la boucle ci-dessus, sur la case qui le porte, risquerait
        // d'être partiellement recouvert par l'aplat opaque d'une case voisine
        // dessinée juste après lui dans cette même boucle (ordre de balayage
        // ligne par ligne) — en particulier au bord partagé entre deux cases de
        // chemin adjacentes, exactement là où les trottoirs ne doivent PAS apparaître.
        ctx.fillStyle = Config.COULEURS.tacheAsphalte;
        for (const tache of this.tachesAsphalte) {
            const cx = tache.colonne * taille + tache.xFraction * taille;
            const cy = tache.ligne * taille + tache.yFraction * taille;
            const rayon = tache.rayonFraction * taille;
            ctx.beginPath();
            ctx.arc(cx, cy, rayon, 0, Math.PI * 2);
            ctx.fill();
        }

        // Un seul beginPath()/stroke() pour tous les segments plutôt qu'un par
        // segment : même résultat visuel, un seul appel de dessin au lieu de
        // potentiellement plusieurs centaines sur une grande carte à deux chemins.
        ctx.strokeStyle = Config.COULEURS.bordureRoute;
        ctx.lineWidth = Config.LARGEUR_BORDURE_ROUTE * Jeu.facteurEchelle;
        ctx.beginPath();
        for (const segment of this.segmentsBordure) {
            const x = segment.colonne * taille;
            const y = segment.ligne * taille;
            switch (segment.arete) {
                case 'haut':
                    ctx.moveTo(x, y);
                    ctx.lineTo(x + taille, y);
                    break;
                case 'bas':
                    ctx.moveTo(x, y + taille);
                    ctx.lineTo(x + taille, y + taille);
                    break;
                case 'gauche':
                    ctx.moveTo(x, y);
                    ctx.lineTo(x, y + taille);
                    break;
                case 'droite':
                    ctx.moveTo(x + taille, y);
                    ctx.lineTo(x + taille, y + taille);
                    break;
            }
        }
        ctx.stroke();

        // Chemins multiples (phase 6A) : chaque chemin est retracé par-dessus la
        // grille sous forme de ligne pointillée animée (lineDashOffset, fonction du
        // temps écoulé) dans sa propre teinte néon (Config.COULEURS.cheminsNeon,
        // indexée par cheminIndex), et ses marqueurs de départ/arrivée reprennent
        // cette même teinte plutôt que le vert/rose fixe d'avant phase 6A — c'est ce
        // qui rend un croisement lisible à l'œil : deux chemins qui se touchent
        // restent chacun reconnaissables à leur couleur, et l'on voit immédiatement
        // quelle entrée correspond à quelle sortie. Depuis la phase 7B, ce tracé fait
        // aussi office de ligne centrale de la route posée dessous (asphalte +
        // trottoirs) : logique d'animation et couleur par chemin inchangées, seule
        // l'épaisseur a été réduite (voir plus bas) pour se lire comme un marquage au
        // sol plutôt que comme le large faisceau qu'elle formait seule sur un simple
        // aplat de couleur.
        const maintenant = performance.now();
        for (let index = 0; index < this.chemins.length; index++) {
            const infoChemin = this.chemins[index];
            const teinte = Config.COULEURS.cheminsNeon[index % Config.COULEURS.cheminsNeon.length];

            // Masqué une fois une vague lancée (Vagues.enCours), à la demande de
            // l'utilisateur : le flux animé, pensé pour repérer un tracé au calme
            // (accueil, entre deux vagues), devient un signal superflu — voire
            // distrayant — une fois que de vrais ennemis avancent sur la route.
            // Réapparaît de lui-même dès la vague terminée (enCours repasse à false),
            // sans état à gérer ici : cette condition est relue à chaque frame,
            // comme le reste de dessiner(). N'affecte que ce tracé animé — asphalte,
            // trottoirs, taches et marqueurs de départ/arrivée restent dessinés
            // normalement, vague en cours ou non.
            if (infoChemin.pointsDePassage.length > 1 && !Vagues.enCours) {
                const motif = Math.max(4, taille * 0.3);

                ctx.beginPath();
                infoChemin.pointsDePassage.forEach((point, i) => {
                    if (i === 0) ctx.moveTo(point.x, point.y);
                    else ctx.lineTo(point.x, point.y);
                });
                ctx.strokeStyle = teinte;
                // Réduite de moitié depuis la phase 7B (0,1 → 0,05 * taille) : à
                // l'ancienne épaisseur, la ligne occupait une bonne partie de la
                // largeur de la route et se lisait comme un large faisceau plutôt
                // qu'un marquage au sol. Plancher à 2px conservé pour rester visible
                // sur les plus petites tailles de case.
                ctx.lineWidth = Math.max(2, taille * 0.05);
                ctx.setLineDash([motif, motif * 0.7]);
                // Défile dans le temps pour suggérer un flux ; la période (motif *
                // 1.7, la longueur totale d'un motif plein+vide) n'a besoin d'aucune
                // synchronisation avec quoi que ce soit d'autre dans le jeu.
                ctx.lineDashOffset = -(maintenant / 25) % (motif * 1.7);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            ctx.shadowColor = teinte;
            ctx.shadowBlur = Config.HALO_FLOU_POINT_CHEMIN;
            ctx.fillStyle = teinte;
            ctx.fillRect(infoChemin.caseDepart.colonne * taille, infoChemin.caseDepart.ligne * taille, taille, taille);
            ctx.fillRect(infoChemin.caseArrivee.colonne * taille, infoChemin.caseArrivee.ligne * taille, taille, taille);
            ctx.shadowBlur = 0;
        }
    }
};
