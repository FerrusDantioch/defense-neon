// simulation-parties.js — Fait jouer des parties complètes à un « joueur raisonnable »
// simulé, hors navigateur, pour vérifier l'équilibrage après un changement de règles.
// Comme simulation-equilibrage.js, ne duplique pas la logique du jeu : recharge tels
// quels les fichiers de js/ dans un contexte vm Node et ne réécrit ici que la boucle
// de Jeu.simuler (sans affichage) et les décisions du joueur.
//
// Le joueur simulé, à chaque fin de vague et toutes les 0,25 s pendant une vague,
// dépense ses crédits en faisant toujours l'action la moins chère : construire le
// prochain type de sa rotation, ou améliorer la tour dont l'amélioration coûte le
// moins. Placement : une tour au sol va sur la case autorisée qui couvre le plus de
// cases de voie, en favorisant les voies encore peu couvertes ; un Flak va là où il
// couvre le plus de trajectoires de drone pas encore couvertes par un autre Flak. Il
// lance chaque vague dès que la précédente est finie. Deux stratégies :
// - « équilibrée » : un Flak sur six tours ;
// - « anti-drones » : un Flak sur deux tours ;
// - « anti-drones avec Gel » : la même, avec une tour Gel à la place d'un Flak.
//
// Compare les règles actuelles (Config tel quel : 3 voies, tours obligatoirement le
// long d'une voie) aux anciennes (2 voies plus 25 % de chances d'une 3e, construction
// libre), en difficulté normale et supérieure. Aucune Caserne n'est construite, et
// aucun bonus permanent de niveau de joueur n'est actif.
//
// Usage :
//   node outils/simulation-parties.js [nombreDeGraines] [nombreDeVagues]

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DOSSIER_JS = path.join(__dirname, '..', 'js');
const NOMBRE_GRAINES = parseInt(process.argv[2], 10) || 12;
const NOMBRE_VAGUES = parseInt(process.argv[3], 10) || 20;
const DT = 1 / 30;
const INTERVALLE_DECISION = 0.25;

const STRATEGIES = [
    { nom: 'équilibrée (1 Flak sur 6)', rotation: ['mitrailleuse', 'canon', 'mitrailleuse', 'flak', 'sniper', 'canon'] },
    { nom: 'anti-drones (1 Flak sur 2)', rotation: ['mitrailleuse', 'flak', 'canon', 'flak', 'sniper', 'flak'] },
    { nom: 'anti-drones avec Gel', rotation: ['mitrailleuse', 'flak', 'canon', 'gel', 'sniper', 'flak'] }
];

const REGLES = [
    { nom: 'anciennes règles', nombreChemins: 2, probabiliteTroisieme: 0.25, adjacence: false },
    { nom: 'règles actuelles', actuelles: true, adjacence: true }
];

// Contexte vm frais par partie : aucun état (Carte, Vagues, Aleatoire...) ne fuit
// d'une partie à l'autre.
function creerContexte() {
    const sandbox = {
        console,
        Jeu: { facteurEchelle: 1, nombreDeVagues: NOMBRE_VAGUES, toursActives: [], difficulteSuperieure: false },
        Interface: { afficherMessageConstruction() {} },
        Particules: { creerTir() {}, creerImpact() {}, creerExplosion() {} },
        // Toutes les méthodes de Son deviennent des fonctions vides.
        Son: new Proxy({}, { get: () => () => {} })
    };
    vm.createContext(sandbox);
    const fichiers = ['config.js', 'aleatoire.js', 'carte.js', 'ennemi.js', 'vagues.js', 'unite.js', 'tour.js', 'progression.js', 'statistiques.js'];
    const source = fichiers.map(f => fs.readFileSync(path.join(DOSSIER_JS, f), 'utf8')).join('\n;\n');
    new vm.Script(
        source + '\n;Object.assign(globalThis, { Config, Carte, Vagues, Ennemi, Tour, Projectile });',
        { filename: 'omni-defense-concatene.js' }
    ).runInContext(sandbox);
    return sandbox;
}

function distanceAuSegment(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

// Joue une partie complète ; renvoie son issue et l'intégrité perdue par type d'ennemi.
function jouerPartie(graine, regles, strategie, difficulteSuperieure) {
    const { Config, Carte, Vagues, Ennemi, Tour, Projectile, Jeu } = creerContexte();
    if (!regles.actuelles) {
        Config.NOMBRE_CHEMINS_PAR_DEFAUT = regles.nombreChemins;
        Config.PROBABILITE_TROISIEME_CHEMIN = regles.probabiliteTroisieme;
    }
    Jeu.difficulteSuperieure = difficulteSuperieure;

    Carte.generer(graine);
    Carte.tailleCase = Config.LARGEUR_REFERENCE / Config.COLONNES;
    Carte.recalculerPixels();

    // Même règle et même calcul de limite que Interface.tenterConstruireTour et
    // Jeu.reinitialiser (pour les règles actuelles).
    const autorisee = (c, l) => Carte.estConstructible(c, l) && (!regles.adjacence || Carte.estAdjacentAUnChemin(c, l));
    let casesAutorisees = 0;
    for (let l = 0; l < Config.LIGNES; l++) {
        for (let c = 0; c < Config.COLONNES; c++) {
            if (autorisee(c, l)) casesAutorisees++;
        }
    }
    const limiteTours = Math.floor(casesAutorisees * Config.PROPORTION_LIMITE_TOURS);

    // Placement (voir la note en tête de fichier).
    const casesAPorteeParVoie = (c, l, portee) => {
        const centre = Carte.caseVersPixels(c, l);
        return Carte.chemins.map(info => info.pointsDePassage.filter(p => Math.hypot(p.x - centre.x, p.y - centre.y) <= portee).length);
    };
    const toursParVoie = Carte.chemins.map(() => 0);
    const trajectoiresDrone = [];
    for (let a = 0; a < Config.COLONNES; a++) {
        for (let b = 0; b < Config.COLONNES; b++) {
            trajectoiresDrone.push({ depart: Carte.caseVersPixels(a, 0), arrivee: Carte.caseVersPixels(b, Config.LIGNES - 1), couverte: false });
        }
    }
    const trajectoiresAPortee = (c, l, portee) => {
        const centre = Carte.caseVersPixels(c, l);
        return trajectoiresDrone.filter(t => !t.couverte && distanceAuSegment(centre, t.depart, t.arrivee) <= portee);
    };
    const score = (c, l, type) => {
        const portee = Config.TYPES_TOURS[type].portee;
        const sol = casesAPorteeParVoie(c, l, portee).reduce((somme, n, i) => somme + n / (1 + toursParVoie[i]), 0);
        return type === 'flak' ? trajectoiresAPortee(c, l, portee).length + sol * 0.1 : sol;
    };

    const multCredits = difficulteSuperieure ? Config.DIFFICULTE_SUPERIEURE_MULTIPLICATEUR_CREDITS : 1;
    const multIntegrite = difficulteSuperieure ? Config.DIFFICULTE_SUPERIEURE_MULTIPLICATEUR_INTEGRITE : 1;
    let credits = Math.round(Config.CREDITS_DEPART * multCredits);
    let integrite = Math.round(Config.INTEGRITE_DEPART * multIntegrite);
    const pertes = {};
    const ennemis = [];
    const tours = [];
    Jeu.toursActives = tours;
    const projectiles = Array.from({ length: Config.TAILLE_POOL_PROJECTILES }, () => new Projectile());
    Vagues.reinitialiser();

    const depenser = () => {
        for (;;) {
            const type = strategie.rotation[tours.length % strategie.rotation.length];
            const coutConstruction = Config.TYPES_TOURS[type].cout;
            let amelioration = null;
            for (const tour of tours) {
                const cout = tour.coutAmelioration();
                if (cout !== null && (!amelioration || cout < amelioration.cout)) amelioration = { tour, cout };
            }

            const construire = tours.length < limiteTours && credits >= coutConstruction
                && (!amelioration || coutConstruction <= amelioration.cout);
            if (construire) {
                let choix = null;
                let meilleurScore = -1;
                for (let l = 0; l < Config.LIGNES; l++) {
                    for (let c = 0; c < Config.COLONNES; c++) {
                        if (!autorisee(c, l)) continue;
                        const s = score(c, l, type);
                        if (s > meilleurScore) {
                            meilleurScore = s;
                            choix = { c, l };
                        }
                    }
                }
                if (!choix) return;
                const portee = Config.TYPES_TOURS[type].portee;
                casesAPorteeParVoie(choix.c, choix.l, portee).forEach((n, i) => { if (n > 0) toursParVoie[i]++; });
                if (type === 'flak') {
                    for (const t of trajectoiresAPortee(choix.c, choix.l, portee)) t.couverte = true;
                }
                tours.push(new Tour(choix.c, choix.l, type));
                Carte.grille[choix.l][choix.c] = 'OCCUPEE';
                credits -= coutConstruction;
            } else if (amelioration && credits >= amelioration.cout) {
                credits -= amelioration.cout;
                amelioration.tour.ameliorer();
            } else {
                return;
            }
        }
    };

    let tempsDepuisDecision = 0;
    for (let numero = 1; numero <= NOMBRE_VAGUES; numero++) {
        depenser();
        Vagues.demarrer(numero);
        while (Vagues.enCours) {
            // Même ordre que Jeu.simuler (jeu.js), sans les Casernes.
            Tour.appliquerRalentissements(tours, ennemis);
            Ennemi.appliquerSoins(ennemis, DT);
            for (const ennemi of ennemis) ennemi.deplacer(DT);
            for (const tour of tours) tour.mettreAJour(DT, ennemis, projectiles);
            for (const projectile of projectiles) projectile.mettreAJour(DT, ennemis);
            for (let i = ennemis.length - 1; i >= 0; i--) {
                const ennemi = ennemis[i];
                if (ennemi.arrive) {
                    integrite -= Config.DEGATS_INTEGRITE_PAR_ENNEMI;
                    pertes[ennemi.type] = (pertes[ennemi.type] || 0) + 1;
                    ennemis.splice(i, 1);
                } else if (!ennemi.vivant) {
                    credits += ennemi.recompense;
                    ennemis.splice(i, 1);
                }
            }
            Vagues.mettreAJour(DT, ennemis);
            credits += Vagues.credits;
            Vagues.credits = 0;

            if (integrite <= 0) return { victoire: false, vague: numero, integrite: 0, tours: tours.length, limiteTours, pertes };

            tempsDepuisDecision += DT;
            if (tempsDepuisDecision >= INTERVALLE_DECISION) {
                tempsDepuisDecision = 0;
                depenser();
            }
        }
    }
    return { victoire: true, vague: NOMBRE_VAGUES, integrite, tours: tours.length, limiteTours, pertes };
}

const lignes = [];
for (const difficulteSuperieure of [false, true]) {
    for (const strategie of STRATEGIES) {
        for (const regles of REGLES) {
            const resultats = [];
            for (let i = 1; i <= NOMBRE_GRAINES; i++) {
                resultats.push(jouerPartie(1000 + i * 7919, regles, strategie, difficulteSuperieure));
            }
            const moyenne = (f) => Number((resultats.reduce((s, r) => s + f(r), 0) / resultats.length).toFixed(1));
            const pertesDrones = resultats.reduce((s, r) => s + (r.pertes.drone || 0), 0);
            const pertesTotales = resultats.reduce((s, r) => s + Object.values(r.pertes).reduce((a, b) => a + b, 0), 0);
            lignes.push({
                'Difficulté': difficulteSuperieure ? 'supérieure' : 'normale',
                'Stratégie': strategie.nom,
                'Règles': regles.nom,
                'Victoires': `${resultats.filter(r => r.victoire).length}/${NOMBRE_GRAINES}`,
                'Vague moyenne': moyenne(r => r.vague),
                'Intégrité restante': moyenne(r => r.integrite),
                'Tours (limite)': `${moyenne(r => r.tours)} (${moyenne(r => r.limiteTours)})`,
                'Pertes dues aux drones': pertesTotales ? `${Math.round(pertesDrones / pertesTotales * 100)} %` : '-'
            });
        }
    }
}

console.log(`\nParties de ${NOMBRE_VAGUES} vagues, ${NOMBRE_GRAINES} graines par ligne :\n`);
console.table(lignes);
