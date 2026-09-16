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

const Son = {
    actif: true,
    contexte: null,
    avertissementDejaAffiche: false,

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
        } catch (erreur) {
            this.avertirEchecStockage(erreur);
        }
    },

    sauvegarderPreference() {
        try {
            localStorage.setItem(Config.CLE_SAUVEGARDE_SON, String(this.actif));
        } catch (erreur) {
            this.avertirEchecStockage(erreur);
        }
    },

    avertirEchecStockage(erreur) {
        if (this.avertissementDejaAffiche) return;
        this.avertissementDejaAffiche = true;
        console.warn(
            'Défense Néon : localStorage indisponible (navigation privée ?), la préférence son ne sera pas sauvegardée pour cette session.',
            erreur
        );
    },

    basculer() {
        this.actif = !this.actif;
        this.sauvegarderPreference();
    },

    // Crée l'AudioContext à la demande. Ne fait rien si elle a déjà été appelée : un
    // second appel (ex. une future partie démarrée depuis l'écran d'accueil) ne doit
    // jamais recréer de contexte.
    initialiser() {
        if (this.contexte) return;
        this.contexte = new (window.AudioContext || window.webkitAudioContext)();
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
        gain.connect(this.contexte.destination);
        oscillateur.start(debut);
        oscillateur.stop(debut + duree + 0.02);
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
        } else {
            this.jouerTonalite({ frequenceDebut: 500, frequenceFin: 200, duree: 0.22, typeOnde: 'triangle' });
        }
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
