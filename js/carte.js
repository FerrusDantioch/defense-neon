// carte.js — Génère Config.NOMBRE_CHEMINS chemins aléatoires valides du bord gauche
// au bord droit de la grille (phase 6A ; un seul chemin avant), stocke l'état de
// chaque case et sait dessiner le résultat sur le canvas (palette cyberpunk et halos
// néon depuis la phase 4A, une teinte distincte par chemin depuis la phase 6A).

const Carte = {
    // Grille d'état : grille[ligne][colonne] vaut 'LIBRE', 'CHEMIN' ou 'OCCUPEE'
    // (une tour posée sur la case, voir Jeu.tenterConstruireTour dans jeu.js). Une
    // case 'CHEMIN' peut appartenir à plusieurs chemins à la fois (un croisement) :
    // la grille ne distingue pas lequel, seul Carte.chemins le sait.
    grille: [],

    // Un élément par chemin (Config.NOMBRE_CHEMINS au total), chacun avec :
    // - chemin : suite ordonnée des cases du chemin, du départ à l'arrivée,
    //   [{colonne, ligne}, ...] ;
    // - pointsDePassage : même information convertie en centres de pixels, recalculée
    //   à chaque redimensionnement (voir recalculerPixels ci-dessous) — c'est ce que
    //   suit un ennemi assigné à ce chemin (Ennemi.deplacer, via son cheminIndex) ;
    // - caseDepart / caseArrivee : première et dernière case du chemin.
    // Remplace, depuis la phase 6A, les anciennes propriétés `chemin`/`pointsDePassage`
    // /`caseDepart`/`caseArrivee` au niveau de Carte elle-même (un seul chemin).
    chemins: [],

    // Taille d'une case en pixels, fixée par jeu.js selon la taille du canvas. Toutes
    // les conversions pixels <-> case en dépendent.
    tailleCase: 0,

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

    // Tire une ligne (entre LIGNE_MIN et LIGNE_MAX) espacée d'au moins
    // Config.ECART_MIN_ENTREES_SORTIES de toutes les lignes déjà choisies (entrées
    // entre elles, ou sorties entre elles — jamais les deux mélangées, voir les deux
    // appels séparés dans generer() ci-dessous). Jusqu'à dix essais ; au-delà, on
    // accepte la dernière ligne tirée telle quelle plutôt que de bloquer la
    // génération pour un simple critère esthétique. Un tableau vide (premier chemin)
    // valide toujours le premier tirage, puisque `every` sur un tableau vide vaut
    // `true`.
    choisirLigneEspacee(lignesDejaChoisies) {
        let candidate;
        for (let essai = 0; essai < 10; essai++) {
            candidate = Aleatoire.entier(Config.LIGNE_MIN, Config.LIGNE_MAX);
            const espacementRespecte = lignesDejaChoisies.every(
                l => Math.abs(l - candidate) >= Config.ECART_MIN_ENTREES_SORTIES
            );
            if (espacementRespecte) return candidate;
        }
        return candidate;
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

    // Point d'entrée de la génération : initialise l'aléatoire avec la graine donnée,
    // puis génère Config.NOMBRE_CHEMINS chemins l'un après l'autre (chemin 0, puis
    // chemin 1, etc.), chacun avec sa propre entrée et sortie espacées des entrées et
    // sorties déjà choisies (Config.ECART_MIN_ENTREES_SORTIES), avant de reconstruire
    // la grille.
    generer(graine) {
        Aleatoire.initialiser(graine);

        const lignesEntreesChoisies = [];
        const lignesSortiesChoisies = [];
        this.chemins = [];

        for (let index = 0; index < Config.NOMBRE_CHEMINS; index++) {
            const ligneEntree = this.choisirLigneEspacee(lignesEntreesChoisies);

            // La ligne de sortie n'est pas tirée indépendamment comme celle d'entrée :
            // elle émerge de la marche aléatoire (tenterTracerChemin), qui n'a aucune
            // notion de « ligne visée ». Pour lui appliquer la même règle d'espacement
            // sans changer l'algorithme de tracé lui-même (voir la note de phase 6A du
            // prompt), on retrace jusqu'à dix chemins complets depuis la même
            // ligneEntree et on retient le premier dont la sortie respecte
            // l'espacement — ou, faute de mieux au bout de dix essais, le dernier
            // tracé plutôt que de bloquer la génération.
            let cheminRetenu = null;
            for (let essaiSortie = 0; essaiSortie < 10; essaiSortie++) {
                const candidat = this.genererUnChemin(ligneEntree);
                const ligneSortie = candidat[candidat.length - 1].ligne;
                const espacementRespecte = lignesSortiesChoisies.every(
                    l => Math.abs(l - ligneSortie) >= Config.ECART_MIN_ENTREES_SORTIES
                );
                if (espacementRespecte || essaiSortie === 9) {
                    cheminRetenu = candidat;
                    break;
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
    },

    // Vraie si la case existe et peut recevoir une construction.
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

        ctx.fillStyle = Config.COULEURS.fond;
        ctx.fillRect(0, 0, Config.COLONNES * taille, Config.LIGNES * taille);

        for (let ligne = 0; ligne < Config.LIGNES; ligne++) {
            for (let colonne = 0; colonne < Config.COLONNES; colonne++) {
                const etat = this.grille[ligne][colonne];
                const x = colonne * taille;
                const y = ligne * taille;

                // Toutes les cases 'CHEMIN' partagent la même teinte de base, qu'il
                // s'agisse d'un croisement entre deux chemins ou non (phase 6A) : la
                // distinction entre chemins se fait uniquement via le flux animé et
                // les marqueurs départ/arrivée dessinés par-dessus, plus bas.
                if (etat === 'CHEMIN') {
                    ctx.fillStyle = Config.COULEURS.caseChemin;
                } else {
                    ctx.fillStyle = Config.COULEURS.caseLibre;
                }
                ctx.fillRect(x, y, taille, taille);

                // Un liseré plus clair garde la grille visible : sans lui, les cases
                // libres formeraient un bloc uniforme sans repère pour poser des tours.
                ctx.strokeStyle = Config.COULEURS.lisere;
                ctx.lineWidth = 1;
                ctx.strokeRect(x + 0.5, y + 0.5, taille - 1, taille - 1);
            }
        }

        // Chemins multiples (phase 6A) : chaque chemin est retracé par-dessus la
        // grille sous forme de ligne pointillée animée (lineDashOffset, fonction du
        // temps écoulé) dans sa propre teinte néon (Config.COULEURS.cheminsNeon,
        // indexée par cheminIndex), et ses marqueurs de départ/arrivée reprennent
        // cette même teinte plutôt que le vert/rose fixe d'avant phase 6A — c'est ce
        // qui rend un croisement lisible à l'œil : deux chemins qui se touchent
        // restent chacun reconnaissables à leur couleur, et l'on voit immédiatement
        // quelle entrée correspond à quelle sortie.
        const maintenant = performance.now();
        for (let index = 0; index < this.chemins.length; index++) {
            const infoChemin = this.chemins[index];
            const teinte = Config.COULEURS.cheminsNeon[index % Config.COULEURS.cheminsNeon.length];

            if (infoChemin.pointsDePassage.length > 1) {
                const motif = Math.max(4, taille * 0.3);

                ctx.beginPath();
                infoChemin.pointsDePassage.forEach((point, i) => {
                    if (i === 0) ctx.moveTo(point.x, point.y);
                    else ctx.lineTo(point.x, point.y);
                });
                ctx.strokeStyle = teinte;
                ctx.lineWidth = Math.max(2, taille * 0.1);
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
