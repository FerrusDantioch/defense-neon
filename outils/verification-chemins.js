// verification-chemins.js — Vérifie à grande échelle (500 graines par défaut) que la
// génération de carte à chemins multiples (phase 6A, voir Carte.generer dans
// js/carte.js — nombre de chemins par carte lui-même variable depuis le troisième
// chemin occasionnel, contenu additionnel post-lancement, voir Carte.nombreChemins)
// produit toujours des chemins structurellement valides.
//
// Adapté du script de vérification à graine utilisé lors du correctif de la phase 1A
// (adjacence orthogonale, bande LIGNE_MIN-LIGNE_MAX, chemin de secours) — ce script
// d'origine n'existait plus dans le dépôt au moment d'écrire celui-ci ; il est donc
// réécrit ici à neuf, avec la même méthode (vérification indépendante de la logique du
// jeu, pas une simple relecture de ce que le générateur affirme avoir produit), plutôt
// que retrouvé et adapté tel quel.
//
// Pour chaque chemin de chaque carte générée, vérifie indépendamment (sans réutiliser
// les fonctions de validation de carte.js, précisément pour ne pas se contenter de
// vérifier que le générateur est d'accord avec lui-même) :
//   - qu'il relie bien son entrée (colonne 0) à sa sortie (colonne COLONNES - 1) sans
//     interruption (deux cases consécutives toujours orthogonalement adjacentes) ;
//   - qu'il ne se touche jamais lui-même (aucune case orthogonalement adjacente à une
//     autre case du même chemin, hors la précédente/suivante immédiate) ;
//   - qu'il reste entièrement dans la bande LIGNE_MIN-LIGNE_MAX ;
//   - qu'aucune case n'apparaît deux fois dans le même chemin.
// Rapporte aussi, sans que ce soit un critère d'échec :
//   - la fréquence de déclenchement du chemin de secours (chemin en S) ;
//   - le pourcentage de cartes où les deux chemins partagent au moins une case
//     (un croisement réel) ;
//   - l'écart minimal observé entre entrées (et indépendamment, entre sorties) sur les
//     cartes où au moins deux entrées (ou deux sorties) ont pu être comparées.
// Vérifie enfin la reproductibilité : régénérer avec la même graine doit produire
// exactement les mêmes chemins.
//
// Usage :
//   node outils/verification-chemins.js [nombreDeGraines]

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DOSSIER_JS = path.join(__dirname, '..', 'js');
const FICHIERS_A_CHARGER = ['config.js', 'aleatoire.js', 'carte.js'];

function creerContexteCarte() {
    const sandbox = { console };
    vm.createContext(sandbox);

    const sourceConcatenee = FICHIERS_A_CHARGER
        .map(nomFichier => fs.readFileSync(path.join(DOSSIER_JS, nomFichier), 'utf8'))
        .join('\n;\n');

    const republierGlobals = `
        ;globalThis.Config = Config;
        globalThis.Aleatoire = Aleatoire;
        globalThis.Carte = Carte;
    `;

    new vm.Script(sourceConcatenee + '\n' + republierGlobals, { filename: 'defense-neon-carte-concatenee.js' })
        .runInContext(sandbox);

    return sandbox;
}

// Voisinage orthogonal, réimplémenté ici volontairement (voir la note en tête de
// fichier) plutôt que réutilisé depuis Carte.voisinesOrthogonales.
function sontAdjacentes(a, b) {
    return Math.abs(a.colonne - b.colonne) + Math.abs(a.ligne - b.ligne) === 1;
}

// Valide un chemin unique de façon entièrement indépendante de carte.js. Renvoie un
// tableau de messages d'erreur (vide si le chemin est valide).
function validerChemin(chemin, Config) {
    const erreurs = [];

    if (!Array.isArray(chemin) || chemin.length === 0) {
        return ['chemin vide ou absent'];
    }

    if (chemin[0].colonne !== 0) {
        erreurs.push(`ne part pas de la colonne 0 (colonne ${chemin[0].colonne})`);
    }
    if (chemin[chemin.length - 1].colonne !== Config.COLONNES - 1) {
        erreurs.push(`n'arrive pas à la dernière colonne (colonne ${chemin[chemin.length - 1].colonne})`);
    }

    for (const c of chemin) {
        if (c.ligne < Config.LIGNE_MIN || c.ligne > Config.LIGNE_MAX) {
            erreurs.push(`case (${c.colonne},${c.ligne}) hors bande LIGNE_MIN-LIGNE_MAX`);
        }
    }

    for (let i = 1; i < chemin.length; i++) {
        if (!sontAdjacentes(chemin[i - 1], chemin[i])) {
            erreurs.push(`rupture entre les cases d'index ${i - 1} et ${i} (non adjacentes)`);
        }
    }

    const vus = new Set();
    for (const c of chemin) {
        const cle = `${c.colonne},${c.ligne}`;
        if (vus.has(cle)) {
            erreurs.push(`case (${c.colonne},${c.ligne}) présente plusieurs fois dans le même chemin`);
        }
        vus.add(cle);
    }

    // Auto-contact : une case ne doit être orthogonalement adjacente à aucune autre
    // case du MÊME chemin, sauf son prédécesseur et son successeur immédiats.
    for (let i = 0; i < chemin.length; i++) {
        for (let j = i + 2; j < chemin.length; j++) {
            if (sontAdjacentes(chemin[i], chemin[j])) {
                erreurs.push(`le chemin se touche lui-même entre les index ${i} et ${j}`);
            }
        }
    }

    return erreurs;
}

function memeChemin(a, b) {
    if (a.length !== b.length) return false;
    return a.every((c, i) => c.colonne === b[i].colonne && c.ligne === b[i].ligne);
}

function executer(nombreDeGraines) {
    const { Config, Carte } = creerContexteCarte();

    let cartesEnErreur = 0;
    let cheminsSecoursDeclenches = 0;
    // Troisième chemin occasionnel (contenu additionnel post-lancement) : le nombre
    // de chemins n'est plus une constante fixe (Config.NOMBRE_CHEMINS, retirée) mais
    // varie par carte (Carte.nombreChemins, 2 la plupart du temps, 3
    // occasionnellement) — totalChemins est donc accumulé au fil de la boucle
    // ci-dessous plutôt que déduit d'un simple produit.
    let totalChemins = 0;
    let cartesATroisChemins = 0;
    let cartesAvecCroisement = 0;
    let cartesEchecReproductibilite = 0;

    const ecartsEntrees = [];
    const ecartsSorties = [];
    // Espacement toutes paires confondues (contenu additionnel post-lancement,
    // troisième chemin occasionnel) : contrairement aux deux tableaux ci-dessus
    // (bornés au chemin 0 et au chemin 1, conservés tels quels pour ne pas casser
    // la continuité de cette mesure historique), celui-ci couvre bien un éventuel
    // troisième chemin — la seule façon de vérifier le critère d'acceptation
    // « une carte à 3 chemins a bien 3 entrées et 3 sorties distinctes et
    // suffisamment espacées » plutôt que de le supposer.
    let cartesSousEspacementMinimal = 0;
    let pireEcartObserve = Infinity;

    // Le chemin de secours affiche un console.warn reconnaissable (voir
    // Carte.genererUnChemin) : on l'intercepte pour compter ses déclenchements sans
    // polluer la sortie du script sur 500 graines.
    const avertissementsOriginal = console.warn;
    console.warn = (message) => {
        if (typeof message === 'string' && message.includes('chemin de secours')) {
            cheminsSecoursDeclenches++;
        } else {
            avertissementsOriginal(message);
        }
    };

    for (let graine = 1; graine <= nombreDeGraines; graine++) {
        Carte.generer(graine);
        const chemins = Carte.chemins.map(info => info.chemin);
        totalChemins += chemins.length;
        if (Carte.nombreChemins === 3) cartesATroisChemins++;

        let carteValide = true;
        for (let index = 0; index < chemins.length; index++) {
            const erreurs = validerChemin(chemins[index], Config);
            if (erreurs.length > 0) {
                carteValide = false;
                console.error(`Graine ${graine}, chemin ${index} : ${erreurs.join(' ; ')}`);
            }
        }
        if (!carteValide) cartesEnErreur++;

        // Croisement réel : au moins une case commune entre les deux premiers chemins
        // (mesure purement informative). Depuis le troisième chemin occasionnel
        // (contenu additionnel post-lancement), une carte peut en compter 2 ou 3
        // (Carte.nombreChemins) — cette mesure reste volontairement bornée aux deux
        // premiers dans les deux cas, un troisième chemin éventuel n'y est pas pris
        // en compte, cohérent avec le fait qu'elle a toujours été un indicateur
        // informatif plutôt qu'un critère d'acceptation.
        if (chemins.length >= 2) {
            const casesPremierChemin = new Set(chemins[0].map(c => `${c.colonne},${c.ligne}`));
            const croisement = chemins[1].some(c => casesPremierChemin.has(`${c.colonne},${c.ligne}`));
            if (croisement) cartesAvecCroisement++;
        }

        // Écart entre entrées / sorties : purement informatif (voir la note en tête de
        // fichier), calculé entre le chemin 0 et le chemin 1 uniquement.
        if (chemins.length >= 2) {
            ecartsEntrees.push(Math.abs(chemins[0][0].ligne - chemins[1][0].ligne));
            ecartsSorties.push(Math.abs(
                chemins[0][chemins[0].length - 1].ligne - chemins[1][chemins[1].length - 1].ligne
            ));
        }

        // Espacement minimal toutes paires confondues (voir la note plus haut) :
        // couvre le troisième chemin d'une carte qui en compte 3, contrairement aux
        // deux mesures ci-dessus.
        const lignesEntrees = chemins.map(c => c[0].ligne);
        const lignesSorties = chemins.map(c => c[c.length - 1].ligne);
        let pireEcartCetteCarte = Infinity;
        for (let i = 0; i < chemins.length; i++) {
            for (let j = i + 1; j < chemins.length; j++) {
                pireEcartCetteCarte = Math.min(
                    pireEcartCetteCarte,
                    Math.abs(lignesEntrees[i] - lignesEntrees[j]),
                    Math.abs(lignesSorties[i] - lignesSorties[j])
                );
            }
        }
        if (pireEcartCetteCarte < Infinity) {
            pireEcartObserve = Math.min(pireEcartObserve, pireEcartCetteCarte);
            if (pireEcartCetteCarte < Config.ECART_MIN_ENTREES_SORTIES) {
                cartesSousEspacementMinimal++;
            }
        }

        // Reproductibilité : régénérer avec la même graine doit produire exactement
        // les mêmes chemins (critère d'acceptation n°7).
        Carte.generer(graine);
        const cheminsRegeneres = Carte.chemins.map(info => info.chemin);
        const reproductible = chemins.every((c, i) => memeChemin(c, cheminsRegeneres[i]));
        if (!reproductible) {
            cartesEchecReproductibilite++;
            console.error(`Graine ${graine} : régénération non reproductible.`);
        }
    }

    console.warn = avertissementsOriginal;

    const pourcentageSecours = (cheminsSecoursDeclenches / totalChemins) * 100;
    const pourcentageCroisement = (cartesAvecCroisement / nombreDeGraines) * 100;
    const pourcentageTroisChemins = (cartesATroisChemins / nombreDeGraines) * 100;

    console.log('');
    console.log(`Graines testées : ${nombreDeGraines}`);
    console.log(`Chemins générés au total : ${totalChemins} (2 ou 3 par carte, voir ci-dessous)`);
    console.log(`Cartes à 3 chemins (troisième chemin occasionnel) : ${cartesATroisChemins}/${nombreDeGraines} (${pourcentageTroisChemins.toFixed(1)} %, attendu ≈ ${(Config.PROBABILITE_TROISIEME_CHEMIN * 100).toFixed(0)} %)`);
    console.log(`Cartes en erreur (structure invalide) : ${cartesEnErreur}`);
    console.log(`Cartes non reproductibles à graine égale : ${cartesEchecReproductibilite}`);
    console.log(`Chemin de secours déclenché : ${cheminsSecoursDeclenches}/${totalChemins} (${pourcentageSecours.toFixed(2)} %)`);
    console.log('');
    console.log('--- Mesures informatives (ni succès ni échec) ---');
    console.log(`Cartes avec un croisement réel entre les deux premiers chemins : ${cartesAvecCroisement}/${nombreDeGraines} (${pourcentageCroisement.toFixed(1)} %)`);
    if (ecartsEntrees.length > 0) {
        const moyenne = (tableau) => tableau.reduce((s, v) => s + v, 0) / tableau.length;
        console.log(`Écart entre entrées (chemin 0 vs chemin 1 uniquement) — moyen : ${moyenne(ecartsEntrees).toFixed(2)} lignes, minimum observé : ${Math.min(...ecartsEntrees)}`);
        console.log(`Écart entre sorties (chemin 0 vs chemin 1 uniquement) — moyen : ${moyenne(ecartsSorties).toFixed(2)} lignes, minimum observé : ${Math.min(...ecartsSorties)}`);
    }
    console.log('');
    console.log(`Espacement minimal toutes paires confondues (entrées et sorties, 2 ou 3 chemins) — pire cas observé : ${pireEcartObserve} ligne(s) (seuil visé : ${Config.ECART_MIN_ENTREES_SORTIES})`);
    console.log(`Cartes sous ce seuil sur au moins une paire : ${cartesSousEspacementMinimal}/${nombreDeGraines} (${(cartesSousEspacementMinimal / nombreDeGraines * 100).toFixed(1)} %) — voir « Troisième chemin occasionnel » dans ARCHITECTURE.md pour la raison (configurations à 3 lignes rares où aucun espacement complet n'est mathématiquement atteignable dans la bande LIGNE_MIN-LIGNE_MAX).`);
    console.log('');

    const succes = cartesEnErreur === 0 && cartesEchecReproductibilite === 0;
    console.log(succes ? 'RÉSULTAT : toutes les cartes sont structurellement valides et reproductibles.'
                        : 'RÉSULTAT : des cartes invalides ou non reproductibles ont été détectées (voir ci-dessus).');

    process.exitCode = succes ? 0 : 1;
}

const nombreDeGraines = parseInt(process.argv[2], 10) || 500;
executer(nombreDeGraines);
