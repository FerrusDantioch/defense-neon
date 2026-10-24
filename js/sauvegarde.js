// sauvegarde.js — Objet SauvegardePartie : garde la partie en cours dans localStorage
// pour pouvoir la reprendre après avoir fermé la page ou l'application (sur
// téléphone, le système ferme souvent une application restée en arrière-plan).
//
// La partie n'est enregistrée qu'entre deux vagues (aucun ennemi en jeu) : c'est un
// état simple à décrire (carte, tours, crédits, intégrité, numéro de vague), alors
// qu'il faudrait sinon enregistrer la position de chaque ennemi et de chaque
// projectile. Une partie fermée en pleine vague reprend donc juste avant cette vague,
// avec les crédits et les tours de ce moment-là. La carte n'est pas enregistrée case
// par case : sa graine suffit à la régénérer à l'identique (voir aleatoire.js). L'état
// du générateur aléatoire est enregistré aussi, pour que les vagues suivantes soient
// exactement celles qu'aurait vues la partie d'origine.
//
// Même protection try/catch que Progression : un stockage indisponible (navigation
// privée stricte) ne doit jamais empêcher de jouer, la partie n'est alors simplement
// pas sauvegardée.

const SauvegardePartie = {
    // Copie en mémoire de la sauvegarde actuelle (ou null), pour que l'écran d'accueil
    // puisse l'afficher à chaque image sans relire localStorage à chaque fois.
    donnees: null,
    avertissementDejaAffiche: false,

    // Lue une seule fois, au chargement de la page (Jeu.initialiser). Une sauvegarde
    // illisible ou d'un autre format (Config.VERSION_SAUVEGARDE_PARTIE) est ignorée.
    charger() {
        try {
            const brut = localStorage.getItem(Config.CLE_SAUVEGARDE_PARTIE);
            const donnees = brut ? JSON.parse(brut) : null;
            this.donnees = donnees && donnees.version === Config.VERSION_SAUVEGARDE_PARTIE ? donnees : null;
        } catch (erreur) {
            this.donnees = null;
            this.avertirEchecStockage(erreur);
        }
    },

    // Vrai seulement entre deux vagues : partie en cours, aucune vague en train
    // d'apparaître, aucun ennemi encore en jeu, et pas de Caserne en attente du choix
    // de sa case à bloquer.
    peutEnregistrer() {
        return Jeu.etatPartie === 'enCours'
            && !Vagues.enCours
            && Jeu.ennemisActifs.length === 0
            && !Interface.caserneEnAttenteChoix;
    },

    // Appelée après chaque action qui change l'état entre deux vagues (construction,
    // amélioration, vente, changement de cible), à la fin de chaque vague et au début
    // de chaque partie. Ne fait rien en pleine vague (voir peutEnregistrer).
    enregistrer() {
        if (!this.peutEnregistrer()) return;

        this.donnees = {
            version: Config.VERSION_SAUVEGARDE_PARTIE,
            idDuree: Jeu.idDureeActuelle,
            graine: Aleatoire.graineActuelle,
            etatAleatoire: Aleatoire.etat,
            difficulteSuperieure: Jeu.difficulteSuperieure,
            modeDefiDuJour: Jeu.modeDefiDuJour,
            numeroVague: Vagues.numeroVagueActuelle,
            credits: Jeu.credits,
            integrite: Jeu.integrite,
            tours: Jeu.toursActives.map(tour => ({
                colonne: tour.colonne,
                ligne: tour.ligne,
                type: tour.type,
                niveau: tour.niveau,
                investissementTotal: tour.investissementTotal,
                modeCiblage: tour.modeCiblage,
                // Caserne seulement : la case de chemin que bloque son unité.
                cheminIndex: tour.cheminIndex ?? null,
                indexPointDePassage: tour.indexPointDePassage ?? null
            })),
            statistiques: Statistiques.exporter()
        };

        try {
            localStorage.setItem(Config.CLE_SAUVEGARDE_PARTIE, JSON.stringify(this.donnees));
        } catch (erreur) {
            this.avertirEchecStockage(erreur);
        }
    },

    // Appelée à la fin de la partie (victoire ou défaite) : il n'y a plus rien à
    // reprendre.
    effacer() {
        this.donnees = null;
        try {
            localStorage.removeItem(Config.CLE_SAUVEGARDE_PARTIE);
        } catch (erreur) {
            this.avertirEchecStockage(erreur);
        }
    },

    // Recrée la partie sauvegardée et la rend jouable. Renvoie false si la sauvegarde
    // ne correspond pas à la carte régénérée (par exemple après une mise à jour du jeu
    // qui changerait la génération des cartes) : l'appelant l'abandonne alors plutôt
    // que de poser des tours au mauvais endroit.
    restaurer() {
        const donnees = this.donnees;
        if (!donnees || !Config.DUREES_PARTIE.some(d => d.id === donnees.idDuree)) return false;

        Jeu.idDureeActuelle = donnees.idDuree;
        Jeu.reinitialiser(donnees.idDuree, donnees.graine, donnees.difficulteSuperieure);
        // Le défi d'un autre jour ne compte plus pour le record d'aujourd'hui : la
        // partie continue alors comme une partie Sans fin ordinaire. La graine du défi
        // étant la date elle-même (voir calculerGraineDuJour), la comparer suffit.
        Jeu.modeDefiDuJour = donnees.modeDefiDuJour && donnees.graine === calculerGraineDuJour();

        for (const sauvee of donnees.tours) {
            if (!Config.TYPES_TOURS[sauvee.type]
                || !Carte.estConstructible(sauvee.colonne, sauvee.ligne)
                || !Carte.estAdjacentAUnChemin(sauvee.colonne, sauvee.ligne)) {
                return false;
            }

            const tour = new Tour(sauvee.colonne, sauvee.ligne, sauvee.type);
            tour.niveau = sauvee.niveau;
            tour.investissementTotal = sauvee.investissementTotal;
            tour.modeCiblage = sauvee.modeCiblage || tour.modeCiblage;
            tour.recalculerStats();

            if (tour.typeDegats === 'caserne') {
                const chemin = Carte.chemins[sauvee.cheminIndex];
                if (!chemin || !chemin.pointsDePassage[sauvee.indexPointDePassage]) return false;
                // Le constructeur a déjà choisi (ou mis en attente) une case à
                // bloquer ; on la remplace par celle de la partie d'origine, et
                // l'unité réapparaît avec les statistiques du niveau restauré.
                tour.candidatsBlocageEnAttente = null;
                tour.cheminIndex = sauvee.cheminIndex;
                tour.indexPointDePassage = sauvee.indexPointDePassage;
                tour.faireApparaitreUnite();
            }

            Jeu.toursActives.push(tour);
            Carte.grille[sauvee.ligne][sauvee.colonne] = 'OCCUPEE';
        }

        Aleatoire.etat = donnees.etatAleatoire;
        Vagues.numeroVagueActuelle = donnees.numeroVague;
        Jeu.credits = donnees.credits;
        Jeu.integrite = donnees.integrite;
        Statistiques.importer(donnees.statistiques);
        Jeu.etatPartie = 'enCours';
        return true;
    },

    avertirEchecStockage(erreur) {
        if (this.avertissementDejaAffiche) return;
        this.avertissementDejaAffiche = true;
        console.warn(
            'Omni-Défense : localStorage indisponible (navigation privée ?), la partie en cours ne sera pas sauvegardée.',
            erreur
        );
    }
};
