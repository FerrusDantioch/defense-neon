// PHASE 6B : les mesures d'équilibrage de ce script (rounds 1-4, valeurs citées dans
// config.js) sont devenues obsolètes avec les chemins multiples de la phase 6A, qui
// changent la consommation d'Aleatoire (tirage du cheminIndex de chaque ennemi) et
// donc la reproductibilité des graines déjà testées — voir ARCHITECTURE.md. Un
// nouveau round de mesure devra être rejoué ici, une fois la limite de tours
// constructibles elle-même posée (également phase 6B) : ne pas s'y remettre avant.
//
// simulation-equilibrage.js — Simulation hors navigateur de « Défense Néon », pour
// comparer des stratégies de construction/amélioration de tours à coups de chiffres
// plutôt qu'à l'œil. Ne duplique pas la logique du jeu : recharge tels quels
// config.js, aleatoire.js, carte.js, ennemi.js, vagues.js et tour.js dans un contexte
// vm Node (voir creerContexteJeu ci-dessous), et pilote ces mêmes objets/classes avec
// une petite boucle headless écrite ici — l'équivalent sans DOM de Jeu.simuler et de
// la sélection de tour d'interface.js, qui elles restent hors de propos ici (tout
// canvas/DOM).
//
// Usage :
//   node outils/simulation-equilibrage.js
//
// En plus de la comparaison des deux stratégies par horizon et de la variation de
// Config.AMELIORATION_COUT_FACTEUR (premier round de vérification d'équilibrage), ce
// script rejoue aussi, à la vague 15 uniquement :
//   - la même comparaison sur huit graines fixes, pour vérifier que l'écart observé
//     entre stratégies ne dépend pas d'une seule carte (expérience 1) ;
//   - la stratégie « tour unique » avec Config.NIVEAU_MAX_TOUR porté à 8 au lieu de sa
//     valeur réelle, pour tester l'hypothèse que le plafond de niveau (et non le coût
//     des paliers) explique l'essentiel de cet écart (expérience 2) ;
//   - le même écart pour les plafonds intermédiaires 4, 5, 6, 7, avec un tableau
//     consolidé 3→8 et le multiplicateur théorique de dégâts par seconde par niveau,
//     pour localiser où l'écart cesse d'être écrasant dans un sens ou l'autre
//     (expérience 3) ;
//   - l'effet isolé de chacun des cinq paliers de bonus permanents du joueur
//     (Config.PALIERS_BONUS, phase 3B) sur l'intégrité restante à la vague 15, un
//     palier activé à la fois (les quatre autres neutralisés) pour les comparer entre
//     eux à armes égales plutôt que cumulés (expérience 4).
//
// Ce script ne modifie jamais js/config.js sur le disque : toute variation de
// constante (Config.AMELIORATION_COUT_FACTEUR, Config.NIVEAU_MAX_TOUR) ou de méthode
// de Progression (expérience 4) n'a lieu qu'en mémoire, le temps d'un essai, puis est
// restaurée.
//
// À garder à jour au fil des phases : si la phase 3 (niveau de joueur, expérience)
// ajoute de nouveaux paramètres de progression qui influencent le déroulement d'une
// partie, ce script est l'endroit où rejouer les mêmes comparaisons d'équilibrage.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DOSSIER_JS = path.join(__dirname, '..', 'js');

// Fichiers de logique pure du jeu, chargés dans le même ordre que index.html (seuls
// jeu.js et interface.js sont exclus : ils ne contiennent que de l'affichage et des
// accès DOM/canvas, remplacés ici par le pilote headless plus bas).
const FICHIERS_A_CHARGER = [
    'config.js',
    'aleatoire.js',
    'carte.js',
    'ennemi.js',
    'vagues.js',
    'tour.js',
    'progression.js'
];

// Construit un contexte vm frais exposant Config, Aleatoire, Carte, Ennemi, Vagues,
// Tour, Projectile et Progression — les vrais objets/classes du jeu, sans aucune
// copie de leur code. `Jeu` y est un stub minimaliste : ennemi.js et tour.js ne
// lisent que `Jeu.facteurEchelle` (voir ARCHITECTURE.md « Mise à l'échelle des
// distances », laissé à 1 ici puisque Carte.tailleCase est fixée à l'échelle de
// référence de 40 px/case) et vagues.js ne lit que `Jeu.nombreDeVagues` pour refuser
// de démarrer une vague au-delà de la durée choisie ; on le laisse à Infinity, c'est
// notre propre boucle (executerSimulation) qui décide seule quand s'arrêter après 15
// vagues. Progression y démarre à son état par défaut (niveau 1, aucun bonus) : rien
// ne l'y fait jamais charger depuis localStorage (qui n'existe pas dans Node de toute
// façon), donc les simulations démarrent toutes sans bonus sauf quand l'expérience 4
// en active un explicitement.
function creerContexteJeu() {
    const sandbox = {
        console,
        Jeu: { facteurEchelle: 1, nombreDeVagues: Infinity },
        // Stubs no-op (phase 4B) : Tour.tirer() (flash de tir + son) et
        // Projectile.mettreAJour() (impact) appellent Particules/Son, jamais chargés
        // ici puisqu'ils ne contiennent que du rendu canvas/audio sans DOM. La mort
        // d'un ennemi (Particules.creerExplosion, Son.jouerMort) est gérée dans
        // jeu.js, non chargé non plus, donc ces méthodes ne sont jamais atteintes
        // depuis cette simulation headless — les stubs ci-dessous couvrent quand
        // même l'ensemble des méthodes de ces deux objets pour rester robustes si
        // une future phase les invoque aussi depuis tour.js/ennemi.js.
        Particules: {
            creerTir() {},
            creerImpact() {},
            creerExplosion() {}
        },
        Son: {
            jouerTir() {},
            jouerMort() {},
            jouerConstruction() {},
            jouerAmelioration() {},
            jouerVente() {},
            jouerAlerte() {},
            jouerDefaite() {},
            jouerVictoire() {}
        }
    };
    vm.createContext(sandbox);

    const sourceConcatenee = FICHIERS_A_CHARGER
        .map(nomFichier => fs.readFileSync(path.join(DOSSIER_JS, nomFichier), 'utf8'))
        .join('\n;\n');

    // Les fichiers déclarent leurs objets/classes avec `const`/`class`, qui ne
    // deviennent pas des propriétés énumérables du contexte vm : on les republie
    // explicitement à la fin du script combiné pour pouvoir y accéder depuis Node.
    const republierGlobals = `
        ;globalThis.Config = Config;
        globalThis.Aleatoire = Aleatoire;
        globalThis.Carte = Carte;
        globalThis.Ennemi = Ennemi;
        globalThis.Vagues = Vagues;
        globalThis.Tour = Tour;
        globalThis.Projectile = Projectile;
        globalThis.Progression = Progression;
    `;

    new vm.Script(sourceConcatenee + '\n' + republierGlobals, { filename: 'defense-neon-concatene.js' })
        .runInContext(sandbox);

    return sandbox;
}

// Cherche, dans Carte.grille, la case constructible la plus proche (distance
// euclidienne en cases) d'un point de référence donné, en excluant les cases déjà
// utilisées par cette simulation.
function trouverEmplacementLibrePlusProche(Carte, referenceColonne, referenceLigne, emplacementsExclus) {
    let meilleur = null;
    let meilleureDistance = Infinity;

    for (let ligne = 0; ligne < Carte.grille.length; ligne++) {
        for (let colonne = 0; colonne < Carte.grille[ligne].length; colonne++) {
            if (!Carte.estConstructible(colonne, ligne)) continue;
            if (emplacementsExclus.has(`${colonne},${ligne}`)) continue;

            const distance = Math.hypot(colonne - referenceColonne, ligne - referenceLigne);
            if (distance < meilleureDistance) {
                meilleureDistance = distance;
                meilleur = { colonne, ligne };
            }
        }
    }

    return meilleur;
}

// Emplacement libre le plus proche d'un point du chemin situé à `fraction` de son
// parcours (0 = départ, 1 = arrivée) : sert à répartir les tours de la stratégie B le
// long du chemin plutôt que de les entasser près de l'entrée. Se repère uniquement sur
// le premier chemin (Carte.chemins[0]) depuis la phase 6A (chemins multiples) : ce
// script compare des stratégies de construction sur UN chemin de référence, pas de
// notion de plusieurs chemins simultanés — cohérent avec le fait que ses résultats
// sont de toute façon marqués obsolètes en attendant le round de mesure de la phase 6B.
function emplacementReparti(Carte, fraction, emplacementsExclus) {
    const chemin = Carte.chemins[0].chemin;
    const index = Math.min(chemin.length - 1, Math.round(fraction * (chemin.length - 1)));
    const repere = chemin[index];
    return trouverEmplacementLibrePlusProche(Carte, repere.colonne, repere.ligne, emplacementsExclus);
}

// Coût réel de construction d'un type de tour, réduction permanente du joueur
// comprise (phase 3B, Progression.multiplicateurCoutConstruction — 1 tant qu'aucun
// palier de réduction n'est débloqué, donc sans effet dans la plupart des essais de
// ce script). Même calcul que Interface.coutConstruction dans le vrai jeu.
function coutConstruction(jeuContext, type) {
    const { Config, Progression } = jeuContext;
    return Math.round(Config.TYPES_TOURS[type].cout * Progression.multiplicateurCoutConstruction());
}

function construireTour(jeuContext, etat, memoire, type, emplacement) {
    const { Carte, Tour } = jeuContext;

    const tour = new Tour(emplacement.colonne, emplacement.ligne, type);
    etat.toursActives.push(tour);
    Carte.grille[emplacement.ligne][emplacement.colonne] = 'OCCUPEE';

    memoire.tours.push(tour);
    memoire.emplacementsUtilises.add(`${emplacement.colonne},${emplacement.ligne}`);
}

// Stratégie A — Tour unique : un Canon sur la case libre la plus proche de l'entrée
// du chemin, jamais remplacé ni complété par une autre tour ; tous les crédits
// disponibles partent ensuite dans son amélioration, dès que le palier suivant est
// atteint.
function jouerStrategieTourUnique(jeuContext, etat, memoire) {
    const { Carte } = jeuContext;
    let progres = true;

    while (progres) {
        progres = false;

        if (memoire.tours.length === 0) {
            const cout = coutConstruction(jeuContext, 'canon');
            if (etat.credits >= cout) {
                const emplacement = trouverEmplacementLibrePlusProche(
                    Carte, Carte.chemins[0].caseDepart.colonne, Carte.chemins[0].caseDepart.ligne, memoire.emplacementsUtilises
                );
                if (emplacement) {
                    construireTour(jeuContext, etat, memoire, 'canon', emplacement);
                    etat.credits -= cout;
                    progres = true;
                }
            }
            continue;
        }

        const tour = memoire.tours[0];
        const coutAmelioration = tour.coutAmelioration();
        if (coutAmelioration !== null && etat.credits >= coutAmelioration) {
            etat.credits -= coutAmelioration;
            tour.ameliorer();
            progres = true;
        }
    }
}

const ORDRE_TYPES_STRATEGIE_DIVERSIFIEE = ['mitrailleuse', 'canon', 'sniper'];
// Positions relatives le long du chemin (0 = entrée, 1 = sortie) pour répartir les
// trois tours plutôt que de les regrouper au même endroit.
const FRACTIONS_EMPLACEMENT_STRATEGIE_DIVERSIFIEE = [0.15, 0.5, 0.85];

// Répartit les améliorations plutôt que de tout mettre sur une seule tour : celle du
// niveau actuel le plus bas est prioritaire (à égalité, la première construite).
// Renvoie null si toutes les tours sont déjà au niveau maximum.
function choisirTourAAmeliorer(Config, tours) {
    let meilleure = null;
    for (const tour of tours) {
        if (tour.niveau >= Config.NIVEAU_MAX_TOUR) continue;
        if (!meilleure || tour.niveau < meilleure.niveau) meilleure = tour;
    }
    return meilleure;
}

// Stratégie B — Tours diversifiées : construit dans l'ordre une Mitrailleuse, un
// Canon puis un Sniper sur des emplacements distincts répartis le long du chemin.
// N'améliore une tour existante que lorsqu'aucune nouvelle tour n'est constructible
// avec les crédits actuels (les trois sont déjà posées, ou le prochain type de la
// liste coûte plus cher que les crédits disponibles).
function jouerStrategieDiversifiee(jeuContext, etat, memoire) {
    const { Config, Carte } = jeuContext;
    let progres = true;

    while (progres) {
        progres = false;

        const indexProchainType = memoire.tours.length;
        const construireEncorePossible = indexProchainType < ORDRE_TYPES_STRATEGIE_DIVERSIFIEE.length;

        if (construireEncorePossible) {
            const type = ORDRE_TYPES_STRATEGIE_DIVERSIFIEE[indexProchainType];
            const cout = coutConstruction(jeuContext, type);
            if (etat.credits >= cout) {
                const emplacement = emplacementReparti(
                    Carte,
                    FRACTIONS_EMPLACEMENT_STRATEGIE_DIVERSIFIEE[indexProchainType],
                    memoire.emplacementsUtilises
                );
                if (emplacement) {
                    construireTour(jeuContext, etat, memoire, type, emplacement);
                    etat.credits -= cout;
                    progres = true;
                    continue;
                }
            }
        }

        const tourAAmeliorer = choisirTourAAmeliorer(Config, memoire.tours);
        if (tourAAmeliorer) {
            const coutAmelioration = tourAAmeliorer.coutAmelioration();
            if (coutAmelioration !== null && etat.credits >= coutAmelioration) {
                etat.credits -= coutAmelioration;
                tourAAmeliorer.ameliorer();
                progres = true;
            }
        }
    }
}

// Fait avancer la simulation d'un pas dt : reprend exactement l'ordre de
// Jeu.simuler(dt) (déplacement des ennemis, tir des tours, vol des projectiles,
// nettoyage des ennemis arrivés/morts, mise à jour des vagues) — seules l'affichage
// et la vérification de victoire/défaite sont omis, sans objet ici.
function avancerSimulation(jeuContext, etat, dt) {
    const { Config, Vagues } = jeuContext;

    for (const ennemi of etat.ennemisActifs) {
        ennemi.deplacer(dt);
    }
    for (const tour of etat.toursActives) {
        tour.mettreAJour(dt, etat.ennemisActifs, etat.poolProjectiles);
    }
    for (const projectile of etat.poolProjectiles) {
        projectile.mettreAJour(dt);
    }

    for (let i = etat.ennemisActifs.length - 1; i >= 0; i--) {
        const ennemi = etat.ennemisActifs[i];
        if (ennemi.arrive) {
            // Contrairement à Jeu.simuler (qui plafonne à 0 et déclenche la défaite),
            // on laisse volontairement l'intégrité descendre sous zéro ici : les deux
            // stratégies s'avèrent chacune dépassées bien avant la vague 15 avec un
            // plafond à 0, ce qui masquerait tout écart entre elles (comparaison
            // « 0 contre 0 », sans intérêt). Une intégrité négative reste un score
            // comparatif valable — l'ampleur du dépassement — même s'il ne correspond
            // à aucun état atteignable dans une vraie partie (où la défaite arrêterait
            // la partie dès le premier passage à 0).
            etat.integrite -= Config.DEGATS_INTEGRITE_PAR_ENNEMI;
            etat.ennemisActifs.splice(i, 1);
        } else if (!ennemi.vivant) {
            etat.credits += ennemi.recompense;
            etat.ennemisActifs.splice(i, 1);
        }
    }

    Vagues.mettreAJour(dt, etat.ennemisActifs);
    if (Vagues.credits > 0) {
        etat.credits += Vagues.credits;
        Vagues.credits = 0;
    }
}

// Rejoue `nombreVagues` vagues avec la graine donnée en appliquant `jouerStrategie`
// après chaque pas de simulation (donc dès que les crédits le permettent, vérifié à
// chaque frame simulée). Chaque vague est lancée dès que la précédente est terminée
// (Vagues.enCours retombé à false), sans attente volontaire.
function executerSimulation(jeuContext, { graine, nombreVagues, dt, jouerStrategie }) {
    const { Config, Carte, Vagues, Jeu, Projectile, Progression } = jeuContext;

    Carte.generer(graine);
    // Échelle de référence (Config.LARGEUR_REFERENCE / Config.COLONNES = 40 px/case) :
    // Jeu.facteurEchelle vaut alors exactement 1, donc toutes les valeurs de Config
    // (portée, dégâts, vitesse...) s'appliquent sans conversion.
    Carte.tailleCase = 40;
    Carte.recalculerPixels();
    Jeu.facteurEchelle = 1;
    Vagues.reinitialiser();

    // Mêmes bonus permanents qu'en jeu réel (Jeu.reinitialiser, phase 3B) : sans
    // effet par défaut (Progression démarre à son état neutre, voir creerContexteJeu),
    // actifs seulement quand l'expérience 4 active explicitement un palier.
    const etat = {
        ennemisActifs: [],
        toursActives: [],
        poolProjectiles: Array.from({ length: Config.TAILLE_POOL_PROJECTILES }, () => new Projectile()),
        credits: Config.CREDITS_DEPART + Progression.bonusCreditsDepart(),
        integrite: Config.INTEGRITE_DEPART + Progression.bonusIntegriteDepart()
    };
    const memoire = { tours: [], emplacementsUtilises: new Set() };

    // Filet de sécurité anti-boucle infinie : chaque vague se termine forcément en
    // temps fini (tout ennemi non tué finit par arriver), ce plafond ne devrait donc
    // jamais être atteint en pratique.
    const DUREE_MAX_SECONDES = 6000;
    let tempsEcoule = 0;

    while (true) {
        if (!Vagues.enCours) {
            if (Vagues.numeroVagueActuelle >= nombreVagues && etat.ennemisActifs.length === 0) {
                break;
            }
            if (Vagues.numeroVagueActuelle < nombreVagues) {
                Vagues.demarrer(Vagues.numeroVagueActuelle + 1);
            }
        }

        avancerSimulation(jeuContext, etat, dt);
        jouerStrategie(jeuContext, etat, memoire);

        tempsEcoule += dt;
        if (tempsEcoule > DUREE_MAX_SECONDES) {
            throw new Error('Simulation trop longue : boucle probable dans le pilote headless.');
        }
    }

    return {
        integrite: etat.integrite,
        credits: etat.credits,
        tours: memoire.tours.map(tour => ({ type: tour.type, niveau: tour.niveau }))
    };
}

const NOMS_LISIBLES_TYPES = { mitrailleuse: 'Mitrailleuse', canon: 'Canon', sniper: 'Sniper' };

function formaterNiveaux(tours) {
    if (tours.length === 0) return '(aucune)';
    return tours.map(t => `${NOMS_LISIBLES_TYPES[t.type] || t.type} N${t.niveau}`).join(', ');
}

function executerComparaison(jeuContext, graine, nombreVagues, dt) {
    return {
        resultatA: executerSimulation(jeuContext, { graine, nombreVagues, dt, jouerStrategie: jouerStrategieTourUnique }),
        resultatB: executerSimulation(jeuContext, { graine, nombreVagues, dt, jouerStrategie: jouerStrategieDiversifiee })
    };
}

// Vagues auxquelles relever l'écart entre stratégies. 5 et 8 permettent de vérifier
// si l'avantage d'une tour unique perçu en tout début de partie (voir le résumé de la
// phase 2B : un Canon seul au niveau 3 encaissait très bien les 3 premières vagues) se
// confirme sur un horizon un peu plus long, avant de comparer à une partie complète
// (15) où l'écart s'était inversé en faveur de la diversification.
const HORIZONS_VAGUES = [5, 8, 15];

// Graines fixes pour l'expérience 1 (généralisation à plusieurs cartes) — reproductible
// d'une exécution à l'autre, comme la graine unique 12345 utilisée plus haut.
const GRAINES_GENERALISATION = [12345, 67890, 24680, 13579, 11111, 22222, 33333, 44444];

// Plafond de niveau utilisé par l'expérience 2, uniquement pour isoler l'effet du
// nombre de paliers disponibles (l'hypothèse à vérifier, pas une valeur envisagée pour
// le jeu réel).
const NIVEAU_MAX_DIAGNOSTIC = 8;

// Expérience 1 — Rejoue les deux stratégies sur chacune des graines, à la
// configuration actuelle (AMELIORATION_COUT_FACTEUR et NIVEAU_MAX_TOUR réels, non
// modifiés ici). Sert à vérifier que l'écart observé sur la seule graine 12345 se
// généralise à d'autres cartes plutôt que d'être un artefact d'une carte particulière.
function executerExperience1(jeuContext, graines, nombreVagues, dt) {
    return graines.map(graine => {
        const { resultatA, resultatB } = executerComparaison(jeuContext, graine, nombreVagues, dt);
        return {
            graine,
            integriteA: resultatA.integrite,
            integriteB: resultatB.integrite,
            ecart: resultatA.integrite - resultatB.integrite,
            creditsNonDepensesA: resultatA.credits
        };
    });
}

// Expérience 2 — Rejoue uniquement la stratégie A (tour unique), sur les mêmes
// graines, avec Config.NIVEAU_MAX_TOUR porté à NIVEAU_MAX_DIAGNOSTIC en mémoire (rien
// d'autre ne change : ni les multiplicateurs de statistiques par niveau, ni le facteur
// de coût des paliers — seulement le nombre de paliers disponibles). Compare à
// l'intégrité de A obtenue dans `resultatsExperience1` au plafond réel, pour isoler
// l'effet du seul plafond de niveau : si cette hypothèse est la bonne cause de l'écart
// de l'expérience 1, l'intégrité de A ici devrait s'en rapprocher nettement de celle
// de B (déjà connue via `resultatsExperience1`) ; si elle reste loin derrière, le
// plafond de niveau n'explique pas (ou pas seul) cet écart.
function executerExperience2(jeuContext, graines, nombreVagues, dt, resultatsExperience1) {
    const { Config } = jeuContext;
    const valeurOriginaleNiveauMax = Config.NIVEAU_MAX_TOUR;

    const lignes = graines.map((graine, index) => {
        Config.NIVEAU_MAX_TOUR = NIVEAU_MAX_DIAGNOSTIC;
        const resultat = executerSimulation(jeuContext, { graine, nombreVagues, dt, jouerStrategie: jouerStrategieTourUnique });
        Config.NIVEAU_MAX_TOUR = valeurOriginaleNiveauMax;

        const reference = resultatsExperience1[index];
        return {
            graine,
            integriteAPlafondActuel: reference.integriteA,
            integriteAPlafond8: resultat.integrite,
            integriteB: reference.integriteB,
            ecartPlafondActuel: reference.ecart,
            ecartPlafond8: resultat.integrite - reference.integriteB
        };
    });

    // Remise en l'état par sécurité (déjà fait après chaque essai ci-dessus) — jamais
    // écrit sur le disque de toute façon.
    Config.NIVEAU_MAX_TOUR = valeurOriginaleNiveauMax;

    return lignes;
}

// Plafonds intermédiaires à balayer pour l'expérience 3, entre les deux extrêmes déjà
// mesurés (3 dans l'expérience 1, 8 dans l'expérience 2).
const PLAFONDS_INTERMEDIAIRES = [4, 5, 6, 7];

// Expérience 3 — Pour chaque plafond de `plafonds`, rejoue les deux stratégies sur
// chacune des huit graines (Config.NIVEAU_MAX_TOUR modifié en mémoire pour la durée de
// chaque essai puis restauré) et résume l'écart obtenu (moyenne, min, max sur les huit
// graines). Sert à localiser, entre les deux extrêmes déjà écrasants, la zone où
// aucune des deux stratégies n'écrase nettement l'autre.
function executerExperience3(jeuContext, graines, nombreVagues, dt, plafonds) {
    const { Config } = jeuContext;
    const valeurOriginaleNiveauMax = Config.NIVEAU_MAX_TOUR;

    const resultats = plafonds.map(plafond => {
        const ecarts = graines.map(graine => {
            Config.NIVEAU_MAX_TOUR = plafond;
            const { resultatA, resultatB } = executerComparaison(jeuContext, graine, nombreVagues, dt);
            Config.NIVEAU_MAX_TOUR = valeurOriginaleNiveauMax;
            return resultatA.integrite - resultatB.integrite;
        });

        return {
            plafond,
            ecartMoyen: ecarts.reduce((somme, e) => somme + e, 0) / ecarts.length,
            ecartMin: Math.min(...ecarts),
            ecartMax: Math.max(...ecarts)
        };
    });

    Config.NIVEAU_MAX_TOUR = valeurOriginaleNiveauMax;

    return resultats;
}

// Multiplicateur théorique de dégâts par seconde à chaque niveau par rapport au
// niveau 1, indépendamment de toute simulation : combine (en les multipliant, puisque
// les deux se composent indépendamment sur le même exposant niveau - 1) le
// multiplicateur de dégâts et celui de cadence de Config. Ne dépend pas du type de
// tour : les trois types partagent les mêmes multiplicateurs par niveau, seules leurs
// valeurs de base diffèrent.
function calculerProgressionTheoriqueDPS(Config, niveauMax) {
    const lignes = [];
    for (let niveau = 1; niveau <= niveauMax; niveau++) {
        const multiplicateurDegats = Config.AMELIORATION_MULTIPLICATEUR_DEGATS ** (niveau - 1);
        const multiplicateurCadence = Config.AMELIORATION_MULTIPLICATEUR_CADENCE ** (niveau - 1);
        lignes.push({
            'Niveau': niveau,
            'Multiplicateur dégâts (vs N1)': Number(multiplicateurDegats.toFixed(3)),
            'Multiplicateur cadence (vs N1)': Number(multiplicateurCadence.toFixed(3)),
            'Multiplicateur DPS combiné (vs N1)': Number((multiplicateurDegats * multiplicateurCadence).toFixed(3))
        });
    }
    return lignes;
}

// Neutralise les six fonctions de Progression qui traduisent un palier en effet de
// jeu (voir Config.PALIERS_BONUS et progression.js) en les remplaçant par des
// versions qui renvoient toujours la valeur « aucun effet » (0 pour un bonus additif,
// 1 pour un multiplicateur neutre), quel que soit Progression.niveau. Renvoie une
// fonction de restauration à appeler une fois l'essai terminé. Sert de base à la
// fois à la référence sans bonus de l'expérience 4 et à activerUniquementPalier
// ci-dessous.
function neutraliserTousLesBonus(jeuContext) {
    const { Progression } = jeuContext;
    const original = {
        bonusCreditsDepart: Progression.bonusCreditsDepart,
        bonusIntegriteDepart: Progression.bonusIntegriteDepart,
        multiplicateurCoutConstruction: Progression.multiplicateurCoutConstruction,
        multiplicateurCoutAmelioration: Progression.multiplicateurCoutAmelioration,
        multiplicateurDegats: Progression.multiplicateurDegats
    };

    Progression.bonusCreditsDepart = () => 0;
    Progression.bonusIntegriteDepart = () => 0;
    Progression.multiplicateurCoutConstruction = () => 1;
    Progression.multiplicateurCoutAmelioration = () => 1;
    Progression.multiplicateurDegats = () => 1;

    return () => Object.assign(Progression, original);
}

// Neutralise tous les paliers puis réactive uniquement celui désigné par `id`, à sa
// valeur réelle de Config.PALIERS_BONUS (jamais recopiée en dur ici, pour rester
// juste si le palier change) — sert à mesurer l'effet de chaque palier isolément,
// plutôt que cumulé avec les paliers de niveau inférieur comme en jeu réel. Renvoie
// une fonction de restauration.
function activerUniquementPalier(jeuContext, id) {
    const { Progression } = jeuContext;
    const restaurer = neutraliserTousLesBonus(jeuContext);
    const valeur = Progression.palier(id).valeur;

    if (id === 'credits_depart') Progression.bonusCreditsDepart = () => valeur;
    if (id === 'integrite_bonus') Progression.bonusIntegriteDepart = () => valeur;
    if (id === 'reduction_construction') Progression.multiplicateurCoutConstruction = () => 1 - valeur;
    if (id === 'reduction_amelioration') Progression.multiplicateurCoutAmelioration = () => 1 - valeur;
    if (id === 'bonus_degats') Progression.multiplicateurDegats = () => 1 + valeur;

    return restaurer;
}

// Expérience 4 — Pour chaque palier de Config.PALIERS_BONUS, rejoue les deux
// stratégies sur les huit graines avec ce seul palier actif (les quatre autres
// neutralisés, voir activerUniquementPalier) et calcule le gain d'intégrité par
// rapport à une référence totalement sans bonus (neutraliserTousLesBonus) — plutôt
// que par rapport au niveau 1 réel, ce qui mélangerait l'effet propre à chaque palier
// avec ceux, déjà actifs à ce niveau-là, des paliers de niveau inférieur. Ce calcul
// isolé permet de comparer les cinq paliers entre eux à armes égales.
function executerExperience4(jeuContext, graines, nombreVagues, dt) {
    const { Progression } = jeuContext;

    const restaurerReference = neutraliserTousLesBonus(jeuContext);
    const reference = graines.map(graine => executerComparaison(jeuContext, graine, nombreVagues, dt));
    restaurerReference();

    return Progression.listePaliers().map(({ id, description }) => {
        const restaurer = activerUniquementPalier(jeuContext, id);
        const gainsA = [];
        const gainsB = [];

        graines.forEach((graine, index) => {
            const { resultatA, resultatB } = executerComparaison(jeuContext, graine, nombreVagues, dt);
            gainsA.push(resultatA.integrite - reference[index].resultatA.integrite);
            gainsB.push(resultatB.integrite - reference[index].resultatB.integrite);
        });

        restaurer();

        const moyenne = tableau => tableau.reduce((somme, v) => somme + v, 0) / tableau.length;

        return {
            id,
            description,
            gainMoyenA: moyenne(gainsA),
            gainMoyenB: moyenne(gainsB)
        };
    });
}

function main() {
    const jeuContext = creerContexteJeu();
    const { Config } = jeuContext;

    const GRAINE = 12345;
    const DT = 1 / 60; // pas fixe ~60 Hz, sous le plafond Config.DT_MAXIMUM du vrai jeu

    const valeurOriginaleFacteur = Config.AMELIORATION_COUT_FACTEUR;

    console.log('');
    console.log(`=== Comparaison des stratégies par horizon (AMELIORATION_COUT_FACTEUR = ${valeurOriginaleFacteur}, graine ${GRAINE}) ===`);
    console.log('');

    const lignesDetail = [];
    const lignesEcart = [];

    for (const horizon of HORIZONS_VAGUES) {
        const { resultatA, resultatB } = executerComparaison(jeuContext, GRAINE, horizon, DT);

        lignesDetail.push({
            'Vague': horizon,
            'Stratégie': 'A — Tour unique (Canon)',
            'Intégrité restante': resultatA.integrite,
            'Crédits non dépensés': resultatA.credits,
            'Tours construites': resultatA.tours.length,
            'Niveaux des tours': formaterNiveaux(resultatA.tours)
        });
        lignesDetail.push({
            'Vague': horizon,
            'Stratégie': 'B — Tours diversifiées',
            'Intégrité restante': resultatB.integrite,
            'Crédits non dépensés': resultatB.credits,
            'Tours construites': resultatB.tours.length,
            'Niveaux des tours': formaterNiveaux(resultatB.tours)
        });

        lignesEcart.push({
            'Vague': horizon,
            'Intégrité A (tour unique)': resultatA.integrite,
            'Intégrité B (diversifiée)': resultatB.integrite,
            'Écart (A - B)': resultatA.integrite - resultatB.integrite
        });
    }

    console.table(lignesDetail);

    console.log('');
    console.log('--- Écart d\'intégrité (A - B) par horizon : positif = avantage à la tour unique ---');
    console.log('');
    console.table(lignesEcart);

    console.log('');
    console.log(`=== Variation de AMELIORATION_COUT_FACTEUR (graine ${GRAINE}, ${HORIZONS_VAGUES[HORIZONS_VAGUES.length - 1]} vagues) ===`);
    console.log('');

    const NOMBRE_VAGUES_VARIATION = HORIZONS_VAGUES[HORIZONS_VAGUES.length - 1];
    const VALEURS_FACTEUR = [0.75, 0.85, 0.9, 1.0];
    const lignesVariation = VALEURS_FACTEUR.map(valeur => {
        // Variation en mémoire uniquement : js/config.js n'est jamais réécrit.
        Config.AMELIORATION_COUT_FACTEUR = valeur;
        const { resultatA: a, resultatB: b } = executerComparaison(jeuContext, GRAINE, NOMBRE_VAGUES_VARIATION, DT);
        return {
            'AMELIORATION_COUT_FACTEUR': valeur,
            'Intégrité A (tour unique)': a.integrite,
            'Intégrité B (diversifiée)': b.integrite,
            'Écart (A - B)': a.integrite - b.integrite
        };
    });

    console.table(lignesVariation);

    // Remise en l'état pour rester propre en mémoire — js/config.js sur le disque
    // n'a de toute façon jamais été modifié par ce script.
    Config.AMELIORATION_COUT_FACTEUR = valeurOriginaleFacteur;

    // --- Round 2 : généralisation à plusieurs cartes, puis isolation de la cause ---
    // (le plafond de niveau, Config.NIVEAU_MAX_TOUR, plutôt que le facteur de coût
    // déjà écarté ci-dessus). Limité à la vague 15, l'horizon où l'effet était le
    // plus net dans le premier round.
    const NOMBRE_VAGUES_ROUND_2 = HORIZONS_VAGUES[HORIZONS_VAGUES.length - 1];

    console.log('');
    console.log(`=== Expérience 1 — Généralisation à ${GRAINES_GENERALISATION.length} cartes (configuration actuelle, ${NOMBRE_VAGUES_ROUND_2} vagues) ===`);
    console.log('');

    const resultatsExperience1 = executerExperience1(jeuContext, GRAINES_GENERALISATION, NOMBRE_VAGUES_ROUND_2, DT);

    console.table(resultatsExperience1.map(ligne => ({
        'Graine': ligne.graine,
        'Intégrité A (tour unique)': ligne.integriteA,
        'Intégrité B (diversifiée)': ligne.integriteB,
        'Écart (A - B)': ligne.ecart,
        'Crédits non dépensés (A)': ligne.creditsNonDepensesA
    })));

    const nombreGrainesBEnAvanceOuEgal = resultatsExperience1.filter(ligne => ligne.ecart <= 0).length;
    const ecartMoyen = resultatsExperience1.reduce((somme, ligne) => somme + ligne.ecart, 0) / resultatsExperience1.length;

    console.log('');
    console.log(
        `Synthèse : B est à égalité ou en avance sur A pour ${nombreGrainesBEnAvanceOuEgal}/${resultatsExperience1.length} graines. ` +
        `Écart moyen (A - B) sur les ${resultatsExperience1.length} graines : ${ecartMoyen.toFixed(1)}.`
    );

    console.log('');
    console.log(
        `=== Expérience 2 — Stratégie A avec NIVEAU_MAX_TOUR porté à ${NIVEAU_MAX_DIAGNOSTIC} ` +
        `(diagnostic uniquement, mêmes ${GRAINES_GENERALISATION.length} graines, ${NOMBRE_VAGUES_ROUND_2} vagues) ===`
    );
    console.log('');

    const resultatsExperience2 = executerExperience2(jeuContext, GRAINES_GENERALISATION, NOMBRE_VAGUES_ROUND_2, DT, resultatsExperience1);

    console.table(resultatsExperience2.map(ligne => ({
        'Graine': ligne.graine,
        'Intégrité A (plafond actuel)': ligne.integriteAPlafondActuel,
        [`Intégrité A (plafond ${NIVEAU_MAX_DIAGNOSTIC})`]: ligne.integriteAPlafond8,
        'Intégrité B (référence)': ligne.integriteB,
        'Écart plafond actuel (A - B)': ligne.ecartPlafondActuel,
        [`Écart plafond ${NIVEAU_MAX_DIAGNOSTIC} (A - B)`]: ligne.ecartPlafond8
    })));

    const ecartMoyenPlafondActuel = resultatsExperience2.reduce((somme, l) => somme + l.ecartPlafondActuel, 0) / resultatsExperience2.length;
    const ecartMoyenPlafond8 = resultatsExperience2.reduce((somme, l) => somme + l.ecartPlafond8, 0) / resultatsExperience2.length;
    const reductionMoyennePourcent = 100 * (1 - Math.abs(ecartMoyenPlafond8) / Math.abs(ecartMoyenPlafondActuel));

    console.log('');
    console.log(
        `Synthèse : écart moyen (A - B) au plafond actuel = ${ecartMoyenPlafondActuel.toFixed(1)} ; ` +
        `au plafond ${NIVEAU_MAX_DIAGNOSTIC} = ${ecartMoyenPlafond8.toFixed(1)} ` +
        `(réduction moyenne de l'écart : ${reductionMoyennePourcent.toFixed(0)} %).`
    );

    // --- Round 3 : balayage des plafonds intermédiaires, entre les deux extrêmes déjà
    // mesurés lors des tout premiers essais (3 : écart moyen -210,6 ; 8 : écart moyen
    // +24,6 — avec NIVEAU_MAX_TOUR encore à sa valeur d'origine de 3 sur le disque à
    // l'époque ; ces deux plafonds sont recalculés explicitement plus bas, pas
    // supposés correspondre à la configuration actuelle) ---

    console.log('');
    console.log(
        `=== Expérience 3 — Balayage de NIVEAU_MAX_TOUR sur ${PLAFONDS_INTERMEDIAIRES.join(', ')} ` +
        `(mêmes ${GRAINES_GENERALISATION.length} graines, ${NOMBRE_VAGUES_ROUND_2} vagues) ===`
    );
    console.log('');

    const resultatsExperience3 = executerExperience3(jeuContext, GRAINES_GENERALISATION, NOMBRE_VAGUES_ROUND_2, DT, PLAFONDS_INTERMEDIAIRES);

    console.table(resultatsExperience3.map(ligne => ({
        'NIVEAU_MAX_TOUR': ligne.plafond,
        'Écart moyen (A - B)': Number(ligne.ecartMoyen.toFixed(1)),
        'Écart minimum (A - B)': ligne.ecartMin,
        'Écart maximum (A - B)': ligne.ecartMax
    })));

    console.log('');
    console.log('=== Tableau consolidé — Écart moyen (A - B) par plafond, 3 à 8 (mêmes 8 graines, 15 vagues) ===');
    console.log('');

    // 8 est déjà correct sans relancer (Expérience 2 fixe explicitement
    // Config.NIVEAU_MAX_TOUR à NIVEAU_MAX_DIAGNOSTIC pour chaque essai, quelle que
    // soit sa valeur réelle sur le disque). 3, en revanche, ne peut plus être
    // récupéré depuis Expérience 1 : celle-ci teste la « configuration actuelle »,
    // qui valait 3 lors des tout premiers essais mais vaut désormais 7 sur le disque
    // (NIVEAU_MAX_TOUR ayant depuis été ajusté définitivement, voir config.js) —
    // réutiliser `ecartMoyen` ici afficherait donc les résultats du plafond réel sous
    // l'étiquette « 3 ». On le recalcule à la place explicitement, comme les plafonds
    // intermédiaires de l'expérience 3.
    const resultatPlafond3 = executerExperience3(jeuContext, GRAINES_GENERALISATION, NOMBRE_VAGUES_ROUND_2, DT, [3])[0];

    const consolide = [
        { plafond: 3, ecartMoyen: resultatPlafond3.ecartMoyen },
        ...resultatsExperience3.map(ligne => ({ plafond: ligne.plafond, ecartMoyen: ligne.ecartMoyen })),
        { plafond: NIVEAU_MAX_DIAGNOSTIC, ecartMoyen: ecartMoyenPlafond8 }
    ];

    console.table(consolide.map(ligne => ({
        'NIVEAU_MAX_TOUR': ligne.plafond,
        'Écart moyen (A - B)': Number(ligne.ecartMoyen.toFixed(1))
    })));

    console.log('');
    console.log('--- Complément analytique : multiplicateur théorique de DPS par niveau (dégâts x cadence, indépendant des simulations) ---');
    console.log('');
    console.table(calculerProgressionTheoriqueDPS(Config, NIVEAU_MAX_DIAGNOSTIC));

    // --- Round 4 : effet isolé de chaque palier de bonus permanent (phase 3B) ---
    // Un seul palier actif à la fois (les quatre autres neutralisés), comparé à une
    // référence totalement sans bonus, pour juger les cinq à armes égales plutôt que
    // cumulés comme en jeu réel.

    console.log('');
    console.log(
        `=== Expérience 4 — Effet isolé de chaque palier de bonus (mêmes ${GRAINES_GENERALISATION.length} graines, ${NOMBRE_VAGUES_ROUND_2} vagues) ===`
    );
    console.log('');

    const resultatsExperience4 = executerExperience4(jeuContext, GRAINES_GENERALISATION, NOMBRE_VAGUES_ROUND_2, DT);

    console.table(resultatsExperience4.map(ligne => ({
        'Palier': ligne.description,
        'Gain moyen intégrité — Stratégie A': Number(ligne.gainMoyenA.toFixed(1)),
        'Gain moyen intégrité — Stratégie B': Number(ligne.gainMoyenB.toFixed(1))
    })));

    console.log('');
    console.log('Rappel : ce script ne modifie jamais js/config.js sur le disque ; AMELIORATION_COUT_FACTEUR,');
    console.log('NIVEAU_MAX_TOUR et les fonctions de Progression (expérience 4) n\'ont été changés qu\'en mémoire,');
    console.log('pour la durée de ce process (et de chaque essai).');
    console.log('');
}

main();
