// jeu.js — Point d'entrée : récupère le canvas, gère le redimensionnement, la boucle
// de jeu (simulation : déplacement des ennemis, tours, projectiles, vagues) et les
// transitions entre états de partie. Tout ce qui concerne l'affichage et les
// interactions (HUD, écrans, clics) vit dans interface.js ; les deux fichiers
// s'appellent mutuellement, voir la note en tête d'interface.js.

const Jeu = {
    canvas: null,
    ctx: null,

    // Mode paysage mobile (contenu additionnel post-lancement) : identique à la media
    // query de style.css qui bascule la mise en page en grille (titre/HUD/barre de
    // tours en colonne à droite, canvas à gauche prenant toute la hauteur) — cible les
    // téléphones en orientation paysage (hauteur de viewport réduite), pas les
    // tablettes/ordinateurs en paysage qui ont déjà assez de place verticale avec la
    // mise en page habituelle. Dupliquée ici plutôt que lue depuis le CSS : plus
    // simple et tout aussi fiable qu'une lecture de propriété calculée, et les deux
    // valeurs sont assez stables pour ne pas justifier une source unique partagée.
    MEDIA_PAYSAGE_MOBILE: '(orientation: landscape) and (max-height: 500px)',

    // État de partie : 'accueil', 'enCours', 'victoire' ou 'defaite'. Détermine à la
    // fois quel écran est visible (voir Interface.mettreAJourEcrans) et si la boucle
    // de simulation s'exécute (voir boucle ci-dessous) : elle ne tourne que pendant
    // 'enCours'.
    etatPartie: 'accueil',

    // Nombre de vagues de la partie en cours, fixé par reinitialiser() d'après la
    // durée choisie à l'accueil (Config.DUREES_PARTIE). Peut valoir Infinity en mode
    // Sans fin : tout code qui l'utilise pour une progression ou un affichage doit
    // vérifier Number.isFinite() avant.
    nombreDeVagues: 0,

    // Durée sélectionnée lors du dernier démarrage de partie (un id de
    // Config.DUREES_PARTIE), réutilisée telle quelle par rejouer().
    idDureeActuelle: Config.DUREE_PAR_DEFAUT,

    // Multiplicateur de vitesse de simulation, 1 ou 2 (voir la section vitesse dans
    // boucle()).
    vitesseJeu: 1,

    // État de partie propre à la simulation.
    ennemisActifs: [],
    toursActives: [],
    poolProjectiles: [],
    integrite: 0,
    credits: 0,
    enPause: false,

    // Nombre maximal de tours constructibles simultanément pour la partie en cours
    // (phase 6B), fixé une seule fois par reinitialiser() juste après la génération de
    // la carte — jamais recalculé ensuite : une case qui passe de 'LIBRE' à 'OCCUPEE'
    // à la construction ne doit pas faire bouger la limite elle-même. Voir
    // Config.PROPORTION_LIMITE_TOURS.
    limiteTours: 0,

    // Facteur d'échelle courant, recalculé à chaque redimensionnement du canvas.
    //
    // Toutes les valeurs de vitesse et de distance de Config (vitesse des ennemis,
    // portée des tours, vitesse des projectiles) sont calibrées pour une case de
    // 40 px (Config.LARGEUR_REFERENCE / Config.COLONNES). Mais le canvas se
    // redimensionne selon la largeur de l'écran : une case ne fait pas la même
    // taille en pixels sur un téléphone que sur un écran de bureau. Sans ce
    // facteur, ces valeurs resteraient des pixels fixes et le jeu se comporterait
    // différemment selon l'appareil (trop rapide et imprécis sur petit écran, trop
    // lent sur grand écran). On multiplie donc chaque valeur par ce facteur au
    // moment de son utilisation (jamais au moment de sa lecture initiale, puisque
    // ce facteur change à chaque redimensionnement de fenêtre).
    facteurEchelle: 1,

    // Horodatage (en millisecondes, fourni par requestAnimationFrame) de la frame
    // précédente. Sert uniquement à calculer dt ; null tant qu'aucune frame n'a
    // encore été jouée.
    dernierHorodatage: null,

    // Résumé de la dernière partie terminée (XP gagnée, niveau avant/après), lu par
    // Interface pour l'afficher sur l'écran de victoire ou de défaite. Voir
    // finaliserPartie() ; null tant qu'aucune partie ne s'est encore terminée dans
    // cette session.
    derniereProgression: null,

    initialiser() {
        // Chargée une seule fois, ici, pour toute la durée de vie de la page — pas à
        // chaque nouvelle partie (voir la note en tête de progression.js) : c'est
        // Jeu.credits/integrite/etc. qui repartent de zéro à chaque reinitialiser(),
        // pas Progression.
        Progression.charger();
        // Préférence son (phase 4B) : lue tôt elle aussi, pour que le bouton Son du
        // HUD affiche le bon libellé dès la première image — bien avant que
        // Son.initialiser() ne crée l'AudioContext lui-même, au premier clic sur
        // « Jouer » (voir la note en tête de son.js).
        Son.chargerPreference();

        this.canvas = document.getElementById('canvas-jeu');
        this.ctx = this.canvas.getContext('2d');

        // Le pool de projectiles est créé une seule fois ici, jamais recréé entre
        // deux parties (reinitialiser() se contente de désactiver ses projectiles) :
        // voir la note sur le recyclage en tête de tour.js. Même principe pour le
        // pool de particules (phase 4B, voir particules.js).
        this.initialiserPoolProjectiles();
        Particules.initialiser();
        // Décor d'arrière-plan (phase 7C) : son propre canvas, son propre
        // redimensionnement, sa propre boucle de défilement (voir boucle() plus bas) —
        // totalement indépendant du reste de l'initialisation ci-dessous.
        Decor.initialiser();

        Interface.initialiser();

        window.addEventListener('resize', () => this.redimensionner());

        // Quand l'onglet passe en arrière-plan, le navigateur suspend l'exécution :
        // sans cette pause automatique, dt serait énorme au retour (voir le plafond
        // DT_MAXIMUM plus bas) et les ennemis se figeraient, mais surtout on ne veut
        // pas que la partie continue à progresser hors de la vue du joueur. On ne
        // remet volontairement pas enPause à false au retour : le joueur reprend la
        // main lui-même via le bouton Pause/Reprendre. Ce bouton et cette pause
        // automatique agissent sur la même variable, sans logique séparée.
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.enPause = true;
            }
        });

        // Une carte est générée dès le chargement pour qu'un arrière-plan existe
        // derrière l'écran d'accueil, même avant qu'une partie ne démarre.
        Carte.generer();
        this.redimensionner();

        requestAnimationFrame(horodatage => this.boucle(horodatage));
    },

    // Vrai si la media query MEDIA_PAYSAGE_MOBILE correspond actuellement — factorisé
    // ici pour n'écrire cette chaîne qu'une seule fois (voir la constante ci-dessus) et
    // parce que window.matchMedia(...).matches est réévalué à chaque appel (pas
    // d'objet MediaQueryList mis en cache : ce mode change trop rarement en cours de
    // partie — seulement à une rotation d'écran, qui déclenche de toute façon déjà
    // resize — pour que ça vaille la peine).
    enModePaysageMobile() {
        return window.matchMedia(this.MEDIA_PAYSAGE_MOBILE).matches;
    },

    // Adapte le canvas à la largeur disponible tout en conservant le ratio
    // COLONNES:LIGNES. On recalcule width/height en pixels réels (pas en CSS), sinon
    // le navigateur étire l'image déjà dessinée et le rendu devient flou.
    redimensionner() {
        const ratio = Config.COLONNES / Config.LIGNES;
        const conteneur = this.canvas.parentElement;
        const largeurDisponible = conteneur.clientWidth;

        let largeur = Math.floor(largeurDisponible);
        let hauteur = Math.floor(largeur / ratio);

        // Mode paysage mobile (contenu additionnel post-lancement) : en dessous de
        // MEDIA_PAYSAGE_MOBILE (voir plus haut, la même requête que celle de
        // style.css), .conteneur-canvas reçoit une vraie hauteur du layout en grille
        // (voir style.css) au lieu de la laisser dériver du canvas lui-même comme en
        // portrait — sans ce second plafond, un canvas dimensionné sur la seule
        // largeur disponible (large en paysage) déborderait largement d'un écran de
        // téléphone, court dans cette orientation. Repli sur `clientHeight` seulement
        // quand cette media query correspond : hors de ce cas (portrait, desktop),
        // .conteneur-canvas n'a pas de hauteur propre (elle dérive du canvas), donc
        // lire clientHeight ici renverrait la hauteur du rendu précédent plutôt qu'une
        // vraie contrainte — sans ce garde-fou, le tout premier appel (avant que le
        // canvas n'ait de hauteur) figerait le jeu à une hauteur de 0.
        if (this.enModePaysageMobile()) {
            const hauteurDisponible = conteneur.clientHeight;
            if (hauteurDisponible > 0 && hauteur > hauteurDisponible) {
                hauteur = Math.floor(hauteurDisponible);
                largeur = Math.floor(hauteur * ratio);
            }
        }

        this.canvas.width = largeur;
        this.canvas.height = hauteur;

        Carte.tailleCase = largeur / Config.COLONNES;
        Carte.recalculerPixels();

        // Voir le commentaire sur Jeu.facteurEchelle plus haut : 40 px est la taille
        // de case à laquelle toutes les valeurs de vitesse et de distance de Config
        // ont été calibrées (Config.LARGEUR_REFERENCE / Config.COLONNES).
        this.facteurEchelle = Carte.tailleCase / 40;

        this.dessinerTout();
    },

    // Crée le pool de projectiles réutilisables, une seule fois pour toute la durée
    // de vie de la page. Voir la note en tête de tour.js : on ne crée jamais de
    // projectile avec `new` en cours de partie, pour éviter de solliciter le
    // ramasse-miettes du navigateur.
    initialiserPoolProjectiles() {
        this.poolProjectiles = [];
        for (let i = 0; i < Config.TAILLE_POOL_PROJECTILES; i++) {
            this.poolProjectiles.push(new Projectile());
        }
    },

    // Dessine l'état courant du jeu : carte, tours, ennemis, projectiles actifs,
    // particules (phase 4B, toujours par-dessus le reste de la scène pour rester
    // visibles), puis l'aperçu de construction (Interface) en tout dernier.
    //
    // ctx.clearRect() en tout premier (phase 7C, correctif transparence) : jusqu'ici
    // inutile puisque Carte.dessiner recouvrait déjà tout le canvas d'un fond
    // pleinement opaque à chaque frame, ce qui en tenait lieu de facto. Depuis que ce
    // fond (et celui des cases libres) est devenu semi-transparent
    // (Config.COULEURS.fondTranslucide/caseLibreTranslucide), un remplissage
    // translucide ne *remplace* plus le contenu déjà présent sur le canvas — il se
    // *compose* par-dessus (composite « source-over », le mode par défaut). Sans ce
    // clearRect, chaque frame ajouterait un peu plus d'opacité par-dessus celle de la
    // frame précédente, jamais réinitialisée : l'effet de transparence convergerait
    // visiblement vers l'opacité totale au bout de quelques secondes de jeu réel,
    // plutôt que de rester stable.
    dessinerTout() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        Carte.dessiner(this.ctx);
        for (const tour of this.toursActives) {
            tour.dessiner(this.ctx);
            // Unité de Caserne (phase 7E) : dessinée juste après sa tour, sur la case
            // de chemin qu'elle bloque plutôt que sur celle de la tour elle-même.
            // UniteCaserne.dessiner() se retire elle-même si vivante est fausse.
            if (tour.unite) {
                tour.unite.dessiner(this.ctx);
            }
        }
        for (const ennemi of this.ennemisActifs) {
            ennemi.dessiner(this.ctx);
        }
        for (const projectile of this.poolProjectiles) {
            projectile.dessiner(this.ctx);
        }
        Particules.dessiner(this.ctx);
        Interface.dessinerApercuConstruction(this.ctx);
    },

    // Boucle principale, rappelée à chaque image par requestAnimationFrame. Tourne en
    // continu quel que soit etatPartie (pour rester réactive à un redimensionnement
    // ou refléter les écrans superposés), mais ne simule la partie que pendant
    // 'enCours' et hors pause.
    boucle(horodatage) {
        if (this.dernierHorodatage === null) {
            this.dernierHorodatage = horodatage;
        }

        // dt en secondes, plafonné à Config.DT_MAXIMUM AVANT tout autre traitement.
        // Sans ce plafond, un onglet remis au premier plan après une longue absence
        // (le navigateur suspend l'exécution pendant qu'il est en arrière-plan)
        // produirait un dt énorme, et les ennemis traverseraient instantanément
        // toute la carte au réveil.
        let dt = (horodatage - this.dernierHorodatage) / 1000;
        this.dernierHorodatage = horodatage;
        dt = Math.min(dt, Config.DT_MAXIMUM);

        // Décor d'arrière-plan (phase 7C) : mis à jour et dessiné à chaque frame, sans
        // condition sur etatPartie ni enPause — c'est un arrière-plan ambiant, pas une
        // partie de la simulation de jeu, il continue de défiler pendant une pause, sur
        // l'écran d'accueil ou sur les écrans de fin. Reçoit ce dt déjà plafonné mais
        // *avant* la multiplication par vitesseJeu ci-dessous : sa vitesse de
        // défilement ne doit jamais varier avec le bouton Vitesse ×2.
        Decor.mettreAJour(dt);
        Decor.dessiner(Decor.ctx);

        // Le multiplicateur de vitesse ne s'applique qu'à la simulation, et
        // seulement après le plafonnement ci-dessus : appliquer l'ordre inverse
        // ferait qu'un bond de dt après un changement d'onglet serait doublé en
        // mode Vitesse ×2. Le dt réel (non multiplié) continue de piloter les
        // éléments d'interface (ex. le minuteur du message de construction), pour
        // que la vitesse ×2 n'accélère pas aussi ces éléments.
        if (this.etatPartie === 'enCours' && !this.enPause) {
            this.simuler(dt * this.vitesseJeu);
        }

        this.dessinerTout();
        Interface.mettreAJourEcrans(dt);

        requestAnimationFrame(h => this.boucle(h));
    },

    // Fait avancer la simulation d'un pas dt : déplacement des ennemis, tours,
    // projectiles, nettoyage des ennemis arrivés/morts, mise à jour des vagues, puis
    // vérification des conditions de fin de partie.
    simuler(dt) {
        for (const ennemi of this.ennemisActifs) {
            ennemi.deplacer(dt);
        }

        for (const tour of this.toursActives) {
            tour.mettreAJour(dt, this.ennemisActifs, this.poolProjectiles);
        }

        for (const projectile of this.poolProjectiles) {
            // ennemisActifs transmis pour les dégâts de zone du Flak (phase 7D) : les
            // trois autres types de projectile reçoivent ce paramètre sans jamais s'en
            // servir, voir la note en tête de Projectile.mettreAJour (tour.js).
            projectile.mettreAJour(dt, this.ennemisActifs);
        }

        Particules.mettreAJour(dt);

        // Combats corps à corps des Casernes (phase 7E) : après le déplacement (donc
        // après que le blocage de cette frame, voir Ennemi.deplacer, soit déjà
        // déterminé) et avant le nettoyage ci-dessous, pour qu'un ennemi tué par une
        // unité soit traité par ce même nettoyage — récompense, explosion, son —
        // exactement comme une mort par tour, sans dupliquer cette logique ici.
        this.resoudreCombatsCasernes(dt);

        // On parcourt le tableau à l'envers pour pouvoir le modifier (splice) pendant
        // l'itération sans sauter un élément sur deux, comme cela arriverait avec une
        // boucle classique du début vers la fin.
        for (let i = this.ennemisActifs.length - 1; i >= 0; i--) {
            const ennemi = this.ennemisActifs[i];

            if (ennemi.arrive) {
                // Un ennemi arrivé à destination ne rapporte aucun crédit.
                this.integrite = Math.max(0, this.integrite - Config.DEGATS_INTEGRITE_PAR_ENNEMI);
                Son.jouerAlerte();
                this.ennemisActifs.splice(i, 1);
            } else if (!ennemi.vivant) {
                this.credits += ennemi.recompense;
                Particules.creerExplosion(ennemi.x, ennemi.y, ennemi.couleur);
                Son.jouerMort(ennemi.type);
                this.ennemisActifs.splice(i, 1);
            }
        }

        Vagues.mettreAJour(dt, this.ennemisActifs);
        if (Vagues.credits > 0) {
            this.credits += Vagues.credits;
            Vagues.credits = 0;
        }

        this.verifierFinDePartie();
    },

    // Résout, pour chaque Caserne dont l'unité est vivante, le combat au corps à
    // corps contre l'ennemi qu'elle bloque (phase 7E) — une seule fois par frame
    // pour toutes les Casernes à la fois, plutôt que dans Tour.mettreAJour (qui ne
    // gère que la réapparition de l'unité, voir tour.js), pour rester au même
    // niveau que le reste de la simulation inter-entités (comme les impacts de
    // projectiles, qui vivent eux aussi dans jeu.js/tour.js et non isolément par
    // tour). Même prédicat de blocage qu'Ennemi.deplacer (indexBlocage <=
    // indexProchainPoint), évalué ici du point de vue de la Caserne plutôt que de
    // l'ennemi.
    resoudreCombatsCasernes(dt) {
        for (const tour of this.toursActives) {
            if (tour.typeDegats !== 'caserne') continue;

            const unite = tour.unite;
            if (!unite || !unite.vivante) continue;

            // Parmi les ennemis actuellement bloqués sur le chemin de cette unité, le
            // plus proche de son point de blocage — dans le cas le plus courant, il
            // n'y en aura qu'un (voir la limite assumée dans Ennemi.deplacer :
            // plusieurs ennemis bloqués au même point s'y superposent visuellement
            // plutôt que de former une file, ce n'est délibérément pas résolu ici).
            // Un drone (phase 7F) ne peut jamais être choisi ici sans condition
            // supplémentaire à écrire : son `cheminIndex` vaut toujours `null` (voir
            // ennemi.js), qui ne peut jamais correspondre au `cheminIndex` bien réel
            // de `unite` (0 ou plus) — exactement le même principe que le blocage
            // dans Ennemi.deplacer, qu'un drone ne lit d'ailleurs jamais non plus.
            let ennemiProche = null;
            let distanceMinimale = Infinity;
            for (const ennemi of this.ennemisActifs) {
                if (!ennemi.vivant || ennemi.arrive) continue;
                if (ennemi.cheminIndex !== unite.cheminIndex) continue;
                if (ennemi.indexPointDePassage + 1 < unite.indexPointDePassage) continue;

                const distance = Math.hypot(ennemi.x - unite.x, ennemi.y - unite.y);
                if (distance < distanceMinimale) {
                    distanceMinimale = distance;
                    ennemiProche = ennemi;
                }
            }

            if (!ennemiProche) continue;

            // Dégâts continus des deux côtés, proportionnels à dt comme tout le
            // reste de la simulation — pas un dégât fixe par frame, qui dépendrait
            // sinon de la fréquence d'images.
            unite.pointsDeVie -= ennemiProche.degatsCorpsACorps * dt;
            // subirDegats, comme le ferait un projectile : c'est ce qui déclenche
            // ennemi.vivant = false le cas échéant, repéré et traité (récompense,
            // explosion, son) par le nettoyage juste après l'appel à cette méthode.
            ennemiProche.subirDegats(unite.degats * dt);

            if (unite.pointsDeVie <= 0) {
                unite.pointsDeVie = 0;
                unite.vivante = false;
                Particules.creerExplosion(unite.x, unite.y, tour.couleur);
                tour.unite = null;
                tour.tempsDepuisDestruction = 0;
            }
        }
    },

    // La défaite survient dès que l'intégrité tombe à 0, sans attendre que les
    // ennemis déjà en piste terminent leur trajet : simuler() ne sera plus rappelée
    // dès la frame suivante puisque etatPartie ne vaudra alors plus 'enCours'. La
    // victoire ne peut survenir qu'en mode à durée finie (Number.isFinite) : en mode
    // Sans fin, seule la défaite met fin à la partie.
    // Son.jouerDefaite()/jouerVictoire() sont appelés ici, à l'endroit exact de la
    // transition d'état, et nulle part ailleurs (jamais depuis Interface ni depuis
    // mettreAJourEcrans, qui serait rappelée en boucle tant que l'écran de fin reste
    // affiché) : verifierFinDePartie() elle-même ne sera plus rappelée tant que
    // etatPartie ne repasse pas à 'enCours', garantissant une seule lecture par
    // partie (voir la note sur finaliserPartie ci-dessous).
    verifierFinDePartie() {
        if (this.integrite <= 0) {
            this.etatPartie = 'defaite';
            Son.jouerDefaite();
            this.finaliserPartie(false);
            return;
        }

        const derniereVagueNettoyee = Vagues.numeroVagueActuelle === this.nombreDeVagues
            && !Vagues.enCours
            && this.ennemisActifs.length === 0;

        if (Number.isFinite(this.nombreDeVagues) && derniereVagueNettoyee) {
            this.etatPartie = 'victoire';
            Son.jouerVictoire();
            this.finaliserPartie(true);
        }
    },

    // Calcule l'XP gagnée pendant la partie qui vient de se terminer et met à jour
    // Progression en conséquence. Appelée une seule fois par partie, exactement au
    // moment de la transition vers 'victoire' ou 'defaite' ci-dessus (simuler() ne
    // sera plus rappelée ensuite tant que etatPartie ne vaut pas 'enCours', donc
    // verifierFinDePartie() elle-même ne sera plus rappelée non plus).
    finaliserPartie(estVictoire) {
        // Une vague ne compte que si elle est elle-même allée à son terme (tous ses
        // ennemis morts ou arrivés, Vagues.enCours retombé à false — voir le même
        // critère dans Vagues.mettreAJour) : une défaite survenue en pleine vague n
        // ne récompense donc que les n - 1 vagues précédentes, pas la vague interrompue.
        const vaguesTerminees = Vagues.enCours ? Math.max(0, Vagues.numeroVagueActuelle - 1) : Vagues.numeroVagueActuelle;

        let xpGagnee = 0;
        for (let numero = 1; numero <= vaguesTerminees; numero++) {
            xpGagnee += Config.XP_BASE_PAR_VAGUE + numero * Config.XP_BONUS_PAR_NUMERO_VAGUE;
        }
        if (estVictoire) {
            xpGagnee += Config.XP_BONUS_VICTOIRE;
        }

        const niveauAvant = Progression.niveau;
        const niveauxGagnes = Progression.ajouterXp(xpGagnee);

        Progression.partiesJouees++;
        // Le mode Sans fin ne se termine jamais par une victoire (voir plus haut) :
        // ce record n'a donc en pratique de sens qu'à la défaite, mais le calcul
        // reste correct quel que soit estVictoire.
        if (!Number.isFinite(this.nombreDeVagues) && Vagues.numeroVagueActuelle > Progression.meilleureVagueSansFin) {
            Progression.meilleureVagueSansFin = Vagues.numeroVagueActuelle;
        }

        // Seul moment où Progression écrit dans localStorage pendant que le jeu
        // tourne : jamais à chaque frame ni à chaque vague, voir la note en tête de
        // progression.js.
        Progression.sauvegarder();

        this.derniereProgression = {
            xpGagnee,
            niveauAvant,
            niveauApres: Progression.niveau,
            niveauxGagnes
        };
    },

    // Démarre une nouvelle partie dans la durée choisie à l'accueil.
    demarrerPartie(idDuree) {
        this.idDureeActuelle = idDuree;
        this.reinitialiser(idDuree);
        this.etatPartie = 'enCours';
    },

    // Relance une partie dans la même durée que la précédente, avec une nouvelle
    // carte (aucune graine fournie à reinitialiser).
    rejouer() {
        this.reinitialiser(this.idDureeActuelle);
        this.etatPartie = 'enCours';
    },

    // Retourne à l'écran d'accueil sans démarrer de partie.
    retourAccueil() {
        this.etatPartie = 'accueil';
    },

    // Remet à zéro tout l'état d'une partie et fixe Jeu.nombreDeVagues d'après
    // idDuree. Si `graine` est omise, une graine aléatoire est tirée à partir de
    // l'horloge (voir Aleatoire.initialiser).
    reinitialiser(idDuree, graine) {
        const duree = Config.DUREES_PARTIE.find(d => d.id === idDuree);
        this.nombreDeVagues = duree.nombreDeVagues;

        Carte.generer(graine);

        // Limite de tours (phase 6B) : calculée ici, juste après la génération et
        // avant toute construction, à partir des cases 'LIBRE' de la carte qui vient
        // d'être générée — jamais recalculée en cours de partie (voir la note sur
        // Jeu.limiteTours plus haut). À graine égale, Carte.generer produit toujours
        // la même grille, donc toujours la même limite.
        let casesLibres = 0;
        for (const rangee of Carte.grille) {
            for (const etat of rangee) {
                if (etat === 'LIBRE') casesLibres++;
            }
        }
        this.limiteTours = Math.floor(casesLibres * Config.PROPORTION_LIMITE_TOURS);

        this.ennemisActifs = [];
        this.toursActives = [];
        // Les bonus permanents éventuellement débloqués par le joueur (phase 3B,
        // Progression.bonusCreditsDepart/bonusIntegriteDepart) s'ajoutent aux valeurs
        // de base dès le début de chaque partie, quelle que soit la durée choisie —
        // renvoient 0 tant que le palier correspondant n'est pas débloqué, donc ces
        // lignes n'ont aucun effet pour un joueur qui n'a pas encore atteint le niveau
        // requis.
        this.credits = Config.CREDITS_DEPART + Progression.bonusCreditsDepart();
        this.integrite = Config.INTEGRITE_DEPART + Progression.bonusIntegriteDepart();
        this.enPause = false;
        this.vitesseJeu = 1;

        for (const projectile of this.poolProjectiles) {
            projectile.actif = false;
        }
        // Même principe pour les particules éventuellement encore actives d'une
        // partie précédente (phase 4B) : jamais recréées, seulement désactivées.
        for (const particule of Particules.pool) {
            particule.actif = false;
        }

        Vagues.reinitialiser();

        // Le type de tour à construire revient au type par défaut à chaque nouvelle
        // partie plutôt que de garder la sélection de la partie précédente ; aucune
        // tour de la partie précédente ne doit non plus rester sélectionnée (le
        // panneau d'amélioration serait sinon associé à une tour qui n'existe plus).
        Interface.typeSelectionne = Config.TYPE_TOUR_PAR_DEFAUT;
        Interface.tourSelectionnee = null;
        // Correctif mobile : une case restée en attente de confirmation tactile d'une
        // partie précédente n'aurait plus de sens sur la nouvelle carte générée
        // ci-dessus (même colonne/ligne, mais un état de grille différent).
        Interface.effacerAttenteConfirmationTactile();

        // La taille de case dépend du canvas déjà dimensionné ; redimensionner()
        // recalcule aussi les pixels du chemin et redessine tout.
        this.redimensionner();

        // Progression (niveau, XP) n'est volontairement pas touchée ici : contrairement
        // à tout ce qui précède, cet état survit à une nouvelle partie (voir la note en
        // tête de progression.js) — seuls ses bonus permanents (phase 3B, lus plus haut
        // via Progression.bonusCreditsDepart/bonusIntegriteDepart) influencent le
        // départ d'une partie.
    }
};

window.addEventListener('DOMContentLoaded', () => Jeu.initialiser());

// Enregistrement du service worker (phase 5). Placé ici plutôt qu'en ligne dans
// index.html pour rester dans le seul fichier déjà responsable du point d'entrée de la
// page. Sous file://, navigator.serviceWorker.register échoue systématiquement (les
// navigateurs n'activent les service workers que sur une origine http(s)) : c'est
// attendu, pas une erreur à corriger, d'où le .catch qui se contente d'un
// console.warn plutôt que de laisser une exception non gérée — le jeu doit continuer
// de fonctionner normalement à la fois sous file:// et si l'enregistrement échoue
// pour toute autre raison.
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
        .catch((erreur) => console.warn('Service worker non disponible :', erreur));
}
