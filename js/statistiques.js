// statistiques.js — Objet Statistiques : ce qui s'est passé pendant la partie en
// cours (dégâts par type de tour, ennemis détruits par type, crédits gagnés...),
// affiché sur l'écran de victoire ou de défaite (voir Interface.afficherStatistiques).
// Remis à zéro à chaque nouvelle partie (Jeu.reinitialiser) et inclus dans la
// sauvegarde de la partie en cours (sauvegarde.js), pour qu'une partie reprise garde
// ses chiffres. Contrairement à Progression, rien ici ne survit à la fin de la partie.

const Statistiques = {
    // Dégâts réellement infligés (jamais plus que les points de vie et le bouclier
    // qui restaient à l'ennemi), par type de tour : { canon: 12400, ... }.
    degatsParTour: {},
    // Ennemis détruits, par type d'ennemi : { standard: 80, boss: 2, ... }.
    eliminationsParType: {},
    // Ennemis qui ont atteint l'arrivée.
    ennemisPasses: 0,
    // Crédits gagnés pendant la partie (ennemis détruits, fins de vague, bonus d'appel
    // anticipé), hors crédits de départ et remboursements de vente.
    creditsGagnes: 0,
    toursConstruites: 0,
    vaguesAppeleesEnAvance: 0,

    reinitialiser() {
        this.degatsParTour = {};
        this.eliminationsParType = {};
        this.ennemisPasses = 0;
        this.creditsGagnes = 0;
        this.toursConstruites = 0;
        this.vaguesAppeleesEnAvance = 0;
    },

    // `typeTour` peut être null pour un projectile tiré par un outil de test qui ne
    // le renseigne pas : ces dégâts ne sont alors simplement pas comptés.
    ajouterDegats(typeTour, montant) {
        if (!typeTour || !(montant > 0)) return;
        this.degatsParTour[typeTour] = (this.degatsParTour[typeTour] || 0) + montant;
    },

    ajouterElimination(typeEnnemi) {
        this.eliminationsParType[typeEnnemi] = (this.eliminationsParType[typeEnnemi] || 0) + 1;
    },

    totalEliminations() {
        return Object.values(this.eliminationsParType).reduce((somme, n) => somme + n, 0);
    },

    // Types de tour ayant infligé des dégâts, du plus efficace au moins efficace,
    // avec leur part du total : [{ type, degats, part }, ...].
    classementTours() {
        const total = Object.values(this.degatsParTour).reduce((somme, n) => somme + n, 0);
        return Object.entries(this.degatsParTour)
            .map(([type, degats]) => ({ type, degats, part: total > 0 ? degats / total : 0 }))
            .sort((a, b) => b.degats - a.degats);
    },

    // Copie simple pour la sauvegarde de la partie en cours (JSON), et relecture.
    exporter() {
        return {
            degatsParTour: { ...this.degatsParTour },
            eliminationsParType: { ...this.eliminationsParType },
            ennemisPasses: this.ennemisPasses,
            creditsGagnes: this.creditsGagnes,
            toursConstruites: this.toursConstruites,
            vaguesAppeleesEnAvance: this.vaguesAppeleesEnAvance
        };
    },

    importer(donnees) {
        this.reinitialiser();
        if (!donnees) return;
        this.degatsParTour = { ...donnees.degatsParTour };
        this.eliminationsParType = { ...donnees.eliminationsParType };
        this.ennemisPasses = donnees.ennemisPasses || 0;
        this.creditsGagnes = donnees.creditsGagnes || 0;
        this.toursConstruites = donnees.toursConstruites || 0;
        this.vaguesAppeleesEnAvance = donnees.vaguesAppeleesEnAvance || 0;
    }
};
