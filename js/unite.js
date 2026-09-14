// unite.js — Classe UniteCaserne (phase 7E, contenu additionnel post-lancement) :
// l'unité statique posée par une tour Caserne (voir Tour.faireApparaitreUnite,
// tour.js) sur une case de chemin pour la bloquer physiquement. Ne se déplace
// jamais, ne vise rien elle-même : son combat au corps à corps avec l'ennemi qu'elle
// bloque est résolu une fois par frame pour toutes les Casernes à la fois par
// Jeu.resoudreCombatsCasernes (jeu.js), pas par une méthode sur cette classe.
// Fichier séparé de tour.js plutôt qu'une classe de plus dedans, comme suggéré par
// le prompt de cette phase : tour.js restait déjà conséquent après l'ajout du Flak
// (phase 7D).

class UniteCaserne {
    // `x`/`y` : position en pixels du point de blocage au moment de l'apparition —
    // fixée une fois ici, jamais recalculée ensuite (même limitation qu'un Tour, dont
    // this.x/this.y ne sont eux non plus jamais recalculés après construction : un
    // redimensionnement du canvas en cours de partie décale légèrement l'un comme
    // l'autre jusqu'à la prochaine apparition/reconstruction, pas une régression
    // propre à cette phase). `pointsDeVie`/`degats` viennent de
    // Tour.statsUniteAuNiveauActuel() ; `cheminIndex`/`indexPointDePassage` sont
    // recopiés du point de blocage de la tour, pour que Jeu.resoudreCombatsCasernes
    // et Ennemi.deplacer puissent les lire directement sur l'unité plutôt que de
    // remonter à sa tour.
    constructor(x, y, pointsDeVieMax, degats, cheminIndex, indexPointDePassage) {
        this.x = x;
        this.y = y;
        this.pointsDeVieMax = pointsDeVieMax;
        this.pointsDeVie = pointsDeVieMax;
        this.degats = degats;
        this.cheminIndex = cheminIndex;
        this.indexPointDePassage = indexPointDePassage;
        this.vivante = true;
    }

    // Petit robot statique dans Config.COULEURS.neonBleu, surmonté d'une barre de
    // vie — même principe que Ennemi.dessiner (phase 4A/7A), mais sans orientation
    // (this.angleDirection n'existe pas ici : cette unité ne se déplaçant jamais,
    // il n'y a aucun sens de marche à représenter). Halo néon comme les tours,
    // retiré aussitôt après pour ne pas baver sur la barre de vie ni le reste de la
    // scène dessinée ensuite dans la même frame.
    dessiner(ctx) {
        if (!this.vivante) return;

        const taille = Carte.tailleCase;
        const rayon = taille * 0.22;

        ctx.shadowColor = Config.COULEURS.neonBleu;
        ctx.shadowBlur = Config.HALO_FLOU_TOUR_BASE;
        ctx.fillStyle = Config.COULEURS.neonBleu;
        ctx.fillRect(this.x - rayon, this.y - rayon, rayon * 2, rayon * 2);
        ctx.shadowBlur = 0;

        // Accent central plus clair, façon visière — purement décoratif, aucune
        // signification de jeu (contrairement au capteur orienté des châssis
        // d'ennemis, phase 7A, cette unité ne pointe jamais nulle part).
        ctx.fillStyle = '#cfe6ff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, rayon * 0.35, 0, Math.PI * 2);
        ctx.fill();

        const largeurBarre = rayon * 2;
        const hauteurBarre = Math.max(2, taille * 0.06);
        const xBarre = this.x - rayon;
        const yBarre = this.y - rayon - hauteurBarre - 3;
        const ratioVie = this.pointsDeVie / this.pointsDeVieMax;

        ctx.fillStyle = '#555560';
        ctx.fillRect(xBarre, yBarre, largeurBarre, hauteurBarre);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(xBarre, yBarre, largeurBarre * ratioVie, hauteurBarre);
    }
}
