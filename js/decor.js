// decor.js — Objet Decor (phase 7C, contenu additionnel post-lancement) : skyline en
// parallaxe à deux couches, dessiné sur un second canvas (#canvas-decor) totalement
// indépendant du canvas de jeu, positionné en CSS derrière .conteneur-canvas (voir
// style.css) et visible uniquement dans les marges qui l'entourent. Purement
// scénographique : aucun effet sur le déroulement ni l'équité d'une partie, jamais lu
// par le reste du code du jeu. Depuis la phase 7C bis, gère aussi le chargement (et le
// repli silencieux) d'une image de fond fixe affichée par-dessus ce skyline — voir
// initialiserImageFond() plus bas.

const Decor = {
    canvas: null,
    ctx: null,

    // Bâtiments de chaque couche : générés une seule fois au chargement de la page
    // (voir initialiser ci-dessous), puis seulement repositionnés en boucle par
    // deplacerCouche — jamais recréés. Même principe de recyclage que les projectiles
    // (tour.js) ou les particules (particules.js), appliqué ici à un simple
    // repositionnement plutôt qu'à un pool actif/inactif : le nombre de bâtiments par
    // couche reste constant du début à la fin de la session.
    batimentsLointain: [],
    batimentsProche: [],

    initialiser() {
        this.canvas = document.getElementById('canvas-decor');
        this.ctx = this.canvas.getContext('2d');

        this.redimensionner();
        // Indépendant de l'écouteur resize de Jeu.redimensionner() (jeu.js) : les deux
        // canvas ne se redimensionnent jamais l'un à cause de l'autre, voir
        // redimensionner() ci-dessous.
        window.addEventListener('resize', () => this.redimensionner());

        // Générés une seule fois ici, jamais régénérés à un redimensionnement
        // ultérieur (seul le canvas lui-même l'est, voir redimensionner()) : chaque
        // couche reçoit sa propre fourchette de hauteur, la couche proche plus haute
        // que la lointaine pour renforcer l'impression de profondeur (le contraste de
        // couleur, lui, vient uniquement de Config.COULEURS.decorLointain/decorProche,
        // appliquées telles quelles dans dessinerCouche).
        this.batimentsLointain = this.genererCouche(Config.DECOR_NOMBRE_BATIMENTS_LOINTAIN, 50, 140);
        this.batimentsProche = this.genererCouche(Config.DECOR_NOMBRE_BATIMENTS_PROCHE, 90, 220);

        this.initialiserImageFond();
    },

    // Image de fond fixe (phase 7C bis), affichée par-dessus le skyline procédural
    // quand elle est disponible (#image-decor, images/decor-fond.webp), sans jamais le
    // remplacer : au chargement, `.image-decor--visible` la fait apparaître en fondu
    // (voir style.css) ; si elle est absente ou invalide (404, format non supporté...),
    // l'événement `error` se contente d'un avertissement — l'image reste à opacity 0,
    // invisible, et le skyline du dessous (jamais interrompu, aucune des deux méthodes
    // ci-dessous ne dépend de cet état) reste seul visible. C'est ce qui rend ce repli
    // gratuit : rien de spécial à faire en cas d'échec, seulement à ne rien faire de
    // plus en cas de succès.
    initialiserImageFond() {
        const image = document.getElementById('image-decor');

        const surChargement = () => {
            image.classList.add('image-decor--visible');
        };
        const surErreur = () => {
            console.warn('Défense Néon : image de décor introuvable ou invalide, le skyline procédural reste affiché.');
        };

        image.addEventListener('load', surChargement);
        image.addEventListener('error', surErreur);

        // Piège de course rencontré en testant : le navigateur commence à charger
        // <img src="..."> dès l'analyse du HTML, bien avant que ce script ne s'exécute
        // (DOMContentLoaded). Sur un serveur qui répond très vite à un fichier absent
        // (constaté en local), le chargement peut déjà être terminé — en échec — au
        // moment où les écouteurs ci-dessus sont posés, et l'événement `error` déjà
        // passé ne se redéclenche jamais pour eux (vérifié : `image.complete` vrai et
        // `image.naturalWidth` à 0 dès ce point, sans qu'aucun des deux écouteurs
        // n'ait jamais tourné). `image.complete` vaut vrai à la fois en cas de succès
        // et d'échec déjà résolus ; `naturalWidth` distingue les deux (0 en cas
        // d'échec, une vraie valeur en cas de succès) pour appeler manuellement le bon
        // gestionnaire dans ce cas précis.
        if (image.complete) {
            if (image.naturalWidth > 0) {
                surChargement();
            } else {
                surErreur();
            }
        }
    },

    // Le second canvas remplit tout le viewport (voir style.css : position: fixed;
    // inset: 0), sans contrainte de ratio contrairement au canvas de jeu — il n'a
    // besoin que de couvrir l'espace disponible, pas de conserver une proportion
    // précise. width/height sont fixés en pixels réels (pas seulement en CSS), sinon
    // le navigateur étirerait le contenu déjà dessiné et le rendu deviendrait flou —
    // même raison que pour le canvas de jeu (voir Jeu.redimensionner, jeu.js).
    redimensionner() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    },

    // Génère `nombre` bâtiments côte à côte, avec de petits espacements aléatoires,
    // sur une largeur totale d'environ deux fois la largeur de la fenêtre au moment du
    // chargement — de la marge avant qu'un défilement ne devienne visible (voir
    // deplacerCouche). La largeur moyenne d'un bâtiment est donc dérivée de la largeur
    // de fenêtre courante plutôt que fixée en dur, pour que `nombre` bâtiments
    // atteignent ce total quelle que soit la taille de l'écran ; la hauteur, elle, est
    // tirée dans [hauteurMin, hauteurMax], la fourchette propre à la couche appelante.
    //
    // Exception délibérée à la règle du générateur à graine (Aleatoire) suivie partout
    // ailleurs dans le jeu depuis la phase 1A : le décor n'a aucun effet sur le
    // déroulement ni l'équité d'une partie, c'est de la scénographie pure — inutile de
    // payer le coût d'une dépendance à la reproductibilité pour l'aspect de bâtiments
    // purement décoratifs. Math.random() est donc utilisé directement ici, seul
    // endroit du jeu où c'est le cas en dehors de particules.js (déjà justifié de la
    // même façon).
    genererCouche(nombre, hauteurMin, hauteurMax) {
        const largeurMoyenne = (window.innerWidth * 2) / nombre;
        const batiments = [];
        let x = 0;

        for (let i = 0; i < nombre; i++) {
            const largeur = largeurMoyenne * (0.6 + Math.random() * 0.8);
            const hauteur = hauteurMin + Math.random() * (hauteurMax - hauteurMin);

            // Deux ou trois petites fenêtres éclairées sur environ 6 bâtiments sur 10,
            // à des positions fixes (statiques pour cette phase, pas de clignotement).
            const fenetres = [];
            if (Math.random() < 0.6) {
                const nombreFenetres = 2 + Math.floor(Math.random() * 2);
                for (let f = 0; f < nombreFenetres; f++) {
                    fenetres.push({
                        x: largeur * (0.2 + Math.random() * 0.6),
                        y: hauteur * (0.15 + Math.random() * 0.7)
                    });
                }
            }

            batiments.push({ x, largeur, hauteur, fenetres });
            x += largeur + this.espacementAleatoire();
        }

        return batiments;
    },

    espacementAleatoire() {
        return 4 + Math.random() * 16;
    },

    // Fait défiler les deux couches, chacune à sa propre vitesse constante. Appelée à
    // chaque frame par Jeu.boucle sans condition sur etatPartie ni enPause : c'est un
    // arrière-plan ambiant, pas une partie de la simulation de jeu, il continue de
    // vivre pendant une pause, sur l'écran d'accueil ou sur les écrans de fin. `dt` est
    // celui déjà plafonné à Config.DT_MAXIMUM dans Jeu.boucle, mais transmis *avant*
    // la multiplication par Jeu.vitesseJeu (contrairement à celui passé à
    // Jeu.simuler juste après) : la vitesse de défilement ne doit jamais varier avec
    // le bouton Vitesse ×2.
    mettreAJour(dt) {
        this.deplacerCouche(this.batimentsLointain, Config.DECOR_VITESSE_LOINTAIN, dt);
        this.deplacerCouche(this.batimentsProche, Config.DECOR_VITESSE_PROCHE, dt);
    },

    // Recyclage plutôt que création/destruction (même principe que les projectiles et
    // particules), mais appliqué ici à un simple repositionnement plutôt qu'à un pool
    // actif/inactif : le nombre de bâtiments par couche reste constant, ils tournent
    // en boucle sans jamais être recréés. Un bâtiment entièrement sorti de l'écran par
    // la gauche (son bord droit passé sous x = 0) est replacé juste après le bâtiment
    // le plus à droite de sa propre couche, avec un nouvel espacement aléatoire — ce
    // recyclage n'a lieu que hors champ, donc invisible pour le joueur.
    deplacerCouche(batiments, vitesse, dt) {
        for (const batiment of batiments) {
            batiment.x -= vitesse * dt;
        }

        for (const batiment of batiments) {
            if (batiment.x + batiment.largeur < 0) {
                const bordDroit = Math.max(...batiments.map(b => b.x + b.largeur));
                batiment.x = bordDroit + this.espacementAleatoire();
            }
        }
    },

    // Couche lointaine d'abord, couche proche par-dessus. Un fond plein
    // (Config.COULEURS.fond, la même teinte que le fond de page) est posé avant les
    // deux couches : contrairement au canvas de jeu, ce canvas n'a pas de fond opaque
    // garanti par ailleurs (voir la Section 0 du prompt de cette phase), donc l'espace
    // entre deux bâtiments espacés doit être rempli explicitement plutôt que de
    // compter sur le CSS pour ne jamais laisser transparaître un bord non dessiné.
    dessiner(ctx) {
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.fillStyle = Config.COULEURS.fond;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.dessinerCouche(ctx, this.batimentsLointain, Config.COULEURS.decorLointain);
        this.dessinerCouche(ctx, this.batimentsProche, Config.COULEURS.decorProche);
    },

    // Un shadowBlur léger est utilisé ici sur les bâtiments (Config.DECOR_HALO_FLOU).
    // Ce n'est *pas* une contradiction avec la règle posée en phase 4A (éviter
    // shadowBlur sur les éléments nombreux et redessinés chaque frame — la grille de
    // 240 cases, ou les particules potentiellement par centaines) : c'est la même
    // règle, appliquée cohéremment à un cas différent. Ce canvas ne contient jamais
    // plus d'une quinzaine de formes au total (DECOR_NOMBRE_BATIMENTS_LOINTAIN +
    // _PROCHE), sans rapport avec l'échelle des éléments du plateau de jeu — le coût
    // de rendu par appel de shadowBlur, proportionnel au nombre d'appels, reste donc
    // négligeable ici alors qu'il ne le serait pas sur des dizaines d'ennemis ou des
    // centaines de particules. Reposé à 0 immédiatement après les bâtiments, avant les
    // fenêtres, mêmes principe qu'ailleurs dans le jeu : ne jamais laisser un halo
    // déteindre sur ce qui est dessiné ensuite dans la même frame.
    dessinerCouche(ctx, batiments, couleur) {
        const basY = this.canvas.height;

        ctx.fillStyle = couleur;
        ctx.shadowColor = couleur;
        ctx.shadowBlur = Config.DECOR_HALO_FLOU;
        for (const batiment of batiments) {
            ctx.fillRect(batiment.x, basY - batiment.hauteur, batiment.largeur, batiment.hauteur);
        }
        ctx.shadowBlur = 0;

        ctx.fillStyle = Config.COULEURS.decorFenetre;
        for (const batiment of batiments) {
            const y = basY - batiment.hauteur;
            for (const fenetre of batiment.fenetres) {
                ctx.fillRect(batiment.x + fenetre.x, y + fenetre.y, 3, 3);
            }
        }
    }
};
