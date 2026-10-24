// son.js — Objet Son : tous les effets sonores du jeu, entièrement synthétisés via
// l'API Web Audio (OscillatorNode + GainNode), sans aucun fichier audio.
//
// Cycle de vie de l'AudioContext : les navigateurs bloquent toute lecture audio tant
// qu'aucune interaction utilisateur n'a eu lieu sur la page, pour éviter les sons
// intempestifs au chargement. L'AudioContext n'est donc jamais créé au chargement du
// script, mais à la demande par Son.initialiser(), appelée une seule fois au premier
// clic sur le bouton « Jouer » de l'écran d'accueil (voir interface.js) — tous les
// événements qui déclenchent un son (construction, tir, mort, arrivée d'un ennemi,
// victoire, défaite) ne peuvent survenir que pendant ou après une partie, donc
// toujours après ce premier clic : aucune fonction jouerXxx ci-dessous n'a besoin de
// vérifier que le contexte existe déjà.
//
// Son.actif (persisté dans localStorage sous Config.CLE_SAUVEGARDE_SON, avec la même
// protection try/catch que Progression face à un stockage indisponible) est vérifié en
// tout premier dans chaque fonction jouerXxx, avant de créer le moindre nœud audio :
// inutile de dépenser du calcul pour un son qu'on n'entendra pas.
//
// Volume et musique (octobre 2026) : tous les sons passent par un même nœud de gain,
// `gainGeneral`, réglé par le curseur de volume ; la musique d'ambiance passe d'abord
// par `gainMusique`, qui la garde en retrait des effets. La musique est elle aussi
// synthétisée : une grille de huit accords (MUSIQUE_ACCORDS ci-dessous) jouée en
// boucle par une basse, une nappe, un arpège et un charleston, planifiés un peu à
// l'avance sur l'horloge du contexte audio (voir planifierMusique).

// Grille d'accords de la musique, une mesure chacun, en numéros de note MIDI (69 = la
// à 440 Hz) : la mineur, fa, do, sol, la mineur, fa, sol, mi. `basse` est la
// fondamentale grave, `nappe` l'accord tenu, `arpege` les notes égrenées en croches.
const MUSIQUE_ACCORDS = [
    { basse: 45, nappe: [57, 60, 64], arpege: [69, 72, 76, 72] },
    { basse: 41, nappe: [57, 60, 65], arpege: [65, 69, 72, 69] },
    { basse: 48, nappe: [55, 60, 64], arpege: [67, 72, 76, 72] },
    { basse: 43, nappe: [55, 59, 62], arpege: [67, 71, 74, 71] },
    { basse: 45, nappe: [57, 60, 64], arpege: [69, 72, 76, 81] },
    { basse: 41, nappe: [57, 60, 65], arpege: [65, 69, 72, 77] },
    { basse: 43, nappe: [55, 59, 62], arpege: [67, 71, 74, 79] },
    { basse: 40, nappe: [56, 59, 64], arpege: [68, 71, 76, 71] }
];
// Pas (double-croches) de chaque mesure où joue la basse : un rythme syncopé.
const MUSIQUE_PAS_BASSE = [0, 3, 6, 8, 11, 14];

const Son = {
    actif: true,
    contexte: null,
    avertissementDejaAffiche: false,

    // Volume général (0 à 1) et musique activée, sauvegardés comme `actif`.
    volume: Config.SON_VOLUME_PAR_DEFAUT,
    musiqueActive: true,
    gainGeneral: null,
    gainMusique: null,
    // Musique en cours : minuteur de planification (null à l'arrêt), heure (horloge
    // audio) et numéro du prochain pas à jouer. `indexPas` n'est pas remis à zéro à
    // l'arrêt : la musique reprend là où elle s'était arrêtée après une pause.
    minuteurMusique: null,
    tempsProchainPas: 0,
    indexPas: 0,
    // Court bruit blanc pour le charleston, créé une seule fois.
    tamponBruit: null,

    // Lit la préférence sauvegardée. Appelée une seule fois, tôt dans
    // Jeu.initialiser() (comme Progression.charger()) : le bouton Son du HUD doit
    // afficher le bon libellé dès la première image, bien avant que l'AudioContext
    // lui-même ne soit créé.
    chargerPreference() {
        try {
            const valeur = localStorage.getItem(Config.CLE_SAUVEGARDE_SON);
            if (valeur !== null) {
                this.actif = valeur === 'true';
            }
            const volume = parseFloat(localStorage.getItem(Config.CLE_SAUVEGARDE_VOLUME));
            if (volume >= 0 && volume <= 1) {
                this.volume = volume;
            }
            const musique = localStorage.getItem(Config.CLE_SAUVEGARDE_MUSIQUE);
            if (musique !== null) {
                this.musiqueActive = musique === 'true';
            }
        } catch (erreur) {
            this.avertirEchecStockage(erreur);
        }
    },

    sauvegarderPreference() {
        try {
            localStorage.setItem(Config.CLE_SAUVEGARDE_SON, String(this.actif));
            localStorage.setItem(Config.CLE_SAUVEGARDE_VOLUME, String(this.volume));
            localStorage.setItem(Config.CLE_SAUVEGARDE_MUSIQUE, String(this.musiqueActive));
        } catch (erreur) {
            this.avertirEchecStockage(erreur);
        }
    },

    avertirEchecStockage(erreur) {
        if (this.avertissementDejaAffiche) return;
        this.avertissementDejaAffiche = true;
        console.warn(
            'Omni-Défense : localStorage indisponible (navigation privée ?), la préférence son ne sera pas sauvegardée pour cette session.',
            erreur
        );
    },

    basculer() {
        this.actif = !this.actif;
        this.sauvegarderPreference();
    },

    basculerMusique() {
        this.musiqueActive = !this.musiqueActive;
        this.sauvegarderPreference();
    },

    // `volume` entre 0 et 1. Appliqué en douceur (quelques centièmes de seconde) pour
    // éviter un claquement audible quand on déplace le curseur pendant un son.
    reglerVolume(volume) {
        this.volume = volume;
        if (this.gainGeneral) {
            this.gainGeneral.gain.setTargetAtTime(volume, this.contexte.currentTime, 0.02);
        }
        this.sauvegarderPreference();
    },

    // Crée l'AudioContext à la demande. Ne fait rien si elle a déjà été appelée : un
    // second appel (ex. une future partie démarrée depuis l'écran d'accueil) ne doit
    // jamais recréer de contexte.
    initialiser() {
        if (this.contexte) return;
        this.contexte = new (window.AudioContext || window.webkitAudioContext)();

        this.gainGeneral = this.contexte.createGain();
        this.gainGeneral.gain.value = this.volume;
        this.gainGeneral.connect(this.contexte.destination);

        this.gainMusique = this.contexte.createGain();
        this.gainMusique.gain.value = 0;
        this.gainMusique.connect(this.gainGeneral);
    },

    // Joue une tonalité unique : attaque quasi immédiate (montée exponentielle sur
    // 5 ms, pour éviter le clic audible d'une attaque instantanée à 0), puis
    // décroissance exponentielle du gain jusqu'à la fin de `duree`. Si `frequenceFin`
    // diffère de `frequenceDebut`, la fréquence glisse elle aussi exponentiellement
    // sur toute la durée (glissando montant ou descendant selon les fonctions
    // publiques ci-dessous). `delai` permet d'enchaîner plusieurs notes dans une même
    // séquence (voir jouerAmelioration, jouerVictoire) sans dépendre de setTimeout —
    // tout est planifié d'avance sur l'horloge du contexte audio, plus précis qu'un
    // minuteur JavaScript.
    jouerTonalite({ frequenceDebut, frequenceFin = frequenceDebut, duree, typeOnde = 'sine', delai = 0 }) {
        const debut = this.contexte.currentTime + delai;

        const oscillateur = this.contexte.createOscillator();
        oscillateur.type = typeOnde;
        oscillateur.frequency.setValueAtTime(frequenceDebut, debut);
        if (frequenceFin !== frequenceDebut) {
            oscillateur.frequency.exponentialRampToValueAtTime(Math.max(1, frequenceFin), debut + duree);
        }

        const gain = this.contexte.createGain();
        gain.gain.setValueAtTime(0.0001, debut);
        gain.gain.exponentialRampToValueAtTime(Config.SON_VOLUME_MAITRE, debut + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, debut + duree);

        oscillateur.connect(gain);
        gain.connect(this.gainGeneral);
        oscillateur.start(debut);
        oscillateur.stop(debut + duree + 0.02);
    },

    // Démarre ou arrête la musique selon `doitJouer` (partie en cours et pas en
    // pause), le bouton Son et le bouton Musique. Rappelée à chaque image par
    // Jeu.boucle : ne fait rien tant que rien ne change.
    mettreAJourMusique(doitJouer) {
        const jouer = doitJouer && this.actif && this.musiqueActive && this.contexte !== null;
        if (jouer && this.minuteurMusique === null) {
            this.demarrerMusique();
        } else if (!jouer && this.minuteurMusique !== null) {
            this.arreterMusique();
        }
    },

    demarrerMusique() {
        // Un navigateur mobile peut suspendre le contexte audio (appel entrant,
        // application en arrière-plan) : on le relance avant de jouer.
        if (this.contexte.state === 'suspended') {
            this.contexte.resume();
        }
        const maintenant = this.contexte.currentTime;
        this.gainMusique.gain.cancelScheduledValues(maintenant);
        this.gainMusique.gain.setValueAtTime(this.gainMusique.gain.value, maintenant);
        this.gainMusique.gain.linearRampToValueAtTime(Config.MUSIQUE_VOLUME, maintenant + 1);

        this.tempsProchainPas = maintenant + 0.05;
        this.planifierMusique();
        this.minuteurMusique = setInterval(() => this.planifierMusique(), 100);
    },

    // Fondu de sortie rapide : les quelques notes déjà planifiées s'éteignent avec lui.
    arreterMusique() {
        clearInterval(this.minuteurMusique);
        this.minuteurMusique = null;
        const maintenant = this.contexte.currentTime;
        this.gainMusique.gain.cancelScheduledValues(maintenant);
        this.gainMusique.gain.setValueAtTime(this.gainMusique.gain.value, maintenant);
        this.gainMusique.gain.linearRampToValueAtTime(0, maintenant + 0.3);
    },

    // Planifie toutes les notes du quart de seconde à venir. Appelée toutes les
    // 100 ms : chaque note est ainsi programmée à l'avance sur l'horloge audio, à
    // l'heure exacte, même si le minuteur JavaScript, lui, prend un peu de retard.
    planifierMusique() {
        const maintenant = this.contexte.currentTime;
        const dureePas = 60 / Config.MUSIQUE_TEMPO / 4;
        // Minuteur très en retard (onglet ralenti par le navigateur) : on saute les
        // notes manquées plutôt que de les jouer toutes d'un coup.
        if (this.tempsProchainPas < maintenant) {
            this.tempsProchainPas = maintenant + 0.05;
        }
        while (this.tempsProchainPas < maintenant + 0.25) {
            this.jouerPasMusique(this.indexPas, this.tempsProchainPas, dureePas);
            this.tempsProchainPas += dureePas;
            this.indexPas = (this.indexPas + 1) % (16 * MUSIQUE_ACCORDS.length);
        }
    },

    // Un pas de double-croche : nappe en début de mesure, basse syncopée, arpège sur
    // les croches, charleston sur les contretemps.
    jouerPasMusique(index, debut, dureePas) {
        const accord = MUSIQUE_ACCORDS[Math.floor(index / 16)];
        const pas = index % 16;

        if (pas === 0) {
            this.jouerNappe(accord.nappe, debut, dureePas * 16);
        }
        if (MUSIQUE_PAS_BASSE.includes(pas)) {
            this.jouerNoteMusique(accord.basse, debut, dureePas * 1.8, 'triangle', 0.55);
        }
        if (pas % 2 === 0) {
            this.jouerNoteMusique(accord.arpege[(pas / 2) % accord.arpege.length], debut, dureePas * 1.5, 'square', 0.07);
        }
        if (pas % 4 === 2) {
            this.jouerCharleston(debut);
        }
    },

    frequenceNote(numeroMidi) {
        return 440 * 2 ** ((numeroMidi - 69) / 12);
    },

    // Note brève (attaque nette, extinction rapide), vers le gain de la musique.
    jouerNoteMusique(numeroMidi, debut, duree, typeOnde, volume) {
        const oscillateur = this.contexte.createOscillator();
        oscillateur.type = typeOnde;
        oscillateur.frequency.setValueAtTime(this.frequenceNote(numeroMidi), debut);

        const gain = this.contexte.createGain();
        gain.gain.setValueAtTime(0.0001, debut);
        gain.gain.exponentialRampToValueAtTime(volume, debut + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, debut + duree);

        oscillateur.connect(gain);
        gain.connect(this.gainMusique);
        oscillateur.start(debut);
        oscillateur.stop(debut + duree + 0.02);
    },

    // Accord tenu toute une mesure : trois dents de scie adoucies par un filtre
    // passe-bas, qui montent et s'éteignent lentement pour former un fond continu.
    jouerNappe(notes, debut, duree) {
        const filtre = this.contexte.createBiquadFilter();
        filtre.type = 'lowpass';
        filtre.frequency.value = 900;

        const gain = this.contexte.createGain();
        gain.gain.setValueAtTime(0.0001, debut);
        gain.gain.linearRampToValueAtTime(0.05, debut + duree * 0.25);
        gain.gain.linearRampToValueAtTime(0.0001, debut + duree);
        filtre.connect(gain);
        gain.connect(this.gainMusique);

        for (const note of notes) {
            const oscillateur = this.contexte.createOscillator();
            oscillateur.type = 'sawtooth';
            oscillateur.frequency.value = this.frequenceNote(note);
            oscillateur.connect(filtre);
            oscillateur.start(debut);
            oscillateur.stop(debut + duree + 0.02);
        }
    },

    // Petit souffle aigu : un bruit blanc très court, filtré pour ne garder que les
    // aigus.
    jouerCharleston(debut) {
        if (!this.tamponBruit) {
            const longueur = Math.floor(this.contexte.sampleRate * 0.05);
            this.tamponBruit = this.contexte.createBuffer(1, longueur, this.contexte.sampleRate);
            const donnees = this.tamponBruit.getChannelData(0);
            for (let i = 0; i < longueur; i++) {
                donnees[i] = Math.random() * 2 - 1;
            }
        }
        const source = this.contexte.createBufferSource();
        source.buffer = this.tamponBruit;
        const filtre = this.contexte.createBiquadFilter();
        filtre.type = 'highpass';
        filtre.frequency.value = 7000;
        const gain = this.contexte.createGain();
        gain.gain.setValueAtTime(0.08, debut);
        gain.gain.exponentialRampToValueAtTime(0.0001, debut + 0.05);

        source.connect(filtre);
        filtre.connect(gain);
        gain.connect(this.gainMusique);
        source.start(debut);
    },

    // Bip de tir, dont la fréquence et le timbre varient selon le type de tour : aigu
    // et très court pour la Mitrailleuse (onde carrée, plus « électrique »), plus
    // grave et légèrement plus long pour le Canon (glissando descendant, pour un effet
    // de « boum » plutôt qu'une simple note grave), aigu et sec pour le Sniper (onde en
    // dents de scie, plus tranchante, decay très rapide).
    //
    // Le Canon utilisait à l'origine une onde sinusoïdale pure à 180 Hz : correct en
    // théorie, mais quasiment inaudible en pratique sur la plupart des haut-parleurs de
    // téléphone ou d'ordinateur portable (signalé par un utilisateur : « les tirs de
    // canon n'émettent pas de son »), faute d'y reproduire correctement une fréquence
    // aussi grave et faute d'harmoniques dans une onde sinus pour compenser — contexte
    // audio et planification vérifiés fonctionnels par ailleurs (`AudioContext.state`
    // à `running`, événements `setValueAtTime` bien programmés), ce n'était donc pas un
    // bug de code mais un choix de timbre à corriger. Remplacée par une onde triangle
    // (plus riche en harmoniques qu'un sinus, donc mieux reproduite par de petits
    // haut-parleurs) avec un glissando descendant 220 Hz → 90 Hz : reste la plus grave
    // et la plus longue des trois tonalités de tir, cette fois clairement audible.
    jouerTir(type) {
        if (!this.actif) return;
        if (type === 'mitrailleuse') {
            this.jouerTonalite({ frequenceDebut: 1100, duree: 0.045, typeOnde: 'square' });
        } else if (type === 'canon') {
            this.jouerTonalite({ frequenceDebut: 220, frequenceFin: 90, duree: 0.16, typeOnde: 'triangle' });
        } else {
            this.jouerTonalite({ frequenceDebut: 1900, duree: 0.03, typeOnde: 'sawtooth' });
        }
    },

    // Glissando descendant bref à la mort d'un ennemi, légèrement différent par type :
    // plus aigu et plus court pour le Rapide (cohérent avec sa fragilité), plus grave
    // et plus long pour le Blindé. Le Drone (phase 7F) rompt avec le triangle/
    // sawtooth « organique » des trois autres : une onde carrée, aiguë et très
    // brève, pour un timbre nettement plus électronique/mécanique — cohérent avec un
    // appareil plutôt qu'une unité au sol, sans reprendre la tonalité de tir déjà
    // utilisée par la Mitrailleuse (1100 Hz carré) grâce à une fréquence de départ
    // plus haute encore et un glissando descendant que celle-ci n'a pas.
    jouerMort(type) {
        if (!this.actif) return;
        if (type === 'rapide') {
            this.jouerTonalite({ frequenceDebut: 700, frequenceFin: 300, duree: 0.15, typeOnde: 'triangle' });
        } else if (type === 'blinde') {
            this.jouerTonalite({ frequenceDebut: 350, frequenceFin: 70, duree: 0.32, typeOnde: 'sawtooth' });
        } else if (type === 'drone') {
            this.jouerTonalite({ frequenceDebut: 1800, frequenceFin: 900, duree: 0.1, typeOnde: 'square' });
        } else if (type === 'boss') {
            // Boss (phase 7G) : nettement plus grave et plus long que les trois
            // variantes existantes (jusqu'ici 0,32 s au maximum, pour le Blindé), pour
            // marquer sa mort comme un moment fort plutôt qu'une simple explosion de
            // plus. Deux tonalités superposées (dents de scie et carrée, décalées de
            // 0,05 s) plutôt qu'une seule, pour un timbre plus dense/dramatique,
            // cohérent avec le son d'alerte de la vague qui l'a annoncé
            // (jouerAlerteBoss ci-dessous).
            this.jouerTonalite({ frequenceDebut: 260, frequenceFin: 40, duree: 0.55, typeOnde: 'sawtooth' });
            this.jouerTonalite({ frequenceDebut: 130, frequenceFin: 30, duree: 0.55, typeOnde: 'square', delai: 0.05 });
        } else {
            this.jouerTonalite({ frequenceDebut: 500, frequenceFin: 200, duree: 0.22, typeOnde: 'triangle' });
        }
    },

    // Annonce dramatique jouée une seule fois au tout début d'une vague de boss
    // (phase 7G, voir Vagues.demarrer) — nettement différente de jouerAlerte
    // (l'alarme, plus aiguë et plus courte, jouée à chaque ennemi ordinaire qui
    // atteint l'arrivée) : deux tonalités très graves superposées, en dents de scie
    // puis en carré pour un timbre plus dur, sur une durée bien supérieure à tout
    // autre son du jeu hors victoire/défaite.
    jouerAlerteBoss() {
        if (!this.actif) return;
        this.jouerTonalite({ frequenceDebut: 90, frequenceFin: 55, duree: 0.5, typeOnde: 'sawtooth' });
        this.jouerTonalite({ frequenceDebut: 180, frequenceFin: 55, duree: 0.5, typeOnde: 'square', delai: 0.1 });
    },

    // Annonce d'un nouveau type d'ennemi (voir Vagues.demarrer) : deux bips aigus et
    // montants, en onde carrée comme la mort d'un drone (jouerMort) — un timbre
    // électronique, distinct de l'alerte grave d'une vague de boss juste au-dessus.
    jouerAlerteNouvelEnnemi() {
        if (!this.actif) return;
        this.jouerTonalite({ frequenceDebut: 1200, frequenceFin: 1700, duree: 0.12, typeOnde: 'square' });
        this.jouerTonalite({ frequenceDebut: 1200, frequenceFin: 1700, duree: 0.12, typeOnde: 'square', delai: 0.18 });
    },

    // Signal d'alerte joué quand un ennemi atteint l'arrivée : deux pulsations graves
    // en dents de scie, nettement plus longues et plus graves que tout autre son du
    // jeu, pour ne jamais être confondu avec un simple bip de tir ou de mort.
    jouerAlerte() {
        if (!this.actif) return;
        this.jouerTonalite({ frequenceDebut: 220, frequenceFin: 160, duree: 0.22, typeOnde: 'sawtooth' });
        this.jouerTonalite({ frequenceDebut: 220, frequenceFin: 160, duree: 0.22, typeOnde: 'sawtooth', delai: 0.26 });
    },

    // Bip de confirmation court et neutre à la construction d'une tour.
    jouerConstruction() {
        if (!this.actif) return;
        this.jouerTonalite({ frequenceDebut: 600, duree: 0.08, typeOnde: 'sine' });
    },

    // Deux notes brèves, la seconde plus aiguë, à l'amélioration d'une tour.
    jouerAmelioration() {
        if (!this.actif) return;
        this.jouerTonalite({ frequenceDebut: 500, duree: 0.08, typeOnde: 'sine' });
        this.jouerTonalite({ frequenceDebut: 750, duree: 0.1, typeOnde: 'sine', delai: 0.09 });
    },

    // Bip descendant court à la vente d'une tour.
    jouerVente() {
        if (!this.actif) return;
        this.jouerTonalite({ frequenceDebut: 500, frequenceFin: 280, duree: 0.12, typeOnde: 'sine' });
    },

    // Courte séquence de 4 notes montantes (arpège majeur) à la victoire.
    jouerVictoire() {
        if (!this.actif) return;
        const notes = [523, 659, 784, 1047];
        notes.forEach((frequence, index) => {
            this.jouerTonalite({ frequenceDebut: frequence, duree: 0.16, typeOnde: 'triangle', delai: index * 0.12 });
        });
    },

    // Glissando grave et descendant, nettement plus long que les autres sons, à la
    // défaite.
    jouerDefaite() {
        if (!this.actif) return;
        this.jouerTonalite({ frequenceDebut: 300, frequenceFin: 55, duree: 0.9, typeOnde: 'sawtooth' });
    }
};
