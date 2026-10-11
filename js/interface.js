// interface.js — Tout ce qui concerne l'affichage et les interactions : écrans
// superposés (accueil, victoire, défaite), HUD en cours de partie, clics et survol
// sur le canvas (construction de tours, aperçu), messages temporaires. jeu.js ne
// conserve que l'état de la partie et la boucle de simulation ; les deux fichiers
// s'appellent mutuellement (Interface déclenche des actions sur Jeu, Jeu demande à
// Interface de se redessiner chaque frame), ce qui est sans risque ici : ni l'un ni
// l'autre n'exécute de code au chargement, tout se déclenche après l'initialisation.

const Interface = {
    // Écrans superposés au canvas, et leur conteneur commun (celui du canvas).
    conteneurCanvas: null,
    ecranAccueil: null,
    ecranVictoire: null,
    ecranDefaite: null,

    // HUD en cours de partie.
    conteneurHUD: null,
    elementCredits: null,
    elementIntegrite: null,
    elementNombreTours: null,
    elementNumeroVague: null,
    elementGraine: null,
    boutonLancerVague: null,
    boutonPause: null,
    boutonVitesse: null,
    elementProchaineVague: null,
    elementMessageConstruction: null,

    // Réglages du son, visibles en permanence (voir mettreAJourReglagesSon).
    boutonSon: null,
    boutonMusique: null,
    curseurVolume: null,

    // Fiche de la tour survolée ou sélectionnée pour la construction (voir
    // mettreAJourFicheTour). `typeSurvole` : type du bouton survolé à la souris ou
    // atteint au clavier, null sinon.
    elementFicheTour: null,
    elementFicheTourTitre: null,
    elementFicheTourTexte: null,
    typeSurvole: null,

    // Reprise d'une partie sauvegardée et partage du défi du jour (octobre 2026).
    boutonReprendre: null,
    boutonPartagerDefi: null,
    boutonPartagerDefaite: null,

    // Statistiques de fin de partie (voir afficherStatistiques).
    elementStatistiquesVictoire: null,
    elementStatistiquesDefaite: null,

    // Écran d'accueil.
    boutonsDuree: [],
    elementDescriptionDuree: null,
    boutonJouer: null,
    // Durée sélectionnée à l'accueil, retenue pour la session (pas besoin de survivre
    // à un rechargement de page) : une simple variable suffit.
    idDureeSelectionnee: Config.DUREE_PAR_DEFAUT,

    // Difficulté supérieure (contenu additionnel post-lancement, « phase 7I ») :
    // sélecteur à deux options sur l'écran d'accueil, distinct des boutons de durée
    // ci-dessus (réglage orthogonal, jamais une cinquième durée) — même principe de
    // persistance que idDureeSelectionnee, retenue pour la session sans survivre à
    // un rechargement. Par défaut sur Normal (`false`) à chaque session. Lue
    // uniquement par le clic sur boutonJouer (Jeu.demarrerPartie), jamais par
    // boutonDefiDuJour : le Défi du jour reste toujours en difficulté normale, sans
    // exception (voir Jeu.demarrerDefiDuJour, jeu.js), donc ce champ n'a besoin
    // d'aucune valeur spéciale ni d'aucune lecture particulière pour ce cas — il
    // est simplement ignoré par ce second bouton.
    conteneurDifficulte: null,
    boutonsDifficulte: [],
    difficulteSuperieureSelectionnee: false,

    // Écrans de fin, mention de difficulté supérieure (contenu additionnel
    // post-lancement) — voir afficherResumeProgression.
    elementDifficulteSuperieureVictoire: null,
    elementDifficulteSuperieureDefaite: null,

    // Niveau/XP du joueur sur l'écran d'accueil (phase 3A, voir Progression).
    elementNiveauJoueurActuel: null,
    elementBarreXpConteneur: null,
    elementBarreXpRemplissage: null,
    largeurBarreXpAffichee: null,
    elementTexteNiveauMaxJoueur: null,

    // Défi du jour (contenu additionnel post-lancement), sur l'écran d'accueil
    // (voir mettreAJourDefiDuJour). Distinct de idDureeSelectionnee ci-dessus : le
    // bouton dédié (boutonDefiDuJour) démarre toujours la partie via
    // Jeu.demarrerDefiDuJour(), sans jamais lire ni modifier la durée sélectionnée
    // parmi les quatre boutons habituels.
    elementDefiDuJourDate: null,
    elementDefiDuJourScore: null,
    boutonDefiDuJour: null,

    // Liste des paliers de bonus permanents sous la barre d'XP (phase 3B). Les <li>
    // sont créés une seule fois dans initialiser() à partir de
    // Progression.listePaliers() (jamais depuis Config.PALIERS_BONUS directement, voir
    // la note en tête de progression.js) ; seuls leur classe et leur texte sont
    // rafraîchis ensuite, dans le même ordre, par mettreAJourProgressionAccueil.
    conteneurPaliersBonus: null,
    elementsPaliersBonus: [],

    // XP gagnée / passage de niveau sur les écrans de victoire et de défaite,
    // lus depuis Jeu.derniereProgression (phase 3A).
    elementXpGagneeVictoire: null,
    elementNiveauSuperieurVictoire: null,
    elementXpGagneeDefaite: null,
    elementNiveauSuperieurDefaite: null,

    // Barre de sélection du type de tour à construire (phase 2A). Le type
    // sélectionné est remis à Config.TYPE_TOUR_PAR_DEFAUT à chaque démarrage de
    // partie (voir Jeu.reinitialiser), pas seulement à l'initialisation de la page.
    conteneurTypesTours: null,
    boutonsTypesTours: [],
    typeSelectionne: Config.TYPE_TOUR_PAR_DEFAUT,

    // Panneau d'amélioration/vente (phase 2B). tourSelectionnee est une référence
    // directe vers une Tour de Jeu.toursActives, ou null si aucune n'est sélectionnée
    // (panneau fermé). Remise à null à chaque nouvelle partie (voir Jeu.reinitialiser).
    panneauAmelioration: null,
    elementPanneauTitre: null,
    elementPanneauStats: null,
    boutonAmeliorer: null,
    elementNiveauMax: null,
    boutonCiblage: null,
    boutonVendre: null,
    tourSelectionnee: null,

    // Écrans de fin de partie.
    elementVaguesFranchisesVictoire: null,
    elementIntegriteRestanteVictoire: null,
    elementVagueAtteinteDefaite: null,

    // Case actuellement survolée par la souris (colonne/ligne), ou null si aucune —
    // soit parce que le pointeur est hors du canvas, soit parce que l'appareil n'a
    // pas de souris (voir supportSurvol). Alimente l'aperçu de construction dessiné
    // par dessinerApercuConstruction.
    caseSurvolee: null,

    // Case tactile en attente d'un second tap de confirmation (correctif mobile) —
    // colonne/ligne, ou null si aucune. Distincte de `caseSurvolee` (qui pilote le
    // dessin de l'aperçu, mis à jour en même temps que cette case sur tactile) : voir
    // gererClicCanvas ci-dessous. Sans effet sur souris, où la construction reste
    // immédiate au clic comme depuis la phase 1C.
    caseEnAttenteConfirmation: null,

    // Minuteur (secondes restantes, en temps réel — voir mettreAJourEcrans) du
    // message de construction affiché dans le HUD ("Case invalide", etc.).
    dureeRestanteMessageConstruction: 0,

    // Choix du point de blocage d'une Caserne (contenu additionnel post-lancement) :
    // `{ tour, candidats }` pendant l'attente d'un choix (plusieurs cases de chemin
    // adjacentes à la Caserne qui vient d'être construite, voir Tour et
    // Carte.candidatsBlocagePourCaserne), `null` sinon — y compris dans le cas le
    // plus fréquent, une seule candidate, jamais mis en attente. Tant que non nul,
    // gererClicCanvas n'accepte plus qu'un clic sur l'une de ces candidates (voir
    // resoudreChoixBlocageCaserne) : aucune autre interaction du plateau (construire
    // une autre tour, sélectionner une tour existante) n'a d'effet — pas
    // d'annulation possible, la Caserne est déjà construite et payée.
    caserneEnAttenteChoix: null,

    initialiser() {
        this.conteneurCanvas = document.querySelector('.conteneur-canvas');
        this.ecranAccueil = document.getElementById('ecran-accueil');
        this.ecranVictoire = document.getElementById('ecran-victoire');
        this.ecranDefaite = document.getElementById('ecran-defaite');

        this.conteneurHUD = document.getElementById('barre-hud');
        this.elementCredits = document.getElementById('credits-actuels');
        this.elementIntegrite = document.getElementById('integrite-actuelle');
        this.elementNombreTours = document.getElementById('nombre-tours');
        this.elementNumeroVague = document.getElementById('numero-vague');
        this.elementGraine = document.getElementById('graine-actuelle');
        this.boutonLancerVague = document.getElementById('bouton-lancer-vague');
        this.boutonPause = document.getElementById('bouton-pause');
        this.boutonVitesse = document.getElementById('bouton-vitesse');
        this.elementProchaineVague = document.getElementById('prochaine-vague');
        this.elementMessageConstruction = document.getElementById('message-construction');

        // Réglages du son : placés hors de #barre-hud dans le HTML précisément parce
        // qu'ils doivent rester visibles à tout moment (y compris à l'accueil, avant
        // même qu'une partie ne démarre), alors que #barre-hud est masqué en dehors de
        // 'enCours' (voir mettreAJourEcrans) — jamais soumis à cette bascule.
        this.boutonSon = document.getElementById('bouton-son');
        this.boutonMusique = document.getElementById('bouton-musique');
        this.curseurVolume = document.getElementById('curseur-volume');
        this.mettreAJourReglagesSon();
        this.boutonSon.addEventListener('click', () => {
            Son.basculer();
            this.mettreAJourReglagesSon();
        });
        this.boutonMusique.addEventListener('click', () => {
            Son.basculerMusique();
            this.mettreAJourReglagesSon();
        });
        this.curseurVolume.addEventListener('input', () => {
            Son.reglerVolume(Number(this.curseurVolume.value) / 100);
        });
        // Un petit bip au relâchement du curseur, pour entendre le nouveau volume —
        // seulement si l'audio a déjà été autorisé par un premier clic sur Jouer.
        this.curseurVolume.addEventListener('change', () => {
            if (Son.contexte) Son.jouerConstruction();
        });

        this.elementDescriptionDuree = document.getElementById('description-duree');
        this.boutonJouer = document.getElementById('bouton-jouer');

        // Défi du jour (contenu additionnel post-lancement) : encart séparé des
        // quatre boutons de durée ci-dessus, voir index.html. Son bouton crée
        // l'AudioContext au premier clic exactement comme boutonJouer plus bas
        // (voir la note à cet endroit) puisqu'il peut tout aussi bien être le tout
        // premier clic de la session.
        this.elementDefiDuJourDate = document.getElementById('defi-du-jour-date');
        this.elementDefiDuJourScore = document.getElementById('defi-du-jour-score');
        this.boutonDefiDuJour = document.getElementById('bouton-defi-du-jour');
        this.boutonDefiDuJour.addEventListener('click', () => {
            Son.initialiser();
            Jeu.demarrerDefiDuJour();
        });

        this.boutonReprendre = document.getElementById('bouton-reprendre');
        this.boutonReprendre.addEventListener('click', () => {
            Son.initialiser();
            Jeu.reprendrePartie();
        });

        this.boutonPartagerDefi = document.getElementById('bouton-partager-defi');
        this.boutonPartagerDefi.addEventListener('click', () => {
            this.partagerDefi(this.boutonPartagerDefi, Progression.defiDuJour.meilleureVague);
        });
        this.boutonPartagerDefaite = document.getElementById('bouton-partager-defaite');
        this.boutonPartagerDefaite.addEventListener('click', () => {
            this.partagerDefi(this.boutonPartagerDefaite, Jeu.derniereProgression.vagueAtteinte);
        });
        this.elementStatistiquesVictoire = document.getElementById('statistiques-victoire');
        this.elementStatistiquesDefaite = document.getElementById('statistiques-defaite');

        this.elementNiveauJoueurActuel = document.getElementById('niveau-joueur-actuel');
        this.elementBarreXpConteneur = document.getElementById('barre-xp-conteneur');
        this.elementBarreXpRemplissage = document.getElementById('barre-xp-remplissage');
        this.elementTexteNiveauMaxJoueur = document.getElementById('texte-niveau-max-joueur');

        // Les paliers sont générés depuis Progression.listePaliers() plutôt que codés
        // en dur dans le HTML, pour la même raison que les boutons de durée ou de type
        // de tour : ne jamais avoir deux sources de vérité. L'ordre de Config.PALIERS_BONUS
        // (croissant par niveauRequis) est celui dans lequel ils sont affichés.
        this.conteneurPaliersBonus = document.getElementById('liste-paliers-bonus');
        for (const palier of Progression.listePaliers()) {
            const item = document.createElement('li');
            item.dataset.idPalier = palier.id;
            this.conteneurPaliersBonus.appendChild(item);
        }
        this.elementsPaliersBonus = Array.from(this.conteneurPaliersBonus.querySelectorAll('li'));

        this.elementVaguesFranchisesVictoire = document.getElementById('vagues-franchies-victoire');
        this.elementIntegriteRestanteVictoire = document.getElementById('integrite-restante-victoire');
        this.elementXpGagneeVictoire = document.getElementById('xp-gagnee-victoire');
        this.elementNiveauSuperieurVictoire = document.getElementById('niveau-superieur-victoire');
        this.elementDifficulteSuperieureVictoire = document.getElementById('difficulte-superieure-victoire');
        this.elementVagueAtteinteDefaite = document.getElementById('vague-atteinte-defaite');
        this.elementXpGagneeDefaite = document.getElementById('xp-gagnee-defaite');
        this.elementNiveauSuperieurDefaite = document.getElementById('niveau-superieur-defaite');
        this.elementDifficulteSuperieureDefaite = document.getElementById('difficulte-superieure-defaite');

        // Les boutons de durée sont générés depuis Config.DUREES_PARTIE plutôt que
        // codés en dur dans le HTML, pour ne jamais avoir deux sources de vérité sur
        // les durées disponibles.
        const conteneurDurees = document.getElementById('choix-duree');
        for (const duree of Config.DUREES_PARTIE) {
            const bouton = document.createElement('button');
            bouton.type = 'button';
            bouton.textContent = duree.label;
            bouton.dataset.idDuree = duree.id;
            bouton.addEventListener('click', () => this.selectionnerDuree(duree.id));
            conteneurDurees.appendChild(bouton);
        }
        this.boutonsDuree = Array.from(conteneurDurees.querySelectorAll('button'));
        this.selectionnerDuree(Config.DUREE_PAR_DEFAUT);

        // Difficulté supérieure (contenu additionnel post-lancement) : sélecteur à
        // deux options codées en dur dans index.html (contrairement aux boutons de
        // durée/type ci-dessus, générés depuis Config — un ensemble figé à deux
        // valeurs fixes ne justifie pas une source de données séparée rien que pour
        // ces deux boutons). `data-difficulte="superieure"` identifie l'option
        // Supérieure ; toute autre valeur (ou son absence) vaut Normal.
        this.conteneurDifficulte = document.getElementById('choix-difficulte');
        this.boutonsDifficulte = Array.from(this.conteneurDifficulte.querySelectorAll('button'));
        for (const bouton of this.boutonsDifficulte) {
            bouton.addEventListener('click', () => {
                this.selectionnerDifficulte(bouton.dataset.difficulte === 'superieure');
            });
        }
        this.selectionnerDifficulte(false);

        // Neutralise visuellement le sélecteur de difficulté pendant toute
        // interaction avec l'encart Défi du jour (survol souris ou focus clavier) :
        // ce réglage ne s'applique jamais à ce mode (voir Jeu.demarrerDefiDuJour,
        // jeu.js, qui ne le lit jamais), et ce sélecteur n'a de toute façon aucun
        // effet réel sur lui — mais rester actif à l'écran pendant que le joueur
        // s'apprête à cliquer « Jouer le défi du jour » laisserait croire à tort
        // qu'il compte. `pointerenter`/`pointerleave` couvrent la souris,
        // `focusin`/`focusout` la navigation clavier (tabulation jusqu'au bouton du
        // défi) ; un tap tactile direct sur le bouton ne laisse de toute façon
        // aucun état de survol à neutraliser.
        const conteneurDefiDuJour = document.querySelector('.defi-du-jour');
        const neutraliserDifficulte = (neutralise) => {
            this.conteneurDifficulte.classList.toggle('difficulte-neutralisee', neutralise);
            for (const bouton of this.boutonsDifficulte) {
                bouton.disabled = neutralise;
            }
        };
        conteneurDefiDuJour.addEventListener('pointerenter', () => neutraliserDifficulte(true));
        conteneurDefiDuJour.addEventListener('pointerleave', () => neutraliserDifficulte(false));
        conteneurDefiDuJour.addEventListener('focusin', () => neutraliserDifficulte(true));
        conteneurDefiDuJour.addEventListener('focusout', () => neutraliserDifficulte(false));

        // Les boutons de type de tour sont générés depuis Config.TYPES_TOURS, pour la
        // même raison que ceux de durée : ne jamais avoir deux sources de vérité.
        this.conteneurTypesTours = document.getElementById('barre-types-tours');
        Object.entries(Config.TYPES_TOURS).forEach(([type, caracteristiques], index) => {
            const bouton = document.createElement('button');
            bouton.type = 'button';
            bouton.textContent = `${caracteristiques.nom} — ${caracteristiques.cout}`;
            bouton.dataset.typeTour = type;
            bouton.title = `Raccourci clavier : ${index + 1}`;
            bouton.addEventListener('click', () => this.selectionnerTypeTour(type));
            // La fiche montre la tour survolée à la souris (ou atteinte au clavier)
            // avant même de la sélectionner. Pas sur tactile : un tap sélectionne
            // directement, et la fiche suit alors la sélection.
            bouton.addEventListener('pointerenter', evenement => {
                if (this.supportSurvol(evenement)) this.typeSurvole = type;
            });
            bouton.addEventListener('pointerleave', () => { this.typeSurvole = null; });
            // Focus au clavier seulement (touche Tab) : un bouton cliqué garde aussi
            // le focus, mais la fiche doit alors suivre la sélection.
            bouton.addEventListener('focus', () => {
                if (bouton.matches(':focus-visible')) this.typeSurvole = type;
            });
            bouton.addEventListener('blur', () => { this.typeSurvole = null; });
            this.conteneurTypesTours.appendChild(bouton);
        });
        this.boutonsTypesTours = Array.from(this.conteneurTypesTours.querySelectorAll('button'));
        this.selectionnerTypeTour(Config.TYPE_TOUR_PAR_DEFAUT);

        this.elementFicheTour = document.getElementById('fiche-tour');
        this.elementFicheTourTitre = document.getElementById('fiche-tour-titre');
        this.elementFicheTourTexte = document.getElementById('fiche-tour-texte');

        this.panneauAmelioration = document.getElementById('panneau-amelioration');
        this.elementPanneauTitre = document.getElementById('panneau-titre');
        this.elementPanneauStats = document.getElementById('panneau-stats');
        this.boutonAmeliorer = document.getElementById('bouton-ameliorer');
        this.elementNiveauMax = document.getElementById('panneau-niveau-max');
        this.boutonCiblage = document.getElementById('bouton-ciblage');
        this.boutonVendre = document.getElementById('bouton-vendre');

        this.boutonAmeliorer.addEventListener('click', () => this.ameliorerTourSelectionnee());
        this.boutonCiblage.addEventListener('click', () => this.changerCiblageTourSelectionnee());
        this.boutonVendre.addEventListener('click', () => this.vendreTourSelectionnee());

        // Un clic n'importe où ailleurs que sur le canvas (déjà géré par
        // gererClicCanvas) ou sur le panneau lui-même (boutons Améliorer/Vendre, qui
        // gèrent leur propre effet) ferme le panneau s'il était ouvert.
        document.addEventListener('pointerdown', evenement => {
            if (this.tourSelectionnee === null) return;
            if (evenement.target === Jeu.canvas) return;
            if (this.panneauAmelioration.contains(evenement.target)) return;
            this.tourSelectionnee = null;
        });

        this.boutonJouer.addEventListener('click', () => {
            // Premier (et unique) appel : crée l'AudioContext, voir la note en tête de
            // son.js. Doit précéder toute lecture de son, donc être appelé avant même
            // Jeu.demarrerPartie (dont la simulation pourrait déclencher un son dès sa
            // toute première frame, ex. un ennemi qui apparaît déjà à portée).
            Son.initialiser();
            Jeu.demarrerPartie(this.idDureeSelectionnee, this.difficulteSuperieureSelectionnee);
        });

        for (const bouton of document.querySelectorAll('.bouton-rejouer')) {
            bouton.addEventListener('click', () => Jeu.rejouer());
        }
        for (const bouton of document.querySelectorAll('.bouton-changer-duree')) {
            bouton.addEventListener('click', () => Jeu.retourAccueil());
        }

        // Lance la vague suivante, ou l'appelle en avance (voir Jeu.lancerVagueSuivante).
        this.boutonLancerVague.addEventListener('click', () => Jeu.lancerVagueSuivante());

        // Bouton unique Pause/Reprendre : agit sur la même variable Jeu.enPause que
        // la pause automatique déclenchée par visibilitychange (dans jeu.js), sans
        // logique séparée entre les deux.
        this.boutonPause.addEventListener('click', () => {
            Jeu.enPause = !Jeu.enPause;
        });

        this.boutonVitesse.addEventListener('click', () => {
            Jeu.vitesseJeu = Jeu.vitesseJeu === 1 ? 2 : 1;
        });

        // Le survol (pointermove) n'a d'effet que sur les appareils avec une vraie
        // souris (voir supportSurvol) et alimente uniquement l'aperçu visuel ; sur
        // tactile, gererClicCanvas gère lui-même l'aperçu en deux temps (correctif
        // mobile, voir plus bas).
        Jeu.canvas.addEventListener('pointerdown', evenement => this.gererClicCanvas(evenement));
        Jeu.canvas.addEventListener('pointermove', evenement => this.gererSurvolCanvas(evenement));
        // Ne s'applique qu'à la souris (correctif mobile) : sur beaucoup de
        // navigateurs, un tap tactile déclenche aussi pointerleave juste après le
        // relâchement (le point de contact « quitte » l'élément puisqu'il cesse
        // d'exister) — sans cette garde, l'aperçu tactile fraîchement posé par
        // gererClicCanvas serait effacé l'instant suivant, avant même d'être visible.
        Jeu.canvas.addEventListener('pointerleave', evenement => {
            if (this.supportSurvol(evenement)) {
                this.caseSurvolee = null;
            }
        });

        document.addEventListener('keydown', evenement => this.gererClavier(evenement));
    },

    // Raccourcis clavier (octobre 2026), rappelés sur l'écran d'accueil (.aide-clavier).
    // Les chiffres sont lus via `evenement.code` (position de la touche) plutôt que
    // `evenement.key` : sur un clavier AZERTY, la rangée du haut donne « & é " ' »
    // sans la touche Maj, alors que c'est bien la touche « 1 » que le joueur vise.
    gererClavier(evenement) {
        if (evenement.ctrlKey || evenement.metaKey || evenement.altKey) return;
        // Le curseur de volume se règle aux flèches : ses touches ne sont pas des
        // raccourcis.
        if (evenement.target instanceof HTMLInputElement) return;
        const touche = (evenement.key || '').toLowerCase();

        if (touche === 'm') {
            Son.basculer();
            this.mettreAJourReglagesSon();
            return;
        }
        if (Jeu.etatPartie !== 'enCours') return;

        const chiffre = /^(Digit|Numpad)([1-9])$/.exec(evenement.code);
        if (chiffre) {
            const type = Object.keys(Config.TYPES_TOURS)[Number(chiffre[2]) - 1];
            if (type) {
                this.selectionnerTypeTour(type);
                // La fiche montre la tour qu'on vient de choisir, même si un autre
                // bouton de tour a encore le focus.
                this.typeSurvole = null;
            }
            return;
        }

        if (evenement.code === 'Space') {
            // Empêche aussi le défilement de la page et le clic du bouton qui aurait
            // le focus (sinon Espace après un clic sur « Pause » remettrait en pause).
            evenement.preventDefault();
            Jeu.lancerVagueSuivante();
            return;
        }

        if (touche === 'p') {
            Jeu.enPause = !Jeu.enPause;
        } else if (touche === 'v') {
            Jeu.vitesseJeu = Jeu.vitesseJeu === 1 ? 2 : 1;
        } else if (touche === 'a') {
            this.ameliorerTourSelectionnee();
        } else if (touche === 'c') {
            this.changerCiblageTourSelectionnee();
        } else if (touche === 'escape') {
            this.tourSelectionnee = null;
            this.effacerAttenteConfirmationTactile();
        }
    },

    selectionnerDuree(id) {
        this.idDureeSelectionnee = id;
        const duree = Config.DUREES_PARTIE.find(d => d.id === id);
        this.elementDescriptionDuree.textContent = duree.description;

        for (const bouton of this.boutonsDuree) {
            bouton.classList.toggle('selectionne', bouton.dataset.idDuree === id);
        }
    },

    selectionnerTypeTour(type) {
        this.typeSelectionne = type;
        this.mettreAJourBoutonsTypesTours();
    },

    // Difficulté supérieure (contenu additionnel post-lancement) : même principe
    // que selectionnerDuree ci-dessus (fond + liseré distincts sur l'option active,
    // jamais une teinte seule).
    selectionnerDifficulte(superieure) {
        this.difficulteSuperieureSelectionnee = superieure;
        for (const bouton of this.boutonsDifficulte) {
            const estSuperieure = bouton.dataset.difficulte === 'superieure';
            bouton.classList.toggle('selectionne', estSuperieure === superieure);
        }
    },

    // N'écrit une propriété d'un élément de la page (texte, `hidden`, `disabled`...)
    // que si sa valeur change. Les fonctions de rafraîchissement ci-dessous sont
    // rappelées à chaque image : réécrire à l'identique un texte du HUD forçait
    // quand même le navigateur à recalculer toute la mise en page 60 fois par seconde.
    ecrireSiChange(element, propriete, valeur) {
        const nouvelleValeur = propriete === 'textContent' ? String(valeur) : valeur;
        if (element[propriete] !== nouvelleValeur) element[propriete] = nouvelleValeur;
    },

    // Libellés des boutons Son et Musique et position du curseur de volume, rafraîchis
    // immédiatement après chaque changement — pas besoin d'un rafraîchissement par
    // frame comme mettreAJourBoutonsTypesTours, puisque rien d'autre que ces
    // contrôles (et la touche M) ne les fait changer.
    mettreAJourReglagesSon() {
        this.boutonSon.textContent = Son.actif ? 'Son : ON' : 'Son : OFF';
        this.boutonMusique.textContent = Son.musiqueActive ? 'Musique : ON' : 'Musique : OFF';
        // Sans son, la musique ne joue de toute façon pas : son bouton est grisé.
        this.boutonMusique.disabled = !Son.actif;
        this.curseurVolume.value = String(Math.round(Son.volume * 100));
        this.curseurVolume.disabled = !Son.actif;
    },

    // Fiche de la tour survolée, ou de la tour sélectionnée pour la construction :
    // coût réel, caractéristiques de base (niveau 1) et rôle. Rappelée à chaque image
    // en partie ; ecrireSiChange évite de réécrire un texte identique.
    mettreAJourFicheTour() {
        const type = this.typeSurvole || this.typeSelectionne;
        const caracteristiques = Config.TYPES_TOURS[type];
        let valeurs;
        if (caracteristiques.typeDegats === 'caserne') {
            valeurs = `Soldat : ${Config.CASERNE_UNITE_PV_BASE} points de vie, ${Config.CASERNE_UNITE_DEGATS_BASE} dégâts/s`;
        } else if (caracteristiques.typeDegats === 'gel') {
            valeurs = `Ralentit de ${Math.round(Config.GEL_RALENTISSEMENT_BASE * 100)} % · portée ${caracteristiques.portee}`;
        } else {
            valeurs = `Dégâts ${caracteristiques.degats} · ${caracteristiques.cadence.toLocaleString('fr-FR')} tir/s · portée ${caracteristiques.portee}`;
        }
        this.ecrireSiChange(this.elementFicheTourTitre, 'textContent', `${caracteristiques.nom} — ${this.coutConstruction(type)} crédits`);
        this.ecrireSiChange(this.elementFicheTourTexte, 'textContent', `${valeurs}. ${caracteristiques.description}`);
    },

    // Bouton « Lancer la vague » et aperçu de la vague suivante, rappelés à chaque
    // image en partie. Le bouton sert aussi à appeler la vague suivante en avance
    // (voir Jeu.lancerVagueSuivante), en affichant le bonus que cela rapporterait.
    mettreAJourLancementVague() {
        let libelle = 'Lancer la vague';
        let desactive = false;
        if (Vagues.enCours) {
            if (Vagues.peutAppelerEnAvance()) {
                libelle = `Appeler la vague (+${Vagues.bonusAppelAnticipe(Jeu.ennemisActifs)})`;
            } else {
                libelle = 'Vague en cours';
                desactive = true;
            }
        }
        this.ecrireSiChange(this.boutonLancerVague, 'textContent', libelle);
        this.ecrireSiChange(this.boutonLancerVague, 'disabled', desactive);

        const prochaine = Vagues.numeroVagueActuelle + 1;
        this.ecrireSiChange(this.elementProchaineVague, 'textContent', prochaine <= Jeu.nombreDeVagues
            ? `À venir — vague ${prochaine} : ${Vagues.descriptionVague(prochaine)}`
            : 'Dernière vague !');
    },

    // Coût réel de construction d'un type de tour, réduction permanente du joueur
    // comprise (phase 3B, Progression.multiplicateurCoutConstruction — 1 tant
    // qu'aucun palier de réduction n'est débloqué, donc sans effet par défaut).
    // Centralisé ici : la barre de sélection, la construction elle-même et l'aperçu
    // au survol doivent tous les trois afficher/vérifier exactement le même montant.
    coutConstruction(type) {
        return Math.round(Config.TYPES_TOURS[type].cout * Progression.multiplicateurCoutConstruction());
    },

    // Met à jour la mise en évidence du type actif, le coût affiché (qui peut varier
    // d'une partie à l'autre selon les bonus débloqués, jamais en cours de partie) et
    // grise les types trop chers — ou, depuis la phase 6B, tous les types dès que la
    // limite de tours est atteinte, puisqu'aucun n'est alors plus constructible quel
    // que soit son coût. Rappelée à la fois immédiatement après un clic et à chaque
    // frame par mettreAJourEcrans (les crédits, eux, changent en continu pendant la
    // partie).
    mettreAJourBoutonsTypesTours() {
        const limiteAtteinte = Jeu.toursActives.length >= Jeu.limiteTours;
        for (const bouton of this.boutonsTypesTours) {
            const type = bouton.dataset.typeTour;
            const cout = this.coutConstruction(type);
            this.ecrireSiChange(bouton, 'textContent', `${Config.TYPES_TOURS[type].nom} — ${cout}`);
            bouton.classList.toggle('selectionne', type === this.typeSelectionne);
            this.ecrireSiChange(bouton, 'disabled', limiteAtteinte || Jeu.credits < cout);
        }
    },

    // Convertit la position d'un événement pointeur en coordonnées de case. Remet
    // d'abord les coordonnées à l'échelle du canvas, car celui-ci est affiché en CSS
    // à une taille qui peut différer de sa résolution de dessin réelle.
    convertirEvenementEnCase(evenement) {
        const rect = Jeu.canvas.getBoundingClientRect();
        const x = (evenement.clientX - rect.left) * (Jeu.canvas.width / rect.width);
        const y = (evenement.clientY - rect.top) * (Jeu.canvas.height / rect.height);
        return Carte.pixelsVersCase(x, y);
    },

    // Distingue trois cas selon l'état de la case cliquée : une case déjà occupée
    // sélectionne sa tour (ouvre le panneau d'amélioration/vente), une case libre
    // construit, une case de chemin se contente de fermer le panneau sans autre effet.
    // Sur souris, une case libre construit immédiatement, comme depuis la phase 1C.
    // Sur tactile (correctif mobile), une case libre suit un tap pour prévisualiser,
    // second tap pour confirmer : le premier tap sur une case pose
    // `caseEnAttenteConfirmation` et affiche l'aperçu (même dessin que le survol
    // souris, voir dessinerApercuConstruction) sans construire ; un second tap sur
    // CETTE MÊME case construit ; un tap sur une case libre différente déplace
    // simplement l'aperçu sans jamais construire l'ancienne case en attente.
    gererClicCanvas(evenement) {
        if (Jeu.etatPartie !== 'enCours' || Jeu.enPause) return;

        const { colonne, ligne } = this.convertirEvenementEnCase(evenement);
        if (!Carte.dansLaGrille(colonne, ligne)) return;

        // Choix du point de blocage d'une Caserne en attente (contenu additionnel
        // post-lancement) : intercepté avant toute autre logique de clic, construction
        // d'une autre tour et sélection d'une tour existante comprises — un clic
        // ailleurs qu'une case candidate n'a rigoureusement aucun effet tant que ce
        // choix n'est pas résolu.
        if (this.caserneEnAttenteChoix) {
            this.resoudreChoixBlocageCaserne(colonne, ligne);
            return;
        }

        const etat = Carte.grille[ligne][colonne];

        if (etat === 'OCCUPEE') {
            this.effacerAttenteConfirmationTactile();
            this.tourSelectionnee = Jeu.toursActives.find(
                tour => tour.colonne === colonne && tour.ligne === ligne
            ) || null;
            return;
        }

        if (etat !== 'LIBRE') {
            this.effacerAttenteConfirmationTactile();
            this.tourSelectionnee = null;
            return;
        }

        this.tourSelectionnee = null;

        if (this.supportSurvol(evenement)) {
            // Sur un appareil hybride (écran tactile + souris), une case tactile
            // restée en attente d'un ancien tap ne doit pas survivre à un clic souris
            // ailleurs : sans effet sur un appareil purement souris, où cette case est
            // de toute façon toujours restée null.
            this.effacerAttenteConfirmationTactile();
            this.tenterConstruireTour(colonne, ligne);
            return;
        }

        const memeCaseEnAttente = this.caseEnAttenteConfirmation
            && this.caseEnAttenteConfirmation.colonne === colonne
            && this.caseEnAttenteConfirmation.ligne === ligne;

        if (memeCaseEnAttente) {
            this.tenterConstruireTour(colonne, ligne);
            this.effacerAttenteConfirmationTactile();
        } else {
            this.caseEnAttenteConfirmation = { colonne, ligne };
            this.caseSurvolee = { colonne, ligne };
        }
    },

    // Efface la case tactile en attente de confirmation et l'aperçu qui l'accompagne
    // (correctif mobile) : appelée dès que ce n'est plus pertinent (sélection d'une
    // tour, tap sur une case de chemin, ou construction menée à bien sur le second
    // tap).
    effacerAttenteConfirmationTactile() {
        this.caseEnAttenteConfirmation = null;
        this.caseSurvolee = null;
    },

    // Vrai uniquement pour un pointeur de type souris : sur tactile, aucun survol
    // n'est possible avant le tap lui-même, donc aucun aperçu ne doit s'afficher.
    supportSurvol(evenement) {
        return evenement.pointerType === 'mouse';
    },

    gererSurvolCanvas(evenement) {
        if (!this.supportSurvol(evenement) || Jeu.etatPartie !== 'enCours') {
            this.caseSurvolee = null;
            return;
        }
        this.caseSurvolee = this.convertirEvenementEnCase(evenement);
    },

    tenterConstruireTour(colonne, ligne) {
        if (!Carte.estConstructible(colonne, ligne)) {
            this.afficherMessageConstruction('Case invalide');
            return;
        }

        // Contrainte (modification) : toutes les tours doivent être adjacentes à un chemin.
        if (!Carte.estAdjacentAUnChemin(colonne, ligne)) {
            this.afficherMessageConstruction('Doit être adjacent à un chemin');
            return;
        }

        // Une Caserne seulement voisine de l'entrée d'un chemin n'aurait aucun point
        // de blocage utile (voir Carte.candidatsBlocagePourCaserne) : refusée plutôt
        // que de faire payer une tour qui ne servirait jamais.
        if (!this.caserneAUnPointDeBlocage(this.typeSelectionne, colonne, ligne)) {
            this.afficherMessageConstruction('Aucune case à bloquer ici (entrée de chemin)');
            return;
        }

        // Limite de tours (phase 6B) : vérifiée avant le coût, comme les crédits —
        // aucune tour ne peut être construite au-delà de Jeu.limiteTours, même si les
        // crédits le permettraient largement. Vendre une tour libère naturellement un
        // emplacement puisque cette vérification porte sur toursActives.length à
        // chaque tentative, recalculé à chaque appel.
        if (Jeu.toursActives.length >= Jeu.limiteTours) {
            this.afficherMessageConstruction('Limite de tours atteinte');
            return;
        }

        const cout = this.coutConstruction(this.typeSelectionne);
        if (Jeu.credits < cout) {
            this.afficherMessageConstruction('Crédits insuffisants');
            return;
        }

        const tour = new Tour(colonne, ligne, this.typeSelectionne);
        Jeu.toursActives.push(tour);
        Carte.grille[ligne][colonne] = 'OCCUPEE';
        Jeu.credits -= cout;
        Statistiques.toursConstruites++;
        Son.jouerConstruction();

        // Choix du point de blocage d'une Caserne (contenu additionnel
        // post-lancement) : `candidatsBlocageEnAttente` n'est posé par le
        // constructeur de Tour que lorsque plusieurs cases de chemin sont
        // adjacentes — jamais dans le cas simple à une seule candidate, qui reste
        // résolu automatiquement comme avant cette phase, sans passer par cet état
        // d'attente.
        if (tour.candidatsBlocageEnAttente) {
            this.caserneEnAttenteChoix = { tour, candidats: tour.candidatsBlocageEnAttente };
            this.afficherMessageConstruction('Choisissez la case à bloquer (en surbrillance)');
        }
        // Sans effet en pleine vague ou pendant le choix ci-dessus (voir
        // SauvegardePartie.peutEnregistrer).
        SauvegardePartie.enregistrer();
    },

    // Vrai pour tout type autre que la Caserne ; pour elle, vrai seulement si au
    // moins une case de chemin voisine peut accueillir son unité. Partagée par la
    // construction et l'aperçu, pour qu'une case refusée au clic s'affiche aussi en
    // rouge au survol.
    caserneAUnPointDeBlocage(type, colonne, ligne) {
        return type !== 'caserne' || Carte.candidatsBlocagePourCaserne(colonne, ligne).length > 0;
    },

    // Résout le choix du joueur pour le point de blocage d'une Caserne en attente
    // (contenu additionnel post-lancement) : un clic hors des cases candidates
    // (`choisi` alors `undefined`) n'a strictement aucun effet, conformément au
    // comportement demandé (pas d'annulation possible une fois la Caserne
    // construite et payée) — seul un clic sur l'une des cases en surbrillance fait
    // avancer l'état du jeu.
    resoudreChoixBlocageCaserne(colonne, ligne) {
        const { tour, candidats } = this.caserneEnAttenteChoix;
        const choisi = candidats.find(c => c.colonne === colonne && c.ligne === ligne);
        if (!choisi) return;

        tour.resoudreChoixBlocage(choisi);
        this.caserneEnAttenteChoix = null;
        SauvegardePartie.enregistrer();
    },

    // Affiche un message temporaire superposé au HUD, 1,5 seconde par défaut — les
    // messages d'erreur de construction ci-dessus l'utilisent tel quel. `duree`
    // permet de le réutiliser pour un cas différent sans dupliquer ce mécanisme
    // (phase 7G) : Vagues.demarrer l'appelle avec une durée de 3 secondes pour son
    // bandeau « ⚠ VAGUE DE BOSS », plus long pour rester bien visible malgré son
    // caractère plus exceptionnel qu'une simple erreur de construction — d'où le nom
    // de cette méthode, conservé tel quel plutôt que renommé, qui ne reflète donc plus
    // exactement tous ses appelants.
    // `positif` (octobre 2026) : affiche le message en vert plutôt qu'en rouge, pour
    // une bonne nouvelle (bonus d'appel anticipé, partie reprise).
    afficherMessageConstruction(texte, duree = 1.5, positif = false) {
        this.elementMessageConstruction.textContent = texte;
        this.elementMessageConstruction.classList.toggle('message-positif', positif);
        this.dureeRestanteMessageConstruction = duree;
    },

    // Dessine, par-dessus tout le reste (carte, tours, ennemis, projectiles), l'aperçu
    // de construction sous la case survolée : contour vert si la case est
    // constructible et les crédits suffisants, rouge sinon, plus un cercle
    // semi-transparent représentant la portée de la tour à construire. Détourné
    // (contenu additionnel post-lancement) pour dessiner plutôt la surbrillance des
    // cases candidates pendant un choix de blocage de Caserne en attente — aucun
    // aperçu de construction normal n'a de sens tant que ce choix n'est pas résolu,
    // seule interaction encore possible sur le plateau (voir gererClicCanvas).
    dessinerApercuConstruction(ctx) {
        this.dessinerSelectionTour(ctx);

        if (this.caserneEnAttenteChoix) {
            this.dessinerSurbrillanceChoixCaserne(ctx);
            return;
        }

        if (!this.caseSurvolee) return;

        const { colonne, ligne } = this.caseSurvolee;
        if (!Carte.dansLaGrille(colonne, ligne)) return;

        const taille = Carte.tailleCase;
        const x = colonne * taille;
        const y = ligne * taille;
        const caracteristiques = Config.TYPES_TOURS[this.typeSelectionne];
        // Phase 6B : une case par ailleurs 'LIBRE' n'est plus constructible une fois la
        // limite de tours atteinte — l'aperçu doit donc rester rouge sur cette case
        // même si elle reste visuellement libre, jusqu'à ce qu'une tour soit vendue.
        const limiteAtteinte = Jeu.toursActives.length >= Jeu.limiteTours;
        // Modification : toutes les tours doivent être adjacentes à un chemin.
        const adjacenceRespectee = Carte.estAdjacentAUnChemin(colonne, ligne);
        const constructible = Carte.estConstructible(colonne, ligne)
            && Jeu.credits >= this.coutConstruction(this.typeSelectionne)
            && !limiteAtteinte
            && adjacenceRespectee
            && this.caserneAUnPointDeBlocage(this.typeSelectionne, colonne, ligne);

        ctx.strokeStyle = constructible ? '#2ecc71' : '#e74c3c';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, taille - 2, taille - 2);

        const centre = Carte.caseVersPixels(colonne, ligne);
        const rayon = caracteristiques.portee * Jeu.facteurEchelle;

        ctx.fillStyle = 'rgba(58, 142, 230, 0.15)';
        ctx.beginPath();
        ctx.arc(centre.x, centre.y, rayon, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(58, 142, 230, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
    },

    // Tour sélectionnée (panneau d'amélioration ouvert) : contour de sa case et cercle
    // de sa portée actuelle, pour voir ce qu'elle couvre et ce qu'une amélioration
    // changerait. Pour une Caserne, qui ne tire pas, c'est plutôt la case de chemin
    // bloquée par son soldat qui est entourée.
    dessinerSelectionTour(ctx) {
        const tour = this.tourSelectionnee;
        if (!tour) return;

        const taille = Carte.tailleCase;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(tour.colonne * taille + 1, tour.ligne * taille + 1, taille - 2, taille - 2);

        if (tour.typeDegats === 'caserne') {
            if (tour.cheminIndex === null) return;
            const caseBloquee = Carte.chemins[tour.cheminIndex].chemin[tour.indexPointDePassage];
            ctx.strokeStyle = Config.COULEURS.neonBleu;
            ctx.setLineDash([5, 4]);
            ctx.strokeRect(caseBloquee.colonne * taille + 2, caseBloquee.ligne * taille + 2, taille - 4, taille - 4);
            ctx.setLineDash([]);
            return;
        }

        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.beginPath();
        ctx.arc(tour.x, tour.y, tour.portee * Jeu.facteurEchelle, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    },

    // Met en surbrillance chaque case candidate pendant un choix de blocage de
    // Caserne en attente (contenu additionnel post-lancement) — un contour distinct
    // dans Config.COULEURS.neonBleu, la couleur déjà associée à la Caserne (phase
    // 7E), pour rester cohérent avec son identité visuelle plutôt que réutiliser le
    // vert/rouge de l'aperçu de construction normal, qui signifierait ici tout
    // autre chose (permis/refusé plutôt que « choisissez-moi »).
    dessinerSurbrillanceChoixCaserne(ctx) {
        const taille = Carte.tailleCase;
        ctx.strokeStyle = Config.COULEURS.neonBleu;
        ctx.lineWidth = 3;
        for (const candidat of this.caserneEnAttenteChoix.candidats) {
            const x = candidat.colonne * taille;
            const y = candidat.ligne * taille;
            ctx.strokeRect(x + 2, y + 2, taille - 4, taille - 4);
        }
    },

    // Déduit le coût du palier suivant et améliore la tour sélectionnée. Ne fait rien
    // si aucune tour n'est sélectionnée, si le niveau maximum est atteint (coût null)
    // ou si les crédits sont insuffisants : Tour.ameliorer() ne vérifie pas elle-même
    // les crédits, c'est le rôle de l'appelant.
    ameliorerTourSelectionnee() {
        const tour = this.tourSelectionnee;
        if (!tour) return;

        const cout = tour.coutAmelioration();
        if (cout === null || Jeu.credits < cout) return;

        Jeu.credits -= cout;
        tour.ameliorer();
        Son.jouerAmelioration();
        SauvegardePartie.enregistrer();
    },

    // Fait passer la tour sélectionnée au mode de ciblage suivant (bouton « Cible »
    // du panneau, ou touche C). Sans effet pour la Caserne et le Gel, qui ne tirent
    // pas.
    changerCiblageTourSelectionnee() {
        const tour = this.tourSelectionnee;
        if (!tour || tour.typeDegats === 'caserne' || tour.typeDegats === 'gel') return;
        tour.changerModeCiblage();
        SauvegardePartie.enregistrer();
    },

    // Rembourse un pourcentage de l'investissement total de la tour sélectionnée,
    // la retire du jeu et libère sa case pour une nouvelle construction.
    vendreTourSelectionnee() {
        const tour = this.tourSelectionnee;
        if (!tour) return;

        Jeu.credits += tour.montantVente();

        const index = Jeu.toursActives.indexOf(tour);
        if (index !== -1) {
            Jeu.toursActives.splice(index, 1);
        }
        Carte.grille[tour.ligne][tour.colonne] = 'LIBRE';

        this.tourSelectionnee = null;
        Son.jouerVente();
        SauvegardePartie.enregistrer();
    },

    // Rafraîchit le contenu du panneau d'amélioration/vente d'après la tour
    // actuellement sélectionnée. Rappelée à chaque frame par mettreAJourEcrans
    // (comme mettreAJourBoutonsTypesTours) puisque les crédits changent en continu et
    // que les statistiques affichées doivent immédiatement refléter une amélioration.
    mettreAJourPanneauAmelioration() {
        const tour = this.tourSelectionnee;
        if (!tour) return;

        const nom = Config.TYPES_TOURS[tour.type].nom;
        this.ecrireSiChange(this.elementPanneauTitre, 'textContent', `${nom} — Niveau ${tour.niveau}`);

        // Le panneau, dans un coin du plateau, ne doit pas cacher la tour qu'il décrit
        // ni le cercle de sa portée : pour une tour dans la moitié droite, il passe à
        // gauche.
        this.panneauAmelioration.classList.toggle('panneau-a-gauche', tour.colonne >= Config.COLONNES / 2);

        // La Caserne (phase 7E) ne tire jamais : Dégâts/Cadence/Portée n'auraient
        // aucun sens pour elle (this.cadence/this.degats existent bien sur l'instance,
        // voir la note sur TYPES_TOURS.caserne dans config.js, mais pilotent le délai
        // de réapparition et les stats de l'unité, pas un tir) — affiche à la place
        // les stats de son unité au niveau actuel, qu'elle soit vivante ou en attente
        // de réapparition (toujours celles du niveau courant, jamais figées à
        // l'apparition, pour refléter une amélioration même pendant l'attente).
        if (tour.typeDegats === 'caserne') {
            const stats = tour.statsUniteAuNiveauActuel();
            const delai = Config.CASERNE_DELAI_RESPAWN_BASE
                / (Config.AMELIORATION_MULTIPLICATEUR_CADENCE ** (tour.niveau - 1));
            this.ecrireSiChange(this.elementPanneauStats, 'textContent',
                `Points de vie de l'unité : ${stats.pointsDeVieMax} · `
                + `Dégâts de l'unité : ${Math.round(stats.degats)} · `
                + `Délai de réapparition : ${delai.toFixed(1)}s`);
        } else if (tour.typeDegats === 'gel') {
            this.ecrireSiChange(this.elementPanneauStats, 'textContent',
                `Ralentissement : ${Math.round(tour.forceRalentissement() * 100)} % · Portée : ${Math.round(tour.portee)}`);
        } else {
            this.ecrireSiChange(this.elementPanneauStats, 'textContent',
                `Dégâts : ${Math.round(tour.degats)} · Cadence : ${tour.cadence.toFixed(2)}/s · Portée : ${Math.round(tour.portee)}`);
        }

        // Choix de la cible : seulement pour les tours qui tirent.
        const tire = tour.typeDegats !== 'caserne' && tour.typeDegats !== 'gel';
        this.ecrireSiChange(this.boutonCiblage, 'hidden', !tire);
        if (tire) {
            const mode = Config.MODES_CIBLAGE.find(m => m.id === tour.modeCiblage);
            this.ecrireSiChange(this.boutonCiblage, 'textContent', `Cible : ${mode.nom}`);
        }

        const coutAmelioration = tour.coutAmelioration();
        if (coutAmelioration === null) {
            this.ecrireSiChange(this.boutonAmeliorer, 'hidden', true);
            this.ecrireSiChange(this.elementNiveauMax, 'hidden', false);
        } else {
            this.ecrireSiChange(this.boutonAmeliorer, 'hidden', false);
            this.ecrireSiChange(this.elementNiveauMax, 'hidden', true);
            this.ecrireSiChange(this.boutonAmeliorer, 'textContent', `Améliorer (coût : ${coutAmelioration})`);
            this.ecrireSiChange(this.boutonAmeliorer, 'disabled', Jeu.credits < coutAmelioration);
        }

        this.ecrireSiChange(this.boutonVendre, 'textContent', `Vendre (+${tour.montantVente()} crédits)`);
    },

    // Affiche le niveau du joueur et sa progression vers le suivant sur l'écran
    // d'accueil (Progression, phase 3A). Au niveau maximum, la barre n'a plus de sens
    // (aucun seuil suivant) : elle est remplacée par un texte dédié plutôt que
    // laissée à 100 % ou vide, ce qui serait ambigu avec « pas encore de progression ».
    mettreAJourProgressionAccueil() {
        this.ecrireSiChange(this.elementNiveauJoueurActuel, 'textContent', Progression.niveau);

        const seuil = Progression.seuilNiveauSuivant();
        const auNiveauMax = seuil === null;
        this.ecrireSiChange(this.elementBarreXpConteneur, 'hidden', auNiveauMax);
        this.ecrireSiChange(this.elementTexteNiveauMaxJoueur, 'hidden', !auNiveauMax);

        if (!auNiveauMax) {
            // Comparée à la dernière valeur écrite plutôt qu'à style.width, que le
            // navigateur relit sous une forme arrondie (jamais égale à la chaîne écrite).
            const largeur = `${(Progression.xpActuelle / seuil) * 100}%`;
            if (this.largeurBarreXpAffichee !== largeur) {
                this.elementBarreXpRemplissage.style.width = largeur;
                this.largeurBarreXpAffichee = largeur;
            }
        }

        // Un palier débloqué le reste pour toujours (voir Progression.estDebloque) :
        // ce rafraîchissement par frame est donc surtout utile juste après un
        // passage de niveau (retour de l'écran de victoire/défaite à l'accueil),
        // pas parce que l'état changerait pendant que l'accueil est déjà affiché.
        // Resté volontairement hors périmètre de la phase 4B (particules et son) :
        // un effet dédié au déblocage d'un palier se déclencherait à l'accueil, pas
        // pendant la simulation, et n'a pas été demandé parmi les points de
        // déclenchement de cette phase (voir ARCHITECTURE.md, section 4B).
        const paliers = Progression.listePaliers();
        for (let i = 0; i < paliers.length; i++) {
            const palier = paliers[i];
            const element = this.elementsPaliersBonus[i];
            element.classList.toggle('palier-debloque', palier.debloque);
            element.classList.toggle('palier-verrouille', !palier.debloque);
            this.ecrireSiChange(element, 'textContent', palier.debloque
                ? `✓ ${palier.description}`
                : `🔒 ${palier.description} — niveau ${palier.niveauRequis}`);
        }
    },

    // Rafraîchit l'encart du défi du jour sur l'écran d'accueil (contenu
    // additionnel post-lancement) : date lisible du jour et meilleure vague déjà
    // atteinte aujourd'hui, ou une mention dédiée si aucun essai n'a encore eu
    // lieu aujourd'hui (Progression.defiDuJour.date ne correspond alors pas à la
    // date actuelle — voir dateDuJourChaine, config.js). Rappelée chaque frame par
    // mettreAJourEcrans, comme mettreAJourProgressionAccueil juste au-dessus et
    // pour la même raison : à jour dès le retour à l'accueil après un essai, sans
    // dépendre d'un rafraîchissement explicite au moment précis où la partie se
    // termine.
    mettreAJourDefiDuJour() {
        this.ecrireSiChange(this.elementDefiDuJourDate, 'textContent', dateDuJourLisible());

        const tenteAujourdhui = Progression.defiDuJour.date === dateDuJourChaine();
        this.ecrireSiChange(this.elementDefiDuJourScore, 'textContent', tenteAujourdhui
            ? `Meilleure vague : ${Progression.defiDuJour.meilleureVague}`
            : 'Pas encore tenté aujourd\'hui');
        this.ecrireSiChange(this.boutonPartagerDefi, 'hidden', !tenteAujourdhui);
    },

    // Bouton « Reprendre la partie » de l'écran d'accueil, visible seulement si une
    // partie a été laissée en cours (voir sauvegarde.js), avec sa durée et la vague
    // qui l'attend.
    mettreAJourReprise() {
        const donnees = SauvegardePartie.donnees;
        this.ecrireSiChange(this.boutonReprendre, 'hidden', !donnees);
        if (!donnees) return;

        const duree = Config.DUREES_PARTIE.find(d => d.id === donnees.idDuree);
        const nom = donnees.modeDefiDuJour && donnees.graine === calculerGraineDuJour()
            ? 'Défi du jour'
            : (duree ? duree.label : '');
        const difficulte = donnees.difficulteSuperieure ? ', supérieure' : '';
        this.ecrireSiChange(this.boutonReprendre, 'textContent',
            `Reprendre la partie (${nom}${difficulte}, vague ${donnees.numeroVague + 1})`);
    },

    // Partage du score du défi du jour (octobre 2026) : la fenêtre de partage du
    // téléphone quand elle existe, sinon une copie dans le presse-papiers, confirmée
    // sur le bouton lui-même.
    async partagerDefi(bouton, vague) {
        const texte = `Défense Néon — défi du ${dateDuJourLisible()} : j'ai atteint la vague ${vague} !`;
        // Sous file://, l'adresse ne servirait à personne d'autre : on ne la partage pas.
        const adresse = location.protocol.startsWith('http') ? location.origin + location.pathname : '';

        if (navigator.share) {
            try {
                await navigator.share(adresse ? { title: 'Défense Néon', text: texte, url: adresse } : { title: 'Défense Néon', text: texte });
                return;
            } catch (erreur) {
                // Le joueur a refermé la fenêtre de partage : rien de plus à faire.
                if (erreur.name === 'AbortError') return;
            }
        }

        const copie = await this.copierTexte(adresse ? `${texte} ${adresse}` : texte);
        this.confirmerSurBouton(bouton, copie ? 'Copié dans le presse-papiers !' : 'Copie impossible');
    },

    // Copie un texte dans le presse-papiers. L'API moderne n'existe que sur une page
    // sécurisée (https ou localhost) : sinon, ancienne méthode via une zone de texte
    // invisible.
    async copierTexte(texte) {
        try {
            await navigator.clipboard.writeText(texte);
            return true;
        } catch {
            const zone = document.createElement('textarea');
            zone.value = texte;
            zone.setAttribute('readonly', '');
            zone.style.position = 'fixed';
            zone.style.opacity = '0';
            document.body.appendChild(zone);
            zone.select();
            let copie = false;
            try {
                copie = document.execCommand('copy');
            } catch {
                copie = false;
            }
            zone.remove();
            return copie;
        }
    },

    // Remplace un instant le libellé d'un bouton par un message de confirmation.
    confirmerSurBouton(bouton, texte) {
        if (!bouton.dataset.libelle) bouton.dataset.libelle = bouton.textContent;
        bouton.textContent = texte;
        clearTimeout(bouton.minuteurConfirmation);
        bouton.minuteurConfirmation = setTimeout(() => {
            bouton.textContent = bouton.dataset.libelle;
        }, 2000);
    },

    // Statistiques de la partie qui vient de se terminer (voir Statistiques), sur
    // l'écran de victoire ou de défaite. Appelée une seule fois, par
    // Jeu.finaliserPartie : ces chiffres ne changent plus ensuite.
    afficherStatistiques(estVictoire) {
        const conteneur = estVictoire ? this.elementStatistiquesVictoire : this.elementStatistiquesDefaite;
        const nombre = (valeur) => Math.round(valeur).toLocaleString('fr-FR');
        const ajouterLigne = (texte) => {
            const paragraphe = document.createElement('p');
            paragraphe.textContent = texte;
            conteneur.appendChild(paragraphe);
        };
        conteneur.replaceChildren();

        const boss = Statistiques.eliminationsParType.boss || 0;
        ajouterLigne(`Ennemis détruits : ${nombre(Statistiques.totalEliminations())}`
            + (boss > 0 ? ` (dont ${boss} boss)` : '')
            + ` · passés : ${Statistiques.ennemisPasses}`);
        ajouterLigne(`Crédits gagnés : ${nombre(Statistiques.creditsGagnes)} · tours construites : ${Statistiques.toursConstruites}`);
        if (Statistiques.vaguesAppeleesEnAvance > 0) {
            ajouterLigne(`Vagues appelées en avance : ${Statistiques.vaguesAppeleesEnAvance}`);
        }

        // Part des dégâts de chaque type de tour, en barres horizontales : la tour la
        // plus utile de la partie saute aux yeux.
        const classement = Statistiques.classementTours();
        if (classement.length === 0) return;
        ajouterLigne('Dégâts infligés par type de tour :');
        const liste = document.createElement('ul');
        liste.className = 'graphique-degats';
        for (const { type, degats, part } of classement) {
            const element = document.createElement('li');
            const nom = document.createElement('span');
            nom.textContent = Config.TYPES_TOURS[type].nom;
            const barre = document.createElement('span');
            barre.className = 'graphique-degats-barre';
            const remplissage = document.createElement('span');
            remplissage.style.width = `${Math.max(2, part * 100)}%`;
            // Couleur de la tour (mots-clés CSS ou valeurs hexadécimales, tous valides ici).
            remplissage.style.background = Config.TYPES_TOURS[type].couleur;
            barre.appendChild(remplissage);
            const valeur = document.createElement('span');
            valeur.textContent = `${Math.round(part * 100)} %`;
            valeur.title = `${nombre(degats)} dégâts`;
            element.append(nom, barre, valeur);
            liste.appendChild(element);
        }
        conteneur.appendChild(liste);
    },

    // Affiche l'XP gagnée pendant la partie qui vient de se terminer et, le cas
    // échéant, une mention de passage de niveau, à partir de Jeu.derniereProgression
    // (renseignée une seule fois par Jeu.finaliserPartie, juste avant que l'écran
    // correspondant ne devienne visible). `elementXp` et `elementNiveauSuperieur` sont
    // les éléments de l'écran de victoire ou de défaite, selon lequel vient de s'afficher.
    // `elementDifficulte` (contenu additionnel post-lancement) : mention « Difficulté
    // supérieure », affichée uniquement si la partie qui vient de se terminer l'était
    // (resume.difficulteSuperieure, copiée depuis Jeu.difficulteSuperieure au moment
    // de finaliserPartie) — jamais un indicateur permanent dans le HUD, qui est déjà
    // chargé depuis les phases précédentes, uniquement ce rappel ponctuel en fin de
    // partie.
    afficherResumeProgression(elementXp, elementNiveauSuperieur, elementDifficulte) {
        const resume = Jeu.derniereProgression;
        if (!resume) return;

        this.ecrireSiChange(elementXp, 'textContent', resume.xpGagnee);

        this.ecrireSiChange(elementNiveauSuperieur, 'hidden', resume.niveauxGagnes === 0);
        if (resume.niveauxGagnes > 0) {
            this.ecrireSiChange(elementNiveauSuperieur, 'textContent', `Niveau supérieur ! ${resume.niveauAvant} → ${resume.niveauApres}`);
        }

        this.ecrireSiChange(elementDifficulte, 'hidden', !resume.difficulteSuperieure);
    },

    // Rappelée chaque frame par Jeu.boucle, quel que soit l'état de la partie : bascule
    // la visibilité des écrans superposés et du HUD, et met à jour leur contenu.
    // `dt` est le temps réel écoulé (non affecté par Jeu.vitesseJeu), pour que le
    // minuteur du message de construction ne soit pas accéléré par la vitesse ×2.
    mettreAJourEcrans(dt) {
        this.ecrireSiChange(this.ecranAccueil, 'hidden', Jeu.etatPartie !== 'accueil');
        this.ecrireSiChange(this.ecranVictoire, 'hidden', Jeu.etatPartie !== 'victoire');
        this.ecrireSiChange(this.ecranDefaite, 'hidden', Jeu.etatPartie !== 'defaite');
        // Sur téléphone en portrait, la hauteur minimale réservée aux écrans
        // superposés ne s'applique que lorsqu'un écran est affiché (voir
        // .conteneur-canvas.ecran-affiche, style.css) : en partie, elle repoussait
        // tout le HUD sous le bord de l'écran.
        this.conteneurCanvas.classList.toggle('ecran-affiche', Jeu.etatPartie !== 'enCours');
        this.ecrireSiChange(this.conteneurHUD, 'hidden', Jeu.etatPartie !== 'enCours');
        this.ecrireSiChange(this.conteneurTypesTours, 'hidden', Jeu.etatPartie !== 'enCours');
        // Masqué en dehors de 'enCours' même si une tour restait sélectionnée (ex. la
        // partie se termine pendant que le panneau est ouvert) : mettreAJourPanneauAmelioration
        // n'est appelée que dans le bloc 'enCours' ci-dessous, donc son contenu ne
        // serait plus rafraîchi une fois la partie terminée sans cette ligne.
        this.ecrireSiChange(this.panneauAmelioration, 'hidden', Jeu.etatPartie !== 'enCours' || this.tourSelectionnee === null);

        this.ecrireSiChange(this.elementFicheTour, 'hidden', Jeu.etatPartie !== 'enCours');

        if (Jeu.etatPartie === 'accueil') {
            this.mettreAJourProgressionAccueil();
            this.mettreAJourDefiDuJour();
            this.mettreAJourReprise();
        }

        if (Jeu.etatPartie === 'enCours') {
            this.ecrireSiChange(this.elementCredits, 'textContent', Jeu.credits);
            this.ecrireSiChange(this.elementIntegrite, 'textContent', Jeu.integrite);
            this.ecrireSiChange(this.elementNombreTours, 'textContent', `${Jeu.toursActives.length} / ${Jeu.limiteTours}`);
            this.ecrireSiChange(this.elementGraine, 'textContent', Aleatoire.graineActuelle);
            this.ecrireSiChange(this.elementNumeroVague, 'textContent', Number.isFinite(Jeu.nombreDeVagues)
                ? `${Vagues.numeroVagueActuelle} / ${Jeu.nombreDeVagues}`
                : `${Vagues.numeroVagueActuelle} / ∞`);
            this.mettreAJourLancementVague();
            this.ecrireSiChange(this.boutonPause, 'textContent', Jeu.enPause ? 'Reprendre' : 'Pause');
            this.ecrireSiChange(this.boutonVitesse, 'textContent', `Vitesse ×${Jeu.vitesseJeu}`);
            // Les crédits changent en continu (récompenses, bonus de fin de vague) :
            // les boutons de type doivent donc être réévalués chaque frame, pas
            // seulement au moment où le joueur change de sélection.
            this.mettreAJourBoutonsTypesTours();
            this.mettreAJourFicheTour();
            this.mettreAJourPanneauAmelioration();
        }

        if (Jeu.etatPartie === 'victoire') {
            this.ecrireSiChange(this.elementVaguesFranchisesVictoire, 'textContent', Vagues.numeroVagueActuelle);
            this.ecrireSiChange(this.elementIntegriteRestanteVictoire, 'textContent', Jeu.integrite);
            this.afficherResumeProgression(this.elementXpGagneeVictoire, this.elementNiveauSuperieurVictoire, this.elementDifficulteSuperieureVictoire);
        }

        if (Jeu.etatPartie === 'defaite') {
            this.ecrireSiChange(this.elementVagueAtteinteDefaite, 'textContent', Vagues.numeroVagueActuelle);
            // En mode Sans fin, la vague atteinte est le score final du joueur : on
            // la met en évidence plutôt que de l'afficher comme une simple statistique.
            this.elementVagueAtteinteDefaite.classList.toggle('score-sansfin', !Number.isFinite(Jeu.nombreDeVagues));
            this.afficherResumeProgression(this.elementXpGagneeDefaite, this.elementNiveauSuperieurDefaite, this.elementDifficulteSuperieureDefaite);
            this.ecrireSiChange(this.boutonPartagerDefaite, 'hidden',
                !(Jeu.derniereProgression && Jeu.derniereProgression.modeDefiDuJour));
        }

        if (this.dureeRestanteMessageConstruction > 0) {
            this.dureeRestanteMessageConstruction -= dt;
            if (this.dureeRestanteMessageConstruction <= 0) {
                this.elementMessageConstruction.textContent = '';
            }
        }
    }
};
