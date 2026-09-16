// tour.js — Classes Tour et Projectile.
//
// Tour : pose fixe sur une case. Quatre des cinq types (Mitrailleuse, Canon, Sniper,
// Flak depuis la phase 7D — voir Config.TYPES_TOURS) cherchent une cible parmi les
// ennemis à portée et tirent à cadence régulière, et ne diffèrent que par les valeurs
// lues dans le constructeur, par leur apparence, et depuis la phase 7D par la façon
// dont leurs dégâts se répartissent à l'impact (`typeDegats`, voir
// Projectile.mettreAJour). Le cinquième, la Caserne (phase 7E, `typeDegats ===
// 'caserne'`), ne tire jamais : elle fait apparaître une unité statique de blocage
// (UniteCaserne, voir unite.js) qui combat à sa place — voir mettreAJourCaserne,
// faireApparaitreUnite et statsUniteAuNiveauActuel ci-dessous, et
// Jeu.resoudreCombatsCasernes (jeu.js) pour le combat lui-même. Une tour peut aussi
// être améliorée (jusqu'à Config.NIVEAU_MAX_TOUR) ou vendue (phase 2B) : voir
// recalculerStats, coutAmelioration, ameliorer et montantVente ci-dessous — génériques,
// aucune de ces méthodes ne fait référence à un type précis, donc valables pour le
// Flak comme pour la Caserne sans modification (ameliorer() rafraîchit en plus les
// stats de l'unité d'une Caserne déjà vivante, seul ajout spécifique nécessaire).
//
// Projectile : tiré par une tour, suit sa cible jusqu'à l'impact ou jusqu'à ce que la
// cible meure avant lui. Recyclé via un pool plutôt que créé/détruit à la volée (voir
// Jeu.initialiserPoolProjectiles) pour éviter de solliciter le ramasse-miettes en
// pleine partie. Jamais utilisé par une Caserne, qui ne tire aucun projectile.

class Tour {
    // `type` est une clé de Config.TYPES_TOURS ('mitrailleuse', 'canon', 'sniper',
    // 'flak' ou 'caserne'). Conservée sur l'instance (this.type) pour retrouver le
    // coût d'achat de base au calcul du coût d'une amélioration (voir coutAmelioration).
    constructor(colonne, ligne, type) {
        this.colonne = colonne;
        this.ligne = ligne;
        this.type = type;

        const centre = Carte.caseVersPixels(colonne, ligne);
        this.x = centre.x;
        this.y = centre.y;

        const caracteristiques = Config.TYPES_TOURS[type];
        this.couleur = caracteristiques.couleur;

        // Valeurs de base (niveau 1), conservées à part de portee/degats/cadence :
        // recalculerStats() part toujours de ces valeurs fixes plutôt que de
        // multiplier la valeur courante à chaque amélioration, pour ne jamais
        // accumuler d'erreur d'arrondi si on ajoute un jour davantage de niveaux.
        this.degatsBase = caracteristiques.degats;
        this.cadenceBase = caracteristiques.cadence;
        this.porteeBase = caracteristiques.portee;
        // 'unique' (dégâts à la seule cible verrouillée) ou 'zone' (explosion à
        // l'impact, phase 7D) — jamais recalculée après coup comme degats/cadence/
        // portee, le type de dégâts d'une tour ne change jamais avec son niveau.
        // Lue par Projectile.mettreAJour (via activer() ci-dessous) pour bifurquer
        // entre les deux comportements à l'impact.
        this.typeDegats = caracteristiques.typeDegats;

        this.niveau = 1;
        // Somme du coût d'achat initial et de toutes les améliorations payées
        // jusqu'ici : sert de base au calcul du remboursement à la vente (voir
        // montantVente).
        this.investissementTotal = caracteristiques.cout;

        this.portee = 0;
        this.degats = 0;
        this.cadence = 0;
        this.recalculerStats();

        this.tempsDepuisDernierTir = 0;
        this.cible = null;

        // Caserne (phase 7E) : ne cherche jamais de cible ni ne tire (voir
        // mettreAJour ci-dessous, qui bifurque entièrement avant de lire tempsDepuisDernierTir/cible
        // ci-dessus pour ce type) ; fait apparaître son unité de blocage à la place,
        // sur une case de chemin adjacente déterminée une fois pour toutes ici (voir
        // Carte.candidatsBlocagePourCaserne) — jamais recalculée ensuite, la tour
        // reste associée au même point de blocage pour toute sa durée de vie.
        //
        // Choix du point de blocage (contenu additionnel post-lancement) : quand
        // plusieurs cases de chemin sont adjacentes (typiquement près d'un
        // croisement), le cas à une seule candidate ci-dessous ne s'applique pas —
        // aucun point de blocage n'est retenu ici, l'unité n'apparaît pas encore, et
        // `candidatsBlocageEnAttente` reste sur l'instance le temps qu'Interface
        // détecte cette attente (voir Interface.tenterConstruireTour) et résolve le
        // choix du joueur via resoudreChoixBlocage() ci-dessous.
        if (this.typeDegats === 'caserne') {
            const candidats = Carte.candidatsBlocagePourCaserne(colonne, ligne);
            this.unite = null;
            this.tempsDepuisDestruction = 0;

            if (candidats.length <= 1) {
                // Cas simple (le plus fréquent, et le seul qui existait avant cette
                // phase) : au plus une candidate, retenue automatiquement, exactement
                // comme le faisait l'ancienne trouverPointBlocagePourCaserne.
                // candidats[0] est `undefined` (pas `null`) si le tableau est vide —
                // normalisé ci-dessous, jamais lu directement.
                const pointBlocage = candidats[0] || null;
                // pointBlocage ne devrait jamais être null ici : Interface.tenterConstruireTour
                // vérifie déjà Carte.estAdjacentAUnChemin avant de construire une Caserne.
                // Gardé par robustesse pour un appel direct qui sauterait cette
                // vérification (ex. un outil de test) — la tour existe alors sans jamais
                // faire apparaître d'unité, plutôt que de lever une exception.
                this.cheminIndex = pointBlocage ? pointBlocage.cheminIndex : null;
                this.indexPointDePassage = pointBlocage ? pointBlocage.indexPointDePassage : null;
                if (pointBlocage) {
                    // Pas de délai la première fois (voir la section correspondante du
                    // prompt) : seule une unité détruite en cours de partie attend
                    // CASERNE_DELAI_RESPAWN_BASE avant de réapparaître, voir
                    // mettreAJourCaserne.
                    this.faireApparaitreUnite();
                }
            } else {
                this.cheminIndex = null;
                this.indexPointDePassage = null;
                this.candidatsBlocageEnAttente = candidats;
            }
        }
    }

    // Résout le choix du joueur pour le point de blocage d'une Caserne qui en
    // attendait un (contenu additionnel post-lancement, voir le constructeur
    // ci-dessus et Interface.resoudreChoixBlocageCaserne, seule appelante). `candidat`
    // est l'un des éléments de `this.candidatsBlocageEnAttente` — jamais vérifié à
    // nouveau ici, cette vérification (le clic tombe bien sur une case candidate)
    // ayant déjà eu lieu côté Interface avant cet appel.
    resoudreChoixBlocage(candidat) {
        this.cheminIndex = candidat.cheminIndex;
        this.indexPointDePassage = candidat.indexPointDePassage;
        this.candidatsBlocageEnAttente = null;
        this.faireApparaitreUnite();
    }

    // Points de vie maximum et dégâts de l'unité de Caserne au niveau actuel de la
    // tour (phase 7E) : mêmes multiplicateurs d'amélioration que les autres tours
    // (AMELIORATION_MULTIPLICATEUR_DEGATS), appliqués aux bases dédiées de l'unité
    // (CASERNE_UNITE_PV_BASE/CASERNE_UNITE_DEGATS_BASE) plutôt qu'à degatsBase — les
    // deux valent le même nombre par construction (voir la note sur TYPES_TOURS.caserne,
    // config.js) mais restent deux sources distinctes, lues chacune pour ce qu'elle
    // documente. Le bonus permanent de dégâts du joueur (Progression.multiplicateurDegats,
    // phase 3B) s'applique aux dégâts de l'unité comme à ceux de n'importe quelle
    // tour, jamais à ses points de vie (un bonus de dégâts n'a aucune raison de
    // rendre un soldat plus résistant). Appelée à l'apparition d'une unité
    // (faireApparaitreUnite) et à chaque amélioration d'une Caserne dont l'unité est
    // déjà vivante (ameliorer), pour ne calculer cette formule qu'à un seul endroit.
    statsUniteAuNiveauActuel() {
        const multiplicateurNiveau = Config.AMELIORATION_MULTIPLICATEUR_DEGATS ** (this.niveau - 1);
        return {
            pointsDeVieMax: Math.round(Config.CASERNE_UNITE_PV_BASE * multiplicateurNiveau),
            degats: Config.CASERNE_UNITE_DEGATS_BASE * multiplicateurNiveau * Progression.multiplicateurDegats()
        };
    }

    // Fait apparaître une nouvelle unité de Caserne au point de blocage déterminé à
    // la construction (this.cheminIndex/indexPointDePassage, jamais recalculés
    // ensuite). Appelée à la construction (immédiatement) et par mettreAJourCaserne
    // après le délai de réapparition (voir plus bas).
    faireApparaitreUnite() {
        const point = Carte.chemins[this.cheminIndex].pointsDePassage[this.indexPointDePassage];
        const stats = this.statsUniteAuNiveauActuel();
        this.unite = new UniteCaserne(
            point.x, point.y,
            stats.pointsDeVieMax, stats.degats,
            this.cheminIndex, this.indexPointDePassage
        );
    }

    // Recalcule degats/cadence/portee à partir des valeurs de base et du niveau
    // actuel. Appelée à la construction et après chaque amélioration — jamais en
    // multipliant la valeur courante, voir la note du constructeur. Le bonus
    // permanent de dégâts éventuellement débloqué par le joueur (phase 3B,
    // Progression.multiplicateurDegats) s'applique ici, en plus du multiplicateur de
    // niveau de la tour : les deux se cumulent.
    recalculerStats() {
        this.degats = this.degatsBase
            * Config.AMELIORATION_MULTIPLICATEUR_DEGATS ** (this.niveau - 1)
            * Progression.multiplicateurDegats();
        this.cadence = this.cadenceBase * Config.AMELIORATION_MULTIPLICATEUR_CADENCE ** (this.niveau - 1);
        this.portee = this.porteeBase * Config.AMELIORATION_MULTIPLICATEUR_PORTEE ** (this.niveau - 1);
    }

    // Coût du prochain palier d'amélioration, ou null si le niveau maximum est déjà
    // atteint. Le coût dépend du niveau actuel (chaque palier coûte plus cher que le
    // précédent) et de l'éventuel bonus permanent de réduction débloqué par le joueur
    // (phase 3B, Progression.multiplicateurCoutAmelioration).
    coutAmelioration() {
        if (this.niveau >= Config.NIVEAU_MAX_TOUR) return null;
        return Math.round(
            Config.TYPES_TOURS[this.type].cout
            * this.niveau
            * Config.AMELIORATION_COUT_FACTEUR
            * Progression.multiplicateurCoutAmelioration()
        );
    }

    // Fait passer la tour au palier suivant. Ne déduit pas elle-même les crédits :
    // l'appelant (Interface, sur clic du bouton Améliorer) vérifie et déduit le coût
    // avant d'appeler cette méthode.
    ameliorer() {
        if (this.niveau >= Config.NIVEAU_MAX_TOUR) return;
        this.investissementTotal += this.coutAmelioration();
        this.niveau++;
        this.recalculerStats();

        // Caserne (phase 7E) : une unité déjà vivante voit ses dégâts et son maximum
        // de points de vie relevés immédiatement au nouveau niveau — comme les
        // dégâts d'une tour classique s'appliquent dès son prochain tir sans attendre
        // quoi que ce soit. Le ratio pointsDeVie/pointsDeVieMax est explicitement
        // préservé plutôt que de fixer this.unite.pointsDeVie à sa valeur d'avant
        // amélioration : geler la valeur absolue semblait au premier abord la
        // lecture la plus prudente de « jamais soignée » (aucun point de vie rendu),
        // mais produit en réalité un artefact contraire à l'intention — une unité
        // fraîchement apparue, encore à pleine vie, se retrouverait avec un ratio de
        // vie affiché en chute libre (150/150 → 150/338 après deux paliers, soit
        // 44 %) sans avoir jamais subi le moindre dégât, ce qui a été détecté en
        // testant une Caserne montée en niveau immédiatement après construction,
        // avant tout combat. Une unité déjà endommagée avant l'amélioration ne
        // regagne donc aucun point de vie en valeur absolue tant que son ratio reste
        // sous 100 %, seul son plafond change — ni soin gratuit, ni dégât fantôme.
        // Une unité déjà détruite (this.unite === null) n'a rien à mettre à jour ici :
        // sa prochaine apparition (faireApparaitreUnite) lira de toute façon le
        // niveau à jour au moment où elle se produira.
        if (this.typeDegats === 'caserne' && this.unite && this.unite.vivante) {
            const ratioVie = this.unite.pointsDeVie / this.unite.pointsDeVieMax;
            const stats = this.statsUniteAuNiveauActuel();
            this.unite.pointsDeVieMax = stats.pointsDeVieMax;
            this.unite.pointsDeVie = stats.pointsDeVieMax * ratioVie;
            this.unite.degats = stats.degats;
        }
    }

    // Montant remboursé à la vente : un pourcentage de tout ce qui a été investi
    // (achat initial + améliorations payées), pas seulement du prix d'achat.
    montantVente() {
        return Math.round(this.investissementTotal * Config.VENTE_POURCENTAGE_REMBOURSEMENT);
    }

    // Choisit l'ennemi à attaquer parmi ceux à portée. Ne réévalue pas la cible tant
    // que celle en cours reste valide (vivante, pas arrivée, toujours à portée) :
    // sans cette vérification, deux ennemis à progression égale feraient tourner le
    // canon de l'un à l'autre à chaque frame, ce qui donne un rendu tremblant. Compare
    // `ennemi.progression()` (phase 6A, généralisée en phase 7F pour couvrir aussi
    // bien un ennemi au sol qu'un drone — voir ennemi.js, qui a remplacé l'ancienne
    // Tour.progressionEnnemi ne sachant lire qu'un indexPointDePassage) plutôt que
    // l'index brut, pour rester correcte même entre deux ennemis de nature différente.
    chercherCible(ennemis) {
        const portee = this.portee * Jeu.facteurEchelle;

        // Un ennemi volant qu'une tour ne peut pas viser (Config.TYPES_TOURS[this.
        // type].peutViserVolant, phase 7F) n'est jamais retenu par la boucle de
        // recherche ci-dessous — this.cible ne peut donc, pour cette tour, jamais
        // pointer vers un tel ennemi en premier lieu : ce filtre n'a besoin d'être
        // posé qu'une seule fois, dans cette boucle, pas ici en plus pour la cible
        // déjà verrouillée.
        if (this.cible && this.cible.vivant && !this.cible.arrive) {
            const distance = Math.hypot(this.cible.x - this.x, this.cible.y - this.y);
            if (distance <= portee) {
                return;
            }
        }

        const peutViserVolant = Config.TYPES_TOURS[this.type].peutViserVolant;

        let meilleureCible = null;
        let meilleureProgression = -Infinity;
        for (const ennemi of ennemis) {
            if (!ennemi.vivant || ennemi.arrive) continue;
            // Un ennemi volant qu'un type de tour ne sait pas viser est ignoré ici
            // comme s'il n'existait pas (phase 7F) — le Flak (seul à avoir
            // peutViserVolant à true) peut au contraire cibler indifféremment un
            // ennemi au sol ou un drone, départagés par leur progression()
            // respective comme n'importe quelle paire d'ennemis au sol.
            if (ennemi.vole && !peutViserVolant) continue;

            const distance = Math.hypot(ennemi.x - this.x, ennemi.y - this.y);
            if (distance > portee) continue;

            const progression = ennemi.progression();
            if (!meilleureCible || progression > meilleureProgression) {
                meilleureCible = ennemi;
                meilleureProgression = progression;
            }
        }

        this.cible = meilleureCible;
    }

    mettreAJour(dt, ennemis, pool) {
        // Caserne (phase 7E) : ne cherche jamais de cible ni ne tire, sa seule
        // responsabilité ici est de faire réapparaître son unité après le délai
        // configuré si elle a été détruite — voir mettreAJourCaserne. Son combat
        // proprement dit (dégâts échangés avec l'ennemi qu'elle bloque) est résolu
        // ailleurs, une fois par frame pour toutes les Casernes à la fois (voir
        // Jeu.resoudreCombatsCasernes, jeu.js), pas ici tour par tour.
        if (this.typeDegats === 'caserne') {
            this.mettreAJourCaserne(dt);
            return;
        }

        this.chercherCible(ennemis);

        if (!this.cible) return;

        this.tempsDepuisDernierTir += dt;
        if (this.tempsDepuisDernierTir >= 1 / this.cadence) {
            this.tirer(pool);
            this.tempsDepuisDernierTir = 0;
        }
    }

    // Fait réapparaître l'unité de Caserne détruite après CASERNE_DELAI_RESPAWN_BASE
    // secondes, réduit par le multiplicateur de cadence de la tour (une Caserne
    // améliorée réagit plus vite) — voir la note sur TYPES_TOURS.caserne (config.js)
    // pour pourquoi ce multiplicateur se lit directement sur `this.cadence`, déjà
    // recalculé génériquement par recalculerStats() comme pour toute autre tour. Ne
    // fait rien tant qu'une unité est déjà présente et vivante : son combat est géré
    // ailleurs (Jeu.resoudreCombatsCasernes), pas ici.
    mettreAJourCaserne(dt) {
        if (this.unite && this.unite.vivante) return;
        // Aucun point de blocage valide déterminé à la construction (voir le
        // constructeur) : ne devrait normalement jamais arriver en jeu réel, cette
        // Caserne reste alors sans unité pour toujours plutôt que de lever une
        // exception à chaque frame.
        if (this.cheminIndex === null) return;

        this.tempsDepuisDestruction += dt;
        if (this.tempsDepuisDestruction >= Config.CASERNE_DELAI_RESPAWN_BASE / this.cadence) {
            this.faireApparaitreUnite();
            this.tempsDepuisDestruction = 0;
        }
    }

    // Active le premier projectile inactif du pool. Si tous sont déjà en vol (cas
    // rare), le tir demandé est simplement ignoré pour cette frame (le flash de
    // particules et le son de tir aussi, dans ce cas : rien à montrer ni à faire
    // entendre pour un tir qui n'a pas eu lieu).
    tirer(pool) {
        const projectile = pool.find(p => !p.actif);
        if (!projectile) return;

        projectile.activer(this.x, this.y, this.cible, this.degats, this.couleur, this.typeDegats);

        // Flash de tir (phase 4B) : quelques particules projetées vers la cible,
        // depuis un point légèrement décalé du centre pour évoquer le canon plutôt
        // que le socle lui-même.
        const angle = Math.atan2(this.cible.y - this.y, this.cible.x - this.x);
        const decalage = Carte.tailleCase * 0.3;
        Particules.creerTir(
            this.x + Math.cos(angle) * decalage,
            this.y + Math.sin(angle) * decalage,
            angle,
            this.couleur
        );
        Son.jouerTir(this.type);
    }

    // Trace un polygone régulier plein (socle) centré sur (cx, cy) : `cotes` sommets,
    // `rotation` en radians pour orienter le premier sommet (permet par ex. de pointer
    // un côté plat vers le haut plutôt qu'un sommet). Partagé par les trois formes de
    // socle ci-dessous plutôt que dupliqué.
    dessinerSoclePolygone(ctx, rayon, cotes, rotation) {
        ctx.beginPath();
        for (let i = 0; i < cotes; i++) {
            const angle = rotation + (i / cotes) * Math.PI * 2;
            const px = this.x + Math.cos(angle) * rayon;
            const py = this.y + Math.sin(angle) * rayon;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
    }

    // Trace un canon (segment épais) depuis le centre de la tour, à l'angle donné,
    // décalé perpendiculairement de `decalage` pixels (0 = canon central). Partagé par
    // les trois types : seuls longueur, épaisseur et nombre de canons diffèrent.
    dessinerCanon(ctx, angle, longueur, epaisseur, decalage) {
        const perpendiculaire = angle + Math.PI / 2;
        const baseX = this.x + Math.cos(perpendiculaire) * decalage;
        const baseY = this.y + Math.sin(perpendiculaire) * decalage;

        ctx.strokeStyle = '#d0d0d8';
        ctx.lineWidth = epaisseur;
        ctx.beginPath();
        ctx.moveTo(baseX, baseY);
        ctx.lineTo(baseX + Math.cos(angle) * longueur, baseY + Math.sin(angle) * longueur);
        ctx.stroke();
    }

    // Formes distinctes par type de tour (phase 4A, Flak ajouté en 7D, Caserne en
    // 7E), pour ne plus dépendre de la lettre M/C/S posée en phase 2A pour les
    // distinguer :
    // - Mitrailleuse : losange compact, deux canons fins jumelés (cadence élevée) ;
    // - Canon : octogone massif, un seul canon épais (gros dégâts, cadence lente) ;
    // - Sniper : triangle effilé, un canon long et fin (portée très supérieure) ;
    // - Flak : carré large, quatre canons courts en éventail à 45° les uns des
    //   autres (dégâts de zone, voir Projectile.mettreAJour) — évoque une batterie
    //   antiaérienne à tir multiple plutôt qu'un canon unique ;
    // - Caserne : pentagone (bâtiment plutôt qu'une arme), sans aucun canon — elle
    //   ne vise ni ne tire jamais (voir mettreAJourCaserne), son unité (UniteCaserne,
    //   unite.js) combat à sa place, sur la case de chemin qu'elle bloque.
    // Le halo néon (couleur du type, voir Config.HALO_FLOU_TOUR_BASE) s'intensifie
    // légèrement à chaque amélioration, pour que le niveau d'une tour se lise aussi
    // d'un coup d'œil sans ouvrir le panneau d'amélioration — même mécanisme pour
    // tous les types, aucun code spécifique à écrire ici pour un type en particulier.
    // `ctx.shadowBlur` est remis à 0 avant les canons : le halo doit rester propre au
    // socle, pas baver sur le reste de la scène dessinée ensuite dans la même frame.
    dessiner(ctx) {
        const taille = Carte.tailleCase;

        // Sans cible ni cadran à orienter, une Caserne pointe toujours dans cette
        // direction par défaut, comme n'importe quelle autre tour qui n'a
        // actuellement aucune cible (this.cible reste d'ailleurs toujours null pour
        // elle, voir mettreAJour) — sans conséquence puisqu'elle ne dessine aucun
        // canon à orienter de toute façon.
        let angle = -Math.PI / 2;
        if (this.cible) {
            angle = Math.atan2(this.cible.y - this.y, this.cible.x - this.x);
        }

        ctx.shadowColor = this.couleur;
        ctx.shadowBlur = Config.HALO_FLOU_TOUR_BASE + (this.niveau - 1) * Config.HALO_FLOU_TOUR_PAR_NIVEAU;
        ctx.fillStyle = this.couleur;

        if (this.type === 'mitrailleuse') {
            this.dessinerSoclePolygone(ctx, taille * 0.32, 4, Math.PI / 4);
        } else if (this.type === 'canon') {
            this.dessinerSoclePolygone(ctx, taille * 0.34, 8, 0);
        } else if (this.type === 'sniper') {
            this.dessinerSoclePolygone(ctx, taille * 0.36, 3, -Math.PI / 2);
        } else if (this.type === 'flak') {
            // Même rotation que la Mitrailleuse (Math.PI/4, cotes=4) — c'est ce qui
            // donne un carré aux côtés bien à plat plutôt qu'un losange pointu
            // (vérifié à l'écran : rotation=0 sur un carré à 4 côtés produit un
            // losange, Math.PI/4 un carré bien droit, malgré ce que suggérerait le
            // commentaire « losange » ci-dessus pour la Mitrailleuse — inexact depuis
            // la phase 4A, sans lien avec cette phase). Nettement plus large
            // (taille * 0.38 contre 0.32) : rester distinct de la Mitrailleuse vient
            // ici de la taille, de la couleur et du nombre de canons, pas de la forme
            // de base elle-même.
            this.dessinerSoclePolygone(ctx, taille * 0.38, 4, Math.PI / 4);
        } else {
            // Caserne : pentagone plutôt qu'un polygone déjà utilisé par un autre
            // type, pour rester reconnaissable d'un coup d'œil même sans canon —
            // seul type dans ce cas, l'absence de canon (voir plus bas) suffirait de
            // toute façon à la distinguer des quatre autres tours, toutes armées.
            this.dessinerSoclePolygone(ctx, taille * 0.34, 5, -Math.PI / 2);
        }

        ctx.shadowBlur = 0;

        if (this.type === 'mitrailleuse') {
            const decalage = taille * 0.09;
            this.dessinerCanon(ctx, angle, taille * 0.32, Math.max(1.5, taille * 0.05), decalage);
            this.dessinerCanon(ctx, angle, taille * 0.32, Math.max(1.5, taille * 0.05), -decalage);
        } else if (this.type === 'canon') {
            this.dessinerCanon(ctx, angle, taille * 0.3, Math.max(3, taille * 0.12), 0);
        } else if (this.type === 'sniper') {
            this.dessinerCanon(ctx, angle, taille * 0.5, Math.max(1.5, taille * 0.05), 0);
        } else if (this.type === 'flak') {
            // Quatre canons courts en éventail autour de l'angle de visée, chacun
            // décalé de 45° du suivant (±22,5° et ±67,5° par rapport au centre du
            // faisceau) — pas quatre canons répartis à 90° sur tout le pourtour
            // (nord/sud/est/ouest), qui ne pointeraient pas vers la cible comme les
            // trois autres types et ne lirait pas comme une seule batterie tirant
            // dans une direction. `decalage` (perpendiculaire) reste à 0 : c'est
            // l'angle de chaque canon, pas sa position de départ, qui les sépare.
            const longueur = taille * 0.22;
            const epaisseur = Math.max(2, taille * 0.06);
            for (const decalageAngle of [-3, -1, 1, 3]) {
                this.dessinerCanon(ctx, angle + decalageAngle * (Math.PI / 8), longueur, epaisseur, 0);
            }
        }
        // Caserne : aucun canon, elle ne vise ni ne tire jamais (voir mettreAJour).
    }
}

class Projectile {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.cible = null;
        this.degats = 0;
        // Couleur de la tour tireuse (phase 4B), utilisée uniquement pour teinter les
        // particules d'impact à l'arrivée (voir mettreAJour ci-dessous) — le
        // projectile lui-même reste dessiné en blanc, voir dessiner().
        this.couleur = '#ffffff';
        // 'unique' ou 'zone' (phase 7D), copié depuis la tour tireuse à l'activation —
        // voir Tour.typeDegats (tour.js) et la bifurcation dans mettreAJour ci-dessous.
        this.typeDegats = 'unique';
        this.actif = false;
    }

    // Réinitialise les propriétés d'un projectile inactif du pool au lieu d'en créer
    // un nouveau avec `new` (voir la note en tête de fichier).
    activer(x, y, cible, degats, couleur, typeDegats) {
        this.x = x;
        this.y = y;
        this.cible = cible;
        this.degats = degats;
        this.couleur = couleur;
        this.typeDegats = typeDegats;
        this.actif = true;
    }

    // `ennemisActifs` (phase 7D, Jeu.ennemisActifs) : nécessaire pour qu'un impact à
    // dégâts de zone puisse évaluer qui se trouve autour du point d'impact, en plus
    // de la cible verrouillée — les trois types à dégâts uniques reçoivent ce
    // paramètre sans jamais s'en servir, aucun changement de comportement pour eux.
    mettreAJour(dt, ennemisActifs) {
        if (!this.actif) return;

        // La cible a déjà été détruite par un autre projectile arrivé avant celui-ci :
        // pas de dégâts, on libère simplement le projectile.
        if (!this.cible.vivant) {
            this.actif = false;
            return;
        }

        const dx = this.cible.x - this.x;
        const dy = this.cible.y - this.y;
        const distanceRestante = Math.hypot(dx, dy);

        if (distanceRestante < Config.PROJECTILE_RAYON_IMPACT) {
            if (this.typeDegats === 'zone') {
                // Dégâts de zone (Flak, phase 7D) : tout ennemi vivant à moins de
                // FLAK_RAYON_EXPLOSION du point d'impact réel du projectile (this.x/
                // this.y) — pas de la position de this.cible, qui n'est qu'un point
                // de visée parmi d'autres ennemis potentiellement présents dans le
                // rayon. On parcourt `ennemisActifs` une seule fois : chaque ennemi
                // n'y apparaît qu'une fois, donc chacun ne peut recevoir les dégâts
                // qu'une seule fois par explosion, sans filet supplémentaire à écrire.
                const rayon = Config.FLAK_RAYON_EXPLOSION * Jeu.facteurEchelle;
                for (const ennemi of ennemisActifs) {
                    if (!ennemi.vivant) continue;
                    const distanceExplosion = Math.hypot(ennemi.x - this.x, ennemi.y - this.y);
                    if (distanceExplosion < rayon) {
                        ennemi.subirDegats(this.degats);
                    }
                }
                // Toujours déclenchée, même sans aucun ennemi touché : le joueur doit
                // pouvoir voir où se situe la zone d'effet, pas seulement quand elle
                // s'avère utile. Nombre de particules dédié (PARTICULE_NOMBRE_
                // EXPLOSION_ZONE), plus fourni qu'un impact ordinaire pour bien
                // matérialiser l'étendue touchée.
                Particules.creerExplosion(this.x, this.y, this.couleur, Config.PARTICULE_NOMBRE_EXPLOSION_ZONE);
            } else {
                this.cible.subirDegats(this.degats);
                // Impact sans mise à mort (phase 4B) : la mort elle-même déclenche sa
                // propre explosion ailleurs (Jeu.simuler, au moment où l'ennemi est
                // retiré de la liste des actifs), pour ne jamais superposer les deux
                // effets sur un seul et même coup fatal.
                if (this.cible.vivant) {
                    Particules.creerImpact(this.x, this.y, this.couleur);
                }
            }
            this.actif = false;
            return;
        }

        const pas = Config.PROJECTILE_VITESSE * Jeu.facteurEchelle * dt;
        this.x += (dx / distanceRestante) * pas;
        this.y += (dy / distanceRestante) * pas;
    }

    dessiner(ctx) {
        if (!this.actif) return;

        ctx.fillStyle = '#f5f5ff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
        ctx.fill();
    }
}
