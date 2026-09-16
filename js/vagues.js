// vagues.js — Objet Vagues : décide combien d'ennemis apparaissent, de quel type, à
// quel rythme, et détecte la fin d'une vague. Ne déplace ni ne dessine rien : c'est le
// rôle de chaque Ennemi et de la boucle de jeu dans jeu.js.

const Vagues = {
    // Numéro de la vague en cours ou de la dernière terminée ; 0 tant qu'aucune vague
    // n'a démarré.
    numeroVagueActuelle: 0,
    enCours: false,

    // Combien d'ennemis restent à faire apparaître pour la vague en cours, et à quel
    // rythme (l'intervalle, en secondes, est fixé une fois pour toute la vague au
    // moment de son démarrage).
    ennemisRestantsAGenerer: 0,
    intervalleCourant: 0,
    tempsDepuisDerniereGeneration: 0,
    multiplicateurPointsDeVie: 1,

    // Vagues de boss (phase 7G) : `estVagueBoss` reste vrai pour toute la durée d'une
    // vague qui en est une (utilisé nulle part en dehors de demarrer() pour l'instant,
    // mais conservé sur l'instance plutôt qu'en variable locale pour rester
    // inspectable, comme le reste de l'état de vague ci-dessus). `bossEnAttente`
    // vaut vrai jusqu'à ce que le boss ait effectivement été généré (voir
    // mettreAJour) : c'est ce qui garantit qu'il apparaît bien en tête de file, un
    // seul boss par vague de ce type, jamais généré une deuxième fois.
    estVagueBoss: false,
    bossEnAttente: false,

    // Crédits accumulés à la fin des vagues, récupérés par Jeu.boucle et ajoutés à
    // Jeu.credits (la monnaie dépensée pour construire des tours).
    credits: 0,

    // Intervalle d'apparition pour la vague `numero` : réduction multiplicative
    // composée (pas linéaire) de Config.REDUCTION_INTERVALLE_PAR_VAGUE par vague
    // écoulée, avec un plancher pour ne jamais faire apparaître deux ennemis l'un sur
    // l'autre même après de nombreuses vagues.
    calculerIntervalle(numero) {
        const reduction = Math.pow(1 - Config.REDUCTION_INTERVALLE_PAR_VAGUE, numero - 1);
        const intervalle = Config.INTERVALLE_APPARITION_INITIAL * reduction;
        return Math.max(intervalle, Config.INTERVALLE_APPARITION_MIN);
    },

    // Tire le type du prochain ennemi à générer pour la vague `numero`. Les proportions
    // de Rapide et de Blindé s'additionnent une fois leur vague de déblocage atteinte
    // (un Blindé n'exclut pas un Rapide) : à partir de la vague 6, un même tirage peut
    // donner l'un ou l'autre, comme demandé par les critères d'acceptation ("des
    // Blindés apparaissent également" — pas "à la place des Rapides").
    tirerTypeEnnemi(numero) {
        const proportionBlinde = numero >= Config.VAGUE_APPARITION_BLINDE ? Config.PROPORTION_BLINDE : 0;
        const proportionRapide = numero >= Config.VAGUE_APPARITION_RAPIDE ? Config.PROPORTION_RAPIDE : 0;
        const tirage = Aleatoire.nombre();

        if (tirage < proportionBlinde) return 'blinde';
        if (tirage < proportionBlinde + proportionRapide) return 'rapide';
        return 'standard';
    },

    // Initialise l'état de la vague `numero`. Refuse si une vague est déjà en cours,
    // ou si on dépasse le nombre de vagues prévu pour la partie (Jeu.nombreDeVagues,
    // fixé par la durée choisie à l'écran d'accueil ; Infinity en mode Sans fin, donc
    // cette condition n'est alors jamais vraie).
    demarrer(numero) {
        if (this.enCours) return;
        if (numero > Jeu.nombreDeVagues) return;

        this.numeroVagueActuelle = numero;
        this.enCours = true;
        this.intervalleCourant = this.calculerIntervalle(numero);
        this.multiplicateurPointsDeVie = 1 + (numero - 1) * 0.15;

        // Le premier ennemi apparaît tout de suite : attendre un intervalle complet
        // après le clic du joueur donnerait une impression de délai injustifié.
        this.tempsDepuisDerniereGeneration = 0;

        const nombreNormalEnnemis = 5 + numero * 2;

        // Vagues de boss (phase 7G) : tous les Config.VAGUE_INTERVALLE_BOSS paliers,
        // un simple modulo sur le numéro de vague — valable aussi bien en mode Sans
        // fin qu'au-delà du nombre de vagues d'une partie Standard/Longue, puisqu'il
        // ne dépend jamais de Jeu.nombreDeVagues. `bossEnAttente` est consommé au tout
        // premier ennemi généré ci-dessous (mettreAJour), garantissant qu'il apparaît
        // en tête de file avant même le premier ennemi d'escorte.
        this.estVagueBoss = numero % Config.VAGUE_INTERVALLE_BOSS === 0;
        this.bossEnAttente = this.estVagueBoss;

        if (this.estVagueBoss) {
            const tailleEscorte = Math.max(1, Math.round(nombreNormalEnnemis * Config.PROPORTION_ESCORTE_VAGUE_BOSS));
            this.ennemisRestantsAGenerer = 1 + tailleEscorte;

            // Bandeau d'annonce et son d'alerte, une seule fois au tout début de la
            // vague (jamais répétés en boucle, demarrer() n'étant appelée qu'une fois
            // par vague grâce au garde-fou this.enCours en tête de cette méthode) —
            // réutilise le même mécanisme d'affichage temporaire que les messages de
            // construction (Interface.afficherMessageConstruction, généralisé pour
            // accepter une durée différente de son défaut de 1,5 s), avec une durée
            // plus longue pour rester bien visible malgré son caractère plus
            // exceptionnel qu'une simple erreur de construction.
            Interface.afficherMessageConstruction('⚠ VAGUE DE BOSS', 3);
            Son.jouerAlerteBoss();
        } else {
            this.ennemisRestantsAGenerer = nombreNormalEnnemis;
        }
    },

    // À appeler une fois par frame avec le dt courant et le tableau des ennemis actifs
    // (celui de Jeu.ennemisActifs) : y ajoute les nouveaux ennemis à faire apparaître,
    // et détecte la fin de la vague.
    mettreAJour(dt, listeEnnemis) {
        if (!this.enCours) return;

        if (this.ennemisRestantsAGenerer > 0) {
            this.tempsDepuisDerniereGeneration -= dt;

            if (this.tempsDepuisDerniereGeneration <= 0) {
                if (this.bossEnAttente) {
                    // Boss (phase 7G) : un ennemi au sol ordinaire à tous égards, donc
                    // toujours assigné à un chemin comme les trois types classiques
                    // (jamais `null`, contrairement au drone) — seul son type est
                    // imposé plutôt que tiré par tirerTypeEnnemi/le tirage du drone,
                    // qu'on saute donc entièrement ici, une seule fois par vague de
                    // boss (bossEnAttente repasse à `false` juste en dessous).
                    const cheminIndex = Aleatoire.entier(0, Config.NOMBRE_CHEMINS - 1);
                    listeEnnemis.push(new Ennemi('boss', this.multiplicateurPointsDeVie, cheminIndex));
                    this.bossEnAttente = false;
                } else {
                    // Drone (phase 7F) : décidé par un tirage dédié, séparé de
                    // tirerTypeEnnemi (qui ne concerne que les trois types au sol
                    // assignés à un chemin) — à partir de VAGUE_APPARITION_DRONE,
                    // PROPORTION_DRONE des apparitions sont des drones plutôt que
                    // d'emprunter un chemin. Un seul Aleatoire.nombre() consommé dans un
                    // cas comme dans l'autre (jamais les deux à la fois), pour que la
                    // suite de tirages reste déterministe à graine égale quelle que soit
                    // l'issue de ce tirage.
                    const estDrone = this.numeroVagueActuelle >= Config.VAGUE_APPARITION_DRONE
                        && Aleatoire.nombre() < Config.PROPORTION_DRONE;

                    if (estDrone) {
                        // Ni cheminIndex ni position de départ liée à un chemin : le
                        // drone tire lui-même son propre trajet en ligne droite dans son
                        // constructeur (voir ennemi.js) à partir des seules dimensions de
                        // la grille.
                        listeEnnemis.push(new Ennemi('drone', this.multiplicateurPointsDeVie, null));
                    } else {
                        const type = this.tirerTypeEnnemi(this.numeroVagueActuelle);
                        // Chemins multiples (phase 6A) : chaque ennemi se voit assigner
                        // l'un des Config.NOMBRE_CHEMINS chemins dès sa création, toujours
                        // via le générateur à graine (jamais Math.random()) pour que la
                        // répartition reste reproductible à graine égale — voir la note
                        // sur Aleatoire dans particules.js pour la raison inverse
                        // (pourquoi les particules, elles, n'y passent pas).
                        const cheminIndex = Aleatoire.entier(0, Config.NOMBRE_CHEMINS - 1);
                        listeEnnemis.push(new Ennemi(type, this.multiplicateurPointsDeVie, cheminIndex));
                    }
                }

                this.ennemisRestantsAGenerer--;
                this.tempsDepuisDerniereGeneration = this.intervalleCourant;
            }
        }

        // La vague n'est vraiment finie que lorsque le dernier ennemi généré a terminé
        // son trajet (arrivé ou tué) : il ne suffit pas que le compteur de génération
        // soit à zéro, il faut aussi regarder les ennemis eux-mêmes.
        if (this.ennemisRestantsAGenerer <= 0) {
            const resteDesEnnemisEnJeu = listeEnnemis.some(e => e.vivant && !e.arrive);
            if (!resteDesEnnemisEnJeu) {
                this.enCours = false;
                this.credits += 20 + this.numeroVagueActuelle * 5;
            }
        }
    },

    // Remet tout à zéro pour une nouvelle partie (bouton « Nouvelle carte »).
    reinitialiser() {
        this.numeroVagueActuelle = 0;
        this.enCours = false;
        this.ennemisRestantsAGenerer = 0;
        this.intervalleCourant = 0;
        this.tempsDepuisDerniereGeneration = 0;
        this.multiplicateurPointsDeVie = 1;
        this.credits = 0;
        this.estVagueBoss = false;
        this.bossEnAttente = false;
    }
};
