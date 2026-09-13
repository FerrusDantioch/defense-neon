// interface.js — Tout ce qui concerne l'affichage et les interactions : écrans
// superposés (accueil, victoire, défaite), HUD en cours de partie, clics et survol
// sur le canvas (construction de tours, aperçu), messages temporaires. jeu.js ne
// conserve que l'état de la partie et la boucle de simulation ; les deux fichiers
// s'appellent mutuellement (Interface déclenche des actions sur Jeu, Jeu demande à
// Interface de se redessiner chaque frame), ce qui est sans risque ici : ni l'un ni
// l'autre n'exécute de code au chargement, tout se déclenche après l'initialisation.

const Interface = {
    // Écrans superposés au canvas.
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
    boutonSon: null,
    elementMessageConstruction: null,

    // Écran d'accueil.
    boutonsDuree: [],
    elementDescriptionDuree: null,
    boutonJouer: null,
    // Durée sélectionnée à l'accueil, retenue pour la session (pas besoin de survivre
    // à un rechargement de page) : une simple variable suffit.
    idDureeSelectionnee: Config.DUREE_PAR_DEFAUT,

    // Niveau/XP du joueur sur l'écran d'accueil (phase 3A, voir Progression).
    elementNiveauJoueurActuel: null,
    elementBarreXpConteneur: null,
    elementBarreXpRemplissage: null,
    elementTexteNiveauMaxJoueur: null,

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

    // Minuteur (secondes restantes, en temps réel — voir mettreAJourEcrans) du
    // message de construction affiché dans le HUD ("Case invalide", etc.).
    dureeRestanteMessageConstruction: 0,

    initialiser() {
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
        this.elementMessageConstruction = document.getElementById('message-construction');

        // Bouton Son (phase 4B) : placé hors de #barre-hud dans le HTML précisément
        // parce qu'il doit rester visible à tout moment (y compris à l'accueil, avant
        // même qu'une partie ne démarre), alors que #barre-hud est masqué en dehors de
        // 'enCours' (voir mettreAJourEcrans) — jamais soumis à cette bascule.
        this.boutonSon = document.getElementById('bouton-son');
        this.mettreAJourBoutonSon();
        this.boutonSon.addEventListener('click', () => {
            Son.basculer();
            this.mettreAJourBoutonSon();
        });

        this.elementDescriptionDuree = document.getElementById('description-duree');
        this.boutonJouer = document.getElementById('bouton-jouer');

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
        this.elementVagueAtteinteDefaite = document.getElementById('vague-atteinte-defaite');
        this.elementXpGagneeDefaite = document.getElementById('xp-gagnee-defaite');
        this.elementNiveauSuperieurDefaite = document.getElementById('niveau-superieur-defaite');

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

        // Les boutons de type de tour sont générés depuis Config.TYPES_TOURS, pour la
        // même raison que ceux de durée : ne jamais avoir deux sources de vérité.
        this.conteneurTypesTours = document.getElementById('barre-types-tours');
        for (const [type, caracteristiques] of Object.entries(Config.TYPES_TOURS)) {
            const bouton = document.createElement('button');
            bouton.type = 'button';
            bouton.textContent = `${caracteristiques.nom} — ${caracteristiques.cout}`;
            bouton.dataset.typeTour = type;
            bouton.addEventListener('click', () => this.selectionnerTypeTour(type));
            this.conteneurTypesTours.appendChild(bouton);
        }
        this.boutonsTypesTours = Array.from(this.conteneurTypesTours.querySelectorAll('button'));
        this.selectionnerTypeTour(Config.TYPE_TOUR_PAR_DEFAUT);

        this.panneauAmelioration = document.getElementById('panneau-amelioration');
        this.elementPanneauTitre = document.getElementById('panneau-titre');
        this.elementPanneauStats = document.getElementById('panneau-stats');
        this.boutonAmeliorer = document.getElementById('bouton-ameliorer');
        this.elementNiveauMax = document.getElementById('panneau-niveau-max');
        this.boutonVendre = document.getElementById('bouton-vendre');

        this.boutonAmeliorer.addEventListener('click', () => this.ameliorerTourSelectionnee());
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
            Jeu.demarrerPartie(this.idDureeSelectionnee);
        });

        for (const bouton of document.querySelectorAll('.bouton-rejouer')) {
            bouton.addEventListener('click', () => Jeu.rejouer());
        }
        for (const bouton of document.querySelectorAll('.bouton-changer-duree')) {
            bouton.addEventListener('click', () => Jeu.retourAccueil());
        }

        this.boutonLancerVague.addEventListener('click', () => {
            Vagues.demarrer(Vagues.numeroVagueActuelle + 1);
        });

        // Bouton unique Pause/Reprendre : agit sur la même variable Jeu.enPause que
        // la pause automatique déclenchée par visibilitychange (dans jeu.js), sans
        // logique séparée entre les deux.
        this.boutonPause.addEventListener('click', () => {
            Jeu.enPause = !Jeu.enPause;
        });

        this.boutonVitesse.addEventListener('click', () => {
            Jeu.vitesseJeu = Jeu.vitesseJeu === 1 ? 2 : 1;
        });

        // Un tap construit directement sur tactile, exactement comme en phase 1C ;
        // le survol (pointermove) n'a d'effet que sur les appareils avec une vraie
        // souris (voir supportSurvol) et alimente uniquement l'aperçu visuel.
        Jeu.canvas.addEventListener('pointerdown', evenement => this.gererClicCanvas(evenement));
        Jeu.canvas.addEventListener('pointermove', evenement => this.gererSurvolCanvas(evenement));
        Jeu.canvas.addEventListener('pointerleave', () => {
            this.caseSurvolee = null;
        });
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

    // Libellé du bouton Son (phase 4B), rafraîchi immédiatement après chaque clic —
    // pas besoin d'un rafraîchissement par frame comme mettreAJourBoutonsTypesTours,
    // puisque rien d'autre que ce clic ne fait changer Son.actif.
    mettreAJourBoutonSon() {
        this.boutonSon.textContent = Son.actif ? 'Son : ON' : 'Son : OFF';
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
            bouton.textContent = `${Config.TYPES_TOURS[type].nom} — ${cout}`;
            bouton.classList.toggle('selectionne', type === this.typeSelectionne);
            bouton.disabled = limiteAtteinte || Jeu.credits < cout;
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
    // construit normalement (et ferme le panneau s'il était ouvert), une case de
    // chemin se contente de fermer le panneau sans autre effet.
    gererClicCanvas(evenement) {
        if (Jeu.etatPartie !== 'enCours' || Jeu.enPause) return;

        const { colonne, ligne } = this.convertirEvenementEnCase(evenement);
        if (!Carte.dansLaGrille(colonne, ligne)) return;

        const etat = Carte.grille[ligne][colonne];
        if (etat === 'OCCUPEE') {
            this.tourSelectionnee = Jeu.toursActives.find(
                tour => tour.colonne === colonne && tour.ligne === ligne
            ) || null;
        } else if (etat === 'LIBRE') {
            this.tourSelectionnee = null;
            this.tenterConstruireTour(colonne, ligne);
        } else {
            this.tourSelectionnee = null;
        }
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

        Jeu.toursActives.push(new Tour(colonne, ligne, this.typeSelectionne));
        Carte.grille[ligne][colonne] = 'OCCUPEE';
        Jeu.credits -= cout;
        Son.jouerConstruction();
    },

    // Affiche un message de construction temporaire (1,5 seconde) superposé au HUD.
    afficherMessageConstruction(texte) {
        this.elementMessageConstruction.textContent = texte;
        this.dureeRestanteMessageConstruction = 1.5;
    },

    // Dessine, par-dessus tout le reste (carte, tours, ennemis, projectiles), l'aperçu
    // de construction sous la case survolée : contour vert si la case est
    // constructible et les crédits suffisants, rouge sinon, plus un cercle
    // semi-transparent représentant la portée de la tour à construire.
    dessinerApercuConstruction(ctx) {
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
        const constructible = Carte.estConstructible(colonne, ligne)
            && Jeu.credits >= this.coutConstruction(this.typeSelectionne)
            && !limiteAtteinte;

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
    },

    // Rafraîchit le contenu du panneau d'amélioration/vente d'après la tour
    // actuellement sélectionnée. Rappelée à chaque frame par mettreAJourEcrans
    // (comme mettreAJourBoutonsTypesTours) puisque les crédits changent en continu et
    // que les statistiques affichées doivent immédiatement refléter une amélioration.
    mettreAJourPanneauAmelioration() {
        const tour = this.tourSelectionnee;
        if (!tour) return;

        const nom = Config.TYPES_TOURS[tour.type].nom;
        this.elementPanneauTitre.textContent = `${nom} — Niveau ${tour.niveau}`;
        this.elementPanneauStats.textContent =
            `Dégâts : ${Math.round(tour.degats)} · Cadence : ${tour.cadence.toFixed(2)}/s · Portée : ${Math.round(tour.portee)}`;

        const coutAmelioration = tour.coutAmelioration();
        if (coutAmelioration === null) {
            this.boutonAmeliorer.hidden = true;
            this.elementNiveauMax.hidden = false;
        } else {
            this.boutonAmeliorer.hidden = false;
            this.elementNiveauMax.hidden = true;
            this.boutonAmeliorer.textContent = `Améliorer (coût : ${coutAmelioration})`;
            this.boutonAmeliorer.disabled = Jeu.credits < coutAmelioration;
        }

        this.boutonVendre.textContent = `Vendre (+${tour.montantVente()} crédits)`;
    },

    // Affiche le niveau du joueur et sa progression vers le suivant sur l'écran
    // d'accueil (Progression, phase 3A). Au niveau maximum, la barre n'a plus de sens
    // (aucun seuil suivant) : elle est remplacée par un texte dédié plutôt que
    // laissée à 100 % ou vide, ce qui serait ambigu avec « pas encore de progression ».
    mettreAJourProgressionAccueil() {
        this.elementNiveauJoueurActuel.textContent = Progression.niveau;

        const seuil = Progression.seuilNiveauSuivant();
        const auNiveauMax = seuil === null;
        this.elementBarreXpConteneur.hidden = auNiveauMax;
        this.elementTexteNiveauMaxJoueur.hidden = !auNiveauMax;

        if (!auNiveauMax) {
            this.elementBarreXpRemplissage.style.width = `${(Progression.xpActuelle / seuil) * 100}%`;
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
            element.textContent = palier.debloque
                ? `✓ ${palier.description}`
                : `🔒 ${palier.description} — niveau ${palier.niveauRequis}`;
        }
    },

    // Affiche l'XP gagnée pendant la partie qui vient de se terminer et, le cas
    // échéant, une mention de passage de niveau, à partir de Jeu.derniereProgression
    // (renseignée une seule fois par Jeu.finaliserPartie, juste avant que l'écran
    // correspondant ne devienne visible). `elementXp` et `elementNiveauSuperieur` sont
    // les éléments de l'écran de victoire ou de défaite, selon lequel vient de s'afficher.
    afficherResumeProgression(elementXp, elementNiveauSuperieur) {
        const resume = Jeu.derniereProgression;
        if (!resume) return;

        elementXp.textContent = resume.xpGagnee;

        elementNiveauSuperieur.hidden = resume.niveauxGagnes === 0;
        if (resume.niveauxGagnes > 0) {
            elementNiveauSuperieur.textContent = `Niveau supérieur ! ${resume.niveauAvant} → ${resume.niveauApres}`;
        }
    },

    // Rappelée chaque frame par Jeu.boucle, quel que soit l'état de la partie : bascule
    // la visibilité des écrans superposés et du HUD, et met à jour leur contenu.
    // `dt` est le temps réel écoulé (non affecté par Jeu.vitesseJeu), pour que le
    // minuteur du message de construction ne soit pas accéléré par la vitesse ×2.
    mettreAJourEcrans(dt) {
        this.ecranAccueil.hidden = Jeu.etatPartie !== 'accueil';
        this.ecranVictoire.hidden = Jeu.etatPartie !== 'victoire';
        this.ecranDefaite.hidden = Jeu.etatPartie !== 'defaite';
        this.conteneurHUD.hidden = Jeu.etatPartie !== 'enCours';
        this.conteneurTypesTours.hidden = Jeu.etatPartie !== 'enCours';
        // Masqué en dehors de 'enCours' même si une tour restait sélectionnée (ex. la
        // partie se termine pendant que le panneau est ouvert) : mettreAJourPanneauAmelioration
        // n'est appelée que dans le bloc 'enCours' ci-dessous, donc son contenu ne
        // serait plus rafraîchi une fois la partie terminée sans cette ligne.
        this.panneauAmelioration.hidden = Jeu.etatPartie !== 'enCours' || this.tourSelectionnee === null;

        if (Jeu.etatPartie === 'accueil') {
            this.mettreAJourProgressionAccueil();
        }

        if (Jeu.etatPartie === 'enCours') {
            this.elementCredits.textContent = Jeu.credits;
            this.elementIntegrite.textContent = Jeu.integrite;
            this.elementNombreTours.textContent = `${Jeu.toursActives.length} / ${Jeu.limiteTours}`;
            this.elementGraine.textContent = Aleatoire.graineActuelle;
            this.elementNumeroVague.textContent = Number.isFinite(Jeu.nombreDeVagues)
                ? `${Vagues.numeroVagueActuelle} / ${Jeu.nombreDeVagues}`
                : `${Vagues.numeroVagueActuelle} / ∞`;
            this.boutonLancerVague.disabled = Vagues.enCours;
            this.boutonPause.textContent = Jeu.enPause ? 'Reprendre' : 'Pause';
            this.boutonVitesse.textContent = `Vitesse ×${Jeu.vitesseJeu}`;
            // Les crédits changent en continu (récompenses, bonus de fin de vague) :
            // les boutons de type doivent donc être réévalués chaque frame, pas
            // seulement au moment où le joueur change de sélection.
            this.mettreAJourBoutonsTypesTours();
            this.mettreAJourPanneauAmelioration();
        }

        if (Jeu.etatPartie === 'victoire') {
            this.elementVaguesFranchisesVictoire.textContent = Vagues.numeroVagueActuelle;
            this.elementIntegriteRestanteVictoire.textContent = Jeu.integrite;
            this.afficherResumeProgression(this.elementXpGagneeVictoire, this.elementNiveauSuperieurVictoire);
        }

        if (Jeu.etatPartie === 'defaite') {
            this.elementVagueAtteinteDefaite.textContent = Vagues.numeroVagueActuelle;
            // En mode Sans fin, la vague atteinte est le score final du joueur : on
            // la met en évidence plutôt que de l'afficher comme une simple statistique.
            this.elementVagueAtteinteDefaite.classList.toggle('score-sansfin', !Number.isFinite(Jeu.nombreDeVagues));
            this.afficherResumeProgression(this.elementXpGagneeDefaite, this.elementNiveauSuperieurDefaite);
        }

        if (this.dureeRestanteMessageConstruction > 0) {
            this.dureeRestanteMessageConstruction -= dt;
            if (this.dureeRestanteMessageConstruction <= 0) {
                this.elementMessageConstruction.textContent = '';
            }
        }
    }
};
