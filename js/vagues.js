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
    // de chaque type avancé s'additionnent une fois leur vague de déblocage atteinte
    // (un Blindé n'exclut pas un Rapide) : à partir de la vague 6, un même tirage peut
    // donner l'un ou l'autre, comme demandé par les critères d'acceptation ("des
    // Blindés apparaissent également" — pas "à la place des Rapides"). Soigneur et
    // Bouclier (octobre 2026) sont ajoutés après les deux premiers : avant leur vague
    // d'apparition, les tirages donnent exactement les mêmes types qu'auparavant.
    tirerTypeEnnemi(numero) {
        const tirage = Aleatoire.nombre();
        let seuil = 0;
        for (const [type, vagueApparition, proportion] of [
            ['blinde', Config.VAGUE_APPARITION_BLINDE, Config.PROPORTION_BLINDE],
            ['rapide', Config.VAGUE_APPARITION_RAPIDE, Config.PROPORTION_RAPIDE],
            ['soigneur', Config.VAGUE_APPARITION_SOIGNEUR, Config.PROPORTION_SOIGNEUR],
            ['bouclier', Config.VAGUE_APPARITION_BOUCLIER, Config.PROPORTION_BOUCLIER]
        ]) {
            if (numero < vagueApparition) continue;
            seuil += proportion;
            if (tirage < seuil) return type;
        }
        return 'standard';
    },

    // Composition d'une vague, calculée à part pour servir aussi à l'aperçu de la
    // vague suivante (descriptionVague) sans dupliquer les formules de demarrer().
    nombreEnnemisNormal(numero) {
        return Config.ENNEMIS_PAR_VAGUE_BASE + numero * Config.ENNEMIS_PAR_VAGUE_PAR_NUMERO;
    },

    // Vagues de boss (phase 7G) : tous les Config.VAGUE_INTERVALLE_BOSS paliers, un
    // simple modulo sur le numéro de vague — valable aussi bien en mode Sans fin
    // qu'au-delà du nombre de vagues d'une partie Standard/Longue, puisqu'il ne dépend
    // jamais de Jeu.nombreDeVagues.
    estVagueDeBoss(numero) {
        return numero % Config.VAGUE_INTERVALLE_BOSS === 0;
    },

    tailleEscorte(numero) {
        return Math.max(1, Math.round(this.nombreEnnemisNormal(numero) * Config.PROPORTION_ESCORTE_VAGUE_BOSS));
    },

    recompenseFinDeVague(numero) {
        return Config.RECOMPENSE_FIN_VAGUE_BASE + numero * Config.RECOMPENSE_FIN_VAGUE_PAR_NUMERO;
    },

    // Types d'ennemis qui apparaissent pour la première fois à la vague `numero` :
    // annoncés au début de cette vague (demarrer) et signalés dans l'aperçu de la
    // vague suivante (descriptionVague).
    nouveauxTypes(numero) {
        return [
            ['rapide', Config.VAGUE_APPARITION_RAPIDE],
            ['blinde', Config.VAGUE_APPARITION_BLINDE],
            ['drone', Config.VAGUE_APPARITION_DRONE],
            ['soigneur', Config.VAGUE_APPARITION_SOIGNEUR],
            ['bouclier', Config.VAGUE_APPARITION_BOUCLIER]
        ].filter(([, vague]) => vague === numero).map(([type]) => type);
    },

    // Texte court décrivant la vague `numero`, affiché dans le HUD à côté du bouton
    // de lancement (voir Interface.mettreAJourEcrans) pour que le joueur se prépare
    // avant de la lancer : nombre d'ennemis, boss, drones et nouveaux ennemis.
    descriptionVague(numero) {
        const parties = [this.estVagueDeBoss(numero)
            ? `⚠ boss + ${this.tailleEscorte(numero)} ennemis`
            : `${this.nombreEnnemisNormal(numero)} ennemis`];
        const nouveaux = this.nouveauxTypes(numero);
        if (numero > Config.VAGUE_APPARITION_DRONE) {
            parties.push('drones');
        }
        for (const type of nouveaux) {
            parties.push(`nouveau : ${Config.TYPES_ENNEMIS[type].nom}`);
        }
        return parties.join(' · ');
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
        // Difficulté supérieure (contenu additionnel post-lancement, « phase 7I ») :
        // se combine MULTIPLICATIVEMENT avec le multiplicateur déjà appliqué selon
        // le numéro de vague (en place depuis la phase 1B), au même point de calcul
        // — jamais une formule séparée pour un type d'ennemi en particulier. Comme
        // ce multiplicateur unique est ensuite transmis tel quel à `new Ennemi(...)`
        // pour absolument tout ennemi généré pendant cette vague (les trois types
        // classiques, le drone, et le boss, voir mettreAJour ci-dessous), le boss
        // profite nativement de la difficulté supérieure sans code dédié. Lit
        // Jeu.difficulteSuperieure directement (même principe que Jeu.nombreDeVagues
        // plus haut, déjà lu depuis ce fichier) : toujours faux pour un défi du jour
        // (voir la note sur ce champ dans jeu.js), donc sans effet sur ses PV.
        const multiplicateurDifficulte = Jeu.difficulteSuperieure
            ? Config.DIFFICULTE_SUPERIEURE_MULTIPLICATEUR_PV : 1;
        this.multiplicateurPointsDeVie = (1 + (numero - 1) * Config.CROISSANCE_PV_PAR_VAGUE) * multiplicateurDifficulte;

        // Le premier ennemi apparaît tout de suite : attendre un intervalle complet
        // après le clic du joueur donnerait une impression de délai injustifié.
        this.tempsDepuisDerniereGeneration = 0;

        // `bossEnAttente` est consommé au tout premier ennemi généré ci-dessous
        // (mettreAJour), garantissant que le boss apparaît en tête de file avant même
        // le premier ennemi d'escorte.
        this.estVagueBoss = this.estVagueDeBoss(numero);
        this.bossEnAttente = this.estVagueBoss;
        this.ennemisRestantsAGenerer = this.estVagueBoss
            ? 1 + this.tailleEscorte(numero)
            : this.nombreEnnemisNormal(numero);

        // Annonces de début de vague, une seule fois (demarrer() n'est appelée qu'une
        // fois par vague grâce au garde-fou this.enCours en tête de cette méthode) :
        // vague de boss (phase 7G), et chaque type d'ennemi qui apparaît pour la
        // première fois, avec ce qu'il faut savoir pour le contrer. Un joueur qui ne
        // savait pas que seul le Flak touche les drones perdait presque toute son
        // intégrité à cause d'eux sans comprendre pourquoi (voir
        // outils/simulation-parties.js). Une seule zone de message : les annonces
        // d'une même vague sont réunies plutôt que la dernière n'efface les autres.
        const annonces = [];
        if (this.estVagueBoss) {
            annonces.push('VAGUE DE BOSS');
            Son.jouerAlerteBoss();
        }
        const nouveaux = this.nouveauxTypes(numero);
        for (const type of nouveaux) {
            const caracteristiques = Config.TYPES_ENNEMIS[type];
            annonces.push(`NOUVEL ENNEMI : ${caracteristiques.nom} — ${caracteristiques.description}`);
        }
        if (nouveaux.length > 0) {
            Son.jouerAlerteNouvelEnnemi();
        }
        if (annonces.length > 0) {
            // Plus longue quand il y a une consigne à lire.
            Interface.afficherMessageConstruction(`⚠ ${annonces.join(' — ')}`, nouveaux.length > 0 ? 4 : 3);
        }
    },

    // Vrai quand le joueur peut appeler la vague suivante sans attendre la fin de
    // celle-ci (voir Jeu.lancerVagueSuivante) : tous ses ennemis sont déjà apparus, et
    // la partie compte encore au moins une vague.
    peutAppelerEnAvance() {
        return this.enCours
            && this.ennemisRestantsAGenerer <= 0
            && this.numeroVagueActuelle < Jeu.nombreDeVagues;
    },

    // Bonus versé pour un appel anticipé : proportionnel au nombre d'ennemis encore
    // en jeu, donc au risque pris (voir Config.BONUS_APPEL_ANTICIPE_PAR_ENNEMI).
    // Rappelée à chaque image par le HUD (libellé du bouton) : une simple boucle
    // plutôt qu'un filter() qui créerait un tableau à chaque fois.
    bonusAppelAnticipe(listeEnnemis) {
        let enJeu = 0;
        for (const ennemi of listeEnnemis) {
            if (ennemi.vivant && !ennemi.arrive) enJeu++;
        }
        return enJeu * Config.BONUS_APPEL_ANTICIPE_PAR_ENNEMI;
    },

    // Considère la vague en cours comme terminée sans attendre ses derniers ennemis
    // (appel anticipé) et renvoie sa récompense habituelle, que l'appelant verse
    // lui-même. Les ennemis restants continuent leur route normalement.
    terminerEnAvance() {
        this.enCours = false;
        return this.recompenseFinDeVague(this.numeroVagueActuelle);
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
                    const cheminIndex = Aleatoire.entier(0, Carte.nombreChemins - 1);
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
                        // l'un des Carte.nombreChemins chemins de la carte en cours dès sa
                        // création, toujours via le générateur à graine (jamais
                        // Math.random()) pour que la répartition reste reproductible à
                        // graine égale — voir la note sur Aleatoire dans particules.js
                        // pour la raison inverse (pourquoi les particules, elles, n'y
                        // passent pas).
                        const cheminIndex = Aleatoire.entier(0, Carte.nombreChemins - 1);
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
                this.credits += this.recompenseFinDeVague(this.numeroVagueActuelle);
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
