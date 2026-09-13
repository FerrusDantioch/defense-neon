// progression.js — Objet Progression : l'unique état qui survit d'une partie à
// l'autre (niveau de joueur, XP, quelques statistiques cumulées), persistant via
// localStorage. Contrairement à Jeu.credits ou Jeu.integrite (remis à zéro par
// Jeu.reinitialiser à chaque nouvelle partie), cet état n'est jamais réinitialisé en
// cours de session : il est chargé une seule fois au tout début de
// Jeu.initialiser() (Progression.charger()) et sauvegardé une seule fois, à la toute
// fin de chaque partie (Progression.sauvegarder(), appelée par Jeu.finaliserPartie())
// — jamais pendant qu'une partie est en cours : une écriture disque à chaque frame ou
// chaque vague serait inutilement coûteuse pour un état qui ne change de toute façon
// qu'une fois la partie terminée.
//
// Depuis la phase 3B, ce niveau débloque aussi des bonus permanents (voir
// Config.PALIERS_BONUS) : cet objet est le seul endroit du code qui consulte ce
// tableau directement (estDebloque, palier, bonusCreditsDepart,
// bonusIntegriteDepart, multiplicateurCoutConstruction,
// multiplicateurCoutAmelioration, multiplicateurDegats, listePaliers ci-dessous) —
// jeu.js, interface.js et tour.js appellent ces fonctions plutôt que de lire
// Config.PALIERS_BONUS eux-mêmes, pour ne jamais avoir qu'un seul endroit à modifier
// si un palier change.

const Progression = {
    niveau: 1,
    xpActuelle: 0,
    xpTotale: 0,
    partiesJouees: 0,
    meilleureVagueSansFin: 0,

    // Vrai après un premier échec de lecture/écriture dans localStorage, pour
    // n'avertir qu'une seule fois par session plutôt qu'à chaque fin de partie (une
    // navigation privée stricte échouerait sinon en boucle).
    avertissementDejaAffiche: false,

    // Seuil d'XP pour passer du niveau courant au suivant, ou null au niveau maximum
    // (Config.NIVEAU_MAX_JOUEUR) : au-delà, ajouterXp continue d'accumuler l'XP dans
    // xpTotale sans plus jamais faire progresser le niveau.
    seuilNiveauSuivant() {
        if (this.niveau >= Config.NIVEAU_MAX_JOUEUR) return null;
        return Config.XP_SEUIL_NIVEAU_1 * Math.pow(Config.CROISSANCE_XP_NIVEAU, this.niveau - 1);
    },

    // Lit l'état sauvegardé dans localStorage et remplit les propriétés ci-dessus. Si
    // la clé n'existe pas encore (premier lancement), les valeurs par défaut déjà
    // posées sur l'objet restent telles quelles. Toujours entourée d'un try/catch :
    // certains navigateurs (navigation privée stricte) font lever une exception au
    // seul accès à localStorage plutôt que de renvoyer null, ce qui ne doit jamais
    // empêcher le jeu de démarrer.
    charger() {
        try {
            const donneesBrutes = localStorage.getItem(Config.CLE_SAUVEGARDE);
            if (!donneesBrutes) return;

            const donnees = JSON.parse(donneesBrutes);
            this.niveau = donnees.niveau ?? 1;
            this.xpActuelle = donnees.xpActuelle ?? 0;
            this.xpTotale = donnees.xpTotale ?? 0;
            this.partiesJouees = donnees.partiesJouees ?? 0;
            this.meilleureVagueSansFin = donnees.meilleureVagueSansFin ?? 0;
        } catch (erreur) {
            this.avertirEchecStockage(erreur);
        }
    },

    // Écrit l'état actuel dans localStorage, avec la même protection try/catch que
    // charger() : si l'écriture échoue, la partie qui vient de se terminer garde sa
    // progression en mémoire pour le reste de la session, simplement non persistée.
    sauvegarder() {
        try {
            const donnees = {
                niveau: this.niveau,
                xpActuelle: this.xpActuelle,
                xpTotale: this.xpTotale,
                partiesJouees: this.partiesJouees,
                meilleureVagueSansFin: this.meilleureVagueSansFin
            };
            localStorage.setItem(Config.CLE_SAUVEGARDE, JSON.stringify(donnees));
        } catch (erreur) {
            this.avertirEchecStockage(erreur);
        }
    },

    avertirEchecStockage(erreur) {
        if (this.avertissementDejaAffiche) return;
        this.avertissementDejaAffiche = true;
        console.warn(
            'Défense Néon : localStorage indisponible (navigation privée ?), la progression du joueur ne sera pas sauvegardée pour cette session.',
            erreur
        );
    },

    // Ajoute `montant` à l'XP courante et à l'XP totale, puis fait progresser le
    // niveau tant que le seuil du niveau courant est dépassé — en boucle, pas
    // seulement un seul palier : une partie très généreuse en XP peut faire gagner
    // plusieurs niveaux d'un coup. Renvoie le nombre de niveaux gagnés pendant cet
    // appel (0 si aucun), pour que l'appelant puisse afficher une notification.
    ajouterXp(montant) {
        this.xpActuelle += montant;
        this.xpTotale += montant;

        let niveauxGagnes = 0;
        let seuil = this.seuilNiveauSuivant();
        while (seuil !== null && this.xpActuelle >= seuil) {
            this.xpActuelle -= seuil;
            this.niveau++;
            niveauxGagnes++;
            seuil = this.seuilNiveauSuivant();
        }

        return niveauxGagnes;
    },

    // Renvoie l'objet palier de Config.PALIERS_BONUS correspondant à cet id.
    palier(id) {
        return Config.PALIERS_BONUS.find(p => p.id === id);
    },

    // Vraie si le niveau actuel a atteint le niveauRequis du palier correspondant à
    // cet id. Une fois débloqué, un palier ne peut jamais redevenir verrouillé : ce
    // calcul dépend uniquement de this.niveau, qui ne fait que progresser (jamais
    // régresser, voir ajouterXp).
    estDebloque(id) {
        return this.niveau >= this.palier(id).niveauRequis;
    },

    // Bonus de crédits de départ (palier 'credits_depart'), ou 0 s'il n'est pas
    // encore débloqué. Appliqué par Jeu.reinitialiser().
    bonusCreditsDepart() {
        return this.estDebloque('credits_depart') ? this.palier('credits_depart').valeur : 0;
    },

    // Bonus d'intégrité de départ (palier 'integrite_bonus'), ou 0 sinon. Appliqué
    // par Jeu.reinitialiser().
    bonusIntegriteDepart() {
        return this.estDebloque('integrite_bonus') ? this.palier('integrite_bonus').valeur : 0;
    },

    // Multiplicateur à appliquer au coût de construction d'une tour (palier
    // 'reduction_construction'), ou 1 (aucun effet) sinon. Appliqué par
    // Interface.coutConstruction().
    multiplicateurCoutConstruction() {
        return this.estDebloque('reduction_construction') ? 1 - this.palier('reduction_construction').valeur : 1;
    },

    // Multiplicateur à appliquer au coût d'amélioration d'une tour (palier
    // 'reduction_amelioration'), ou 1 sinon. Appliqué par Tour.coutAmelioration().
    multiplicateurCoutAmelioration() {
        return this.estDebloque('reduction_amelioration') ? 1 - this.palier('reduction_amelioration').valeur : 1;
    },

    // Multiplicateur à appliquer aux dégâts d'une tour (palier 'bonus_degats'), ou 1
    // sinon. Appliqué par Tour.recalculerStats().
    multiplicateurDegats() {
        return this.estDebloque('bonus_degats') ? 1 + this.palier('bonus_degats').valeur : 1;
    },

    // Liste complète des paliers avec leur état de déblocage courant, pour
    // l'affichage sur l'écran d'accueil (Interface.mettreAJourProgressionAccueil) :
    // c'est la seule vue que ce fichier expose sur Config.PALIERS_BONUS, plutôt que de
    // laisser interface.js le parcourir lui-même.
    listePaliers() {
        return Config.PALIERS_BONUS.map(p => ({
            id: p.id,
            description: p.description,
            niveauRequis: p.niveauRequis,
            debloque: this.niveau >= p.niveauRequis
        }));
    }
};
