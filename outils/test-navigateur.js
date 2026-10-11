// test-navigateur.js — Joue une partie dans un vrai navigateur (Chromium, piloté par
// Playwright) et vérifie que tout se passe bien : chargement sans erreur, construction
// de tours par de vrais clics, raccourcis clavier, choix de la cible, appel anticipé
// d'une vague, sauvegarde puis reprise après rechargement de la page, effets des
// nouveaux ennemis et de la tour Gel, écran de fin avec ses statistiques, partage du
// défi du jour, réglages du son, et affichage sur téléphone.
//
// Lancé automatiquement par GitHub à chaque envoi de modifications (voir
// .github/workflows/verifications.yml). En local :
//   npm install --no-save playwright
//   npx playwright install chromium
//   node outils/test-navigateur.js
// Le script démarre lui-même le petit serveur local (serveur-statique.js) et l'arrête
// à la fin. Code de sortie 1 si une vérification échoue.

'use strict';

const { spawn } = require('child_process');
const path = require('path');
const { chromium } = require('playwright');

const RACINE = path.join(__dirname, '..');
const PORT = 8937;
const ADRESSE = `http://localhost:${PORT}/`;

const resultats = [];
function verifier(nom, condition, detail = '') {
    resultats.push({ nom, ok: !!condition });
    console.log(`${condition ? '✔' : '✘'} ${nom}${detail ? ` — ${detail}` : ''}`);
}

// Clique au centre d'une case du plateau, comme le ferait un joueur.
async function cliquerCase(page, colonne, ligne) {
    const boite = await page.locator('#canvas-jeu').boundingBox();
    const taille = boite.width / 20;
    await page.mouse.click(boite.x + (colonne + 0.5) * taille, boite.y + (ligne + 0.5) * taille);
}

// Cases où une tour peut être construite (lecture de l'état du jeu, pour savoir où
// cliquer).
function casesAutorisees(page) {
    return page.evaluate(() => {
        const liste = [];
        for (let l = 0; l < Config.LIGNES; l++) {
            for (let c = 0; c < Config.COLONNES; c++) {
                if (Carte.estConstructible(c, l) && Carte.estAdjacentAUnChemin(c, l)
                    && Carte.candidatsBlocagePourCaserne(c, l).length > 0) {
                    liste.push({ c, l });
                }
            }
        }
        return liste;
    });
}

async function testerPartie(navigateur) {
    const contexte = await navigateur.newContext({ viewport: { width: 1280, height: 900 } });
    await contexte.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ADRESSE });
    const page = await contexte.newPage();
    const erreurs = [];
    page.on('pageerror', e => erreurs.push(e.message));
    page.on('console', m => { if (m.type() === 'error') erreurs.push(m.text()); });

    await page.goto(ADRESSE);
    await page.waitForTimeout(500);
    verifier('Écran d\'accueil affiché', await page.isVisible('#ecran-accueil'));
    verifier('Pas de partie à reprendre au premier lancement', !(await page.isVisible('#bouton-reprendre')));

    // Réglages du son, avant même de jouer.
    await page.locator('#curseur-volume').fill('40');
    verifier('Curseur de volume', await page.evaluate(() => Son.volume === 0.4
        && localStorage.getItem('defense-neon-volume') === '0.4'));
    await page.click('#bouton-musique');
    verifier('Bouton Musique', (await page.textContent('#bouton-musique')) === 'Musique : OFF');
    await page.click('#bouton-musique');

    await page.click('#bouton-jouer');
    await page.waitForTimeout(200);
    verifier('Partie démarrée', await page.isVisible('#barre-hud'));
    verifier('Fiche de la tour sélectionnée', (await page.innerText('#fiche-tour')).startsWith('Mitrailleuse — 40 crédits'));
    await page.hover('#barre-types-tours button[data-type-tour="flak"]');
    verifier('Fiche au survol', (await page.innerText('#fiche-tour')).includes('drones'));
    verifier('Aperçu de la vague 1', (await page.textContent('#prochaine-vague')) === 'À venir — vague 1 : 7 ennemis');

    // Construction par de vrais clics : un type choisi au clavier, puis une case.
    const cases = await casesAutorisees(page);
    await page.mouse.move(0, 0);
    await page.keyboard.press('2');
    verifier('Touche 2 : Canon sélectionné', await page.evaluate(() => Interface.typeSelectionne === 'canon'));
    await cliquerCase(page, cases[0].c, cases[0].l);
    await page.keyboard.press('1');
    await cliquerCase(page, cases[8].c, cases[8].l);
    const apresConstruction = await page.evaluate(() => ({ tours: Jeu.toursActives.length, credits: Jeu.credits }));
    verifier('Deux tours construites par clic', apresConstruction.tours === 2 && apresConstruction.credits === 150 - 70 - 40,
        JSON.stringify(apresConstruction));

    // Panneau d'une tour : choix de la cible au bouton, puis à la touche C.
    await cliquerCase(page, cases[0].c, cases[0].l);
    await page.waitForTimeout(100);
    verifier('Panneau ouvert sur la tour cliquée', await page.isVisible('#panneau-amelioration'));
    // Le libellé est réécrit à l'image suivante : on lui en laisse le temps.
    await page.click('#bouton-ciblage');
    await page.waitForTimeout(50);
    verifier('Bouton Cible', (await page.textContent('#bouton-ciblage')) === 'Cible : le plus résistant');
    await page.keyboard.press('c');
    await page.waitForTimeout(50);
    verifier('Touche C', (await page.textContent('#bouton-ciblage')) === 'Cible : le plus proche');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(50);
    verifier('Échap ferme le panneau', !(await page.isVisible('#panneau-amelioration')));

    // Pause et vitesse au clavier.
    await page.keyboard.press('p');
    const enPause = await page.evaluate(() => Jeu.enPause);
    await page.keyboard.press('p');
    await page.keyboard.press('v');
    verifier('Touches P et V', enPause && await page.evaluate(() => !Jeu.enPause && Jeu.vitesseJeu === 2));

    // Espace lance la vague 1, même quand un bouton a le focus (ici Pause) : il ne
    // doit pas être cliqué en plus.
    await page.focus('#bouton-pause');
    await page.keyboard.press('Space');
    await page.waitForTimeout(100);
    verifier('Espace lance la vague sans cliquer le bouton qui a le focus',
        await page.evaluate(() => Vagues.enCours && Vagues.numeroVagueActuelle === 1 && !Jeu.enPause));
    verifier('Musique en cours pendant la partie', await page.evaluate(() => Son.minuteurMusique !== null));

    // Appel anticipé dès que tous les ennemis de la vague 1 sont apparus.
    await page.waitForFunction(() => Vagues.peutAppelerEnAvance(), null, { timeout: 30000 });
    const avantAppel = await page.evaluate(() => ({
        credits: Jeu.credits,
        enJeu: Jeu.ennemisActifs.filter(e => e.vivant && !e.arrive).length,
        libelle: document.getElementById('bouton-lancer-vague').textContent
    }));
    await page.evaluate(() => { Jeu.enPause = true; });
    const enJeuAuClic = await page.evaluate(() => Jeu.ennemisActifs.filter(e => e.vivant && !e.arrive).length);
    await page.click('#bouton-lancer-vague');
    const apresAppel = await page.evaluate(() => ({
        credits: Jeu.credits, vague: Vagues.numeroVagueActuelle,
        message: document.getElementById('message-construction').textContent
    }));
    await page.evaluate(() => { Jeu.enPause = false; });
    verifier('Bouton « Appeler la vague » avec le bonus', avantAppel.libelle.startsWith('Appeler la vague (+'), avantAppel.libelle);
    const attendu = 20 + 1 * 5 + enJeuAuClic * 3;
    verifier('Appel anticipé : vague 2 lancée et récompense + bonus versés',
        apresAppel.vague === 2 && apresAppel.credits >= avantAppel.credits + attendu - 30
            && apresAppel.message.startsWith('Vague appelée en avance'),
        `${enJeuAuClic} ennemis en jeu, ${JSON.stringify(apresAppel)}`);

    // Fin de la vague 2 : la partie est sauvegardée entre deux vagues.
    await page.waitForFunction(() => !Vagues.enCours && Jeu.ennemisActifs.length === 0 || Jeu.etatPartie !== 'enCours',
        null, { timeout: 120000 });
    const etatSauve = await page.evaluate(() => ({
        sauvegarde: JSON.parse(localStorage.getItem('defense-neon-partie-en-cours')),
        credits: Jeu.credits, integrite: Jeu.integrite, tours: Jeu.toursActives.length,
        modes: Jeu.toursActives.map(t => t.modeCiblage)
    }));
    verifier('Partie sauvegardée en fin de vague',
        etatSauve.sauvegarde && etatSauve.sauvegarde.numeroVague === 2 && etatSauve.sauvegarde.credits === etatSauve.credits);

    // Rechargement de la page puis reprise.
    await page.reload();
    await page.waitForTimeout(400);
    const libelleReprise = await page.textContent('#bouton-reprendre');
    verifier('Bouton « Reprendre » après rechargement', await page.isVisible('#bouton-reprendre')
        && libelleReprise === 'Reprendre la partie (Standard, vague 3)', libelleReprise);
    await page.click('#bouton-reprendre');
    await page.waitForTimeout(200);
    const etatRepris = await page.evaluate(() => ({
        credits: Jeu.credits, integrite: Jeu.integrite, tours: Jeu.toursActives.length,
        modes: Jeu.toursActives.map(t => t.modeCiblage), vague: Vagues.numeroVagueActuelle, etat: Jeu.etatPartie
    }));
    verifier('Partie reprise à l\'identique', etatRepris.etat === 'enCours' && etatRepris.vague === 2
        && etatRepris.credits === etatSauve.credits && etatRepris.integrite === etatSauve.integrite
        && etatRepris.tours === etatSauve.tours && etatRepris.modes.join() === etatSauve.modes.join(),
        JSON.stringify(etatRepris));
    verifier('Aperçu de la vague 3', (await page.textContent('#prochaine-vague')).includes('nouveau : Rapide'));

    // Annonce d'un nouvel ennemi au lancement de la vague 3 (les Rapides).
    await page.click('#bouton-lancer-vague');
    verifier('Annonce d\'un nouvel ennemi',
        (await page.textContent('#message-construction')).startsWith('⚠ NOUVEL ENNEMI : Rapide'));

    // Effets des nouveautés, mesurés directement sur les objets du jeu.
    const effets = await page.evaluate(() => {
        const ennemis = [];
        const soigneur = new Ennemi('soigneur', 1, 0);
        const blesse = new Ennemi('standard', 1, 0);
        blesse.pointsDeVie = 50;
        ennemis.push(soigneur, blesse);
        Ennemi.appliquerSoins(ennemis, 1);

        const bouclier = new Ennemi('bouclier', 1, 0);
        const encaisse = bouclier.subirDegats(100);
        const pvApresTir = bouclier.pointsDeVie;
        // 10 s sans être touché : délai de recharge, puis recharge complète.
        for (let i = 0; i < 200; i++) bouclier.deplacer(0.05);

        const gel = Jeu.toursActives.find(t => t.typeDegats !== 'caserne');
        const tourGel = new Tour(gel.colonne, gel.ligne, 'gel');
        const cible = new Ennemi('standard', 1, 0);
        cible.x = tourGel.x + 10;
        cible.y = tourGel.y;
        const boss = new Ennemi('boss', 1, 0);
        boss.x = tourGel.x;
        boss.y = tourGel.y + 10;
        Tour.appliquerRalentissements([tourGel], [cible, boss]);
        return {
            soin: blesse.pointsDeVie, encaisse, pvApresTir, bouclier: bouclier.bouclier,
            ralentissement: cible.ralentissement, ralentissementBoss: boss.ralentissement
        };
    });
    verifier('Soigneur : soigne un voisin', effets.soin === 60, `PV 50 → ${effets.soin}`);
    verifier('Bouclier : absorbe les dégâts puis se recharge',
        effets.encaisse === 100 && effets.pvApresTir === 150 && effets.bouclier === 120, JSON.stringify(effets));
    verifier('Gel : ralentit (moitié moins le boss)',
        Math.abs(effets.ralentissement - 0.35) < 1e-9 && Math.abs(effets.ralentissementBoss - 0.175) < 1e-9);

    // Défaite forcée : écran de fin, statistiques, sauvegarde effacée.
    await page.evaluate(() => { Jeu.integrite = 0; });
    await page.waitForTimeout(200);
    const fin = await page.evaluate(() => ({
        defaite: !document.getElementById('ecran-defaite').hidden,
        lignes: [...document.querySelectorAll('#statistiques-defaite p')].map(p => p.textContent),
        barres: document.querySelectorAll('#statistiques-defaite .graphique-degats li').length,
        sauvegarde: localStorage.getItem('defense-neon-partie-en-cours'),
        partage: !document.getElementById('bouton-partager-defaite').hidden,
        musique: Son.minuteurMusique
    }));
    verifier('Écran de défaite avec statistiques', fin.defaite && fin.lignes[0].startsWith('Ennemis détruits') && fin.barres > 0,
        fin.lignes.join(' | '));
    verifier('Sauvegarde effacée à la fin de la partie', fin.sauvegarde === null);
    verifier('Pas de bouton de partage hors défi du jour', !fin.partage);
    verifier('Musique arrêtée sur l\'écran de fin', fin.musique === null);

    // Défi du jour : partage du score.
    await page.click('#ecran-defaite .bouton-changer-duree');
    await page.click('#bouton-defi-du-jour');
    await page.evaluate(() => { Vagues.numeroVagueActuelle = 4; Jeu.integrite = 0; });
    await page.waitForTimeout(200);
    verifier('Bouton de partage après un défi du jour', await page.isVisible('#bouton-partager-defaite'));
    await page.click('#bouton-partager-defaite');
    await page.waitForTimeout(200);
    const partage = await page.evaluate(async () => ({
        bouton: document.getElementById('bouton-partager-defaite').textContent,
        pressePapiers: await navigator.clipboard.readText()
    }));
    verifier('Score copié dans le presse-papiers',
        partage.bouton === 'Copié dans le presse-papiers !' && partage.pressePapiers.includes('vague 4'), partage.pressePapiers);

    verifier('Aucune erreur dans la console', erreurs.length === 0, erreurs.join(' | '));
    await contexte.close();
}

// Sur téléphone (portrait), le HUD, la barre des tours et la fiche restent à l'écran
// pendant la partie.
async function testerTelephone(navigateur) {
    const page = await navigateur.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await page.goto(ADRESSE);
    await page.waitForTimeout(400);
    await page.tap('#bouton-jouer');
    await page.waitForTimeout(200);
    const mesures = await page.evaluate(() => ({
        bas: Math.max(...['#barre-hud', '#barre-types-tours', '#fiche-tour']
            .map(s => document.querySelector(s).getBoundingClientRect().bottom)),
        hauteur: innerHeight,
        largeurPage: document.documentElement.scrollWidth,
        aideClavier: getComputedStyle(document.querySelector('.aide-clavier')).display
    }));
    verifier('Téléphone : HUD, tours et fiche visibles sans défiler', mesures.bas <= mesures.hauteur, JSON.stringify(mesures));
    verifier('Téléphone : pas de défilement horizontal', mesures.largeurPage <= 390);
    verifier('Téléphone : aide clavier masquée', mesures.aideClavier === 'none');
    await page.close();
}

(async () => {
    const serveur = spawn(process.execPath, [path.join(__dirname, 'serveur-statique.js'), RACINE, String(PORT)], { stdio: 'ignore' });
    let navigateur;
    try {
        await new Promise(resolve => setTimeout(resolve, 500));
        navigateur = await chromium.launch();
        await testerPartie(navigateur);
        await testerTelephone(navigateur);
    } catch (erreur) {
        verifier('Déroulement du test', false, erreur.stack);
    } finally {
        if (navigateur) await navigateur.close();
        serveur.kill();
    }

    const echecs = resultats.filter(r => !r.ok).length;
    console.log(`\n${resultats.length - echecs}/${resultats.length} vérifications réussies.`);
    process.exitCode = echecs > 0 ? 1 : 0;
})();
