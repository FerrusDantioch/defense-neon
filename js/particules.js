// particules.js — Objet Particules : petits effets visuels (flash de tir, impact,
// explosion à la mort d'un ennemi), recyclés via un pool exactement comme les
// projectiles (voir la note en tête de tour.js) : jamais créées avec `new` en cours de
// partie. Purement décoratif — n'affecte jamais la simulation, les crédits ni
// l'intégrité — donc les tirages aléatoires utilisés ici (angle, vitesse) passent par
// Math.random() et non par Aleatoire : consommer le générateur à graine ici décalerait
// la séquence de tirages de Vagues (types d'ennemis générés) et romprait la
// reproductibilité d'une partie à graine fixée, qui ne doit dépendre que du déroulé du
// jeu, jamais du nombre de particules déjà créées.

// Taille de base (avant estompage) et dispersion angulaire du flash de tir : détails de
// rendu purement cosmétiques, gardés en constantes locales plutôt que dans Config,
// comme les ratios de forme des tours ou le rayon des ennemis (voir tour.js/ennemi.js).
const TAILLE_PARTICULE_EXPLOSION = 3;
const TAILLE_PARTICULE_IMPACT = 2;
const TAILLE_PARTICULE_TIR = 2;
const DISPERSION_ANGLE_TIR = Math.PI / 6;

const Particules = {
    pool: [],

    // Crée le pool de particules réutilisables, une seule fois pour toute la durée de
    // vie de la page (voir Jeu.initialiser, même principe que
    // Jeu.initialiserPoolProjectiles).
    initialiser() {
        this.pool = [];
        for (let i = 0; i < Config.PARTICULES_TAILLE_POOL; i++) {
            this.pool.push({
                x: 0,
                y: 0,
                vx: 0,
                vy: 0,
                couleur: '#ffffff',
                tailleInitiale: 0,
                dureeVieRestante: 0,
                dureeVieInitiale: 0,
                actif: false
            });
        }
    },

    // Réinitialise la première particule inactive du pool. Si le pool est déjà
    // entièrement occupé (peu probable, mais possible lors d'une mort en masse), la
    // demande en trop est simplement ignorée plutôt que de faire grandir le tableau.
    activerUne(x, y, vx, vy, couleur, taille, dureeVie) {
        const particule = this.pool.find(p => !p.actif);
        if (!particule) return;

        particule.x = x;
        particule.y = y;
        particule.vx = vx;
        particule.vy = vy;
        particule.couleur = couleur;
        particule.tailleInitiale = taille;
        particule.dureeVieInitiale = dureeVie;
        particule.dureeVieRestante = dureeVie;
        particule.actif = true;
    },

    // Explosion à la mort d'un ennemi : direction tirée uniformément entre 0 et 2π,
    // vitesse aléatoire entre PARTICULE_VITESSE_MIN et PARTICULE_VITESSE_MAX. `nombre`
    // par défaut à PARTICULE_NOMBRE_EXPLOSION (mort d'un ennemi, comportement inchangé
    // depuis la phase 4B) ; l'explosion d'un tir de Flak (phase 7D) passe
    // explicitement PARTICULE_NOMBRE_EXPLOSION_ZONE, nettement plus fournie, pour
    // bien matérialiser l'étendue de sa zone d'effet.
    creerExplosion(x, y, couleur, nombre = Config.PARTICULE_NOMBRE_EXPLOSION) {
        for (let i = 0; i < nombre; i++) {
            const angle = Math.random() * Math.PI * 2;
            const vitesse = Config.PARTICULE_VITESSE_MIN
                + Math.random() * (Config.PARTICULE_VITESSE_MAX - Config.PARTICULE_VITESSE_MIN);
            this.activerUne(
                x, y,
                Math.cos(angle) * vitesse, Math.sin(angle) * vitesse,
                couleur, TAILLE_PARTICULE_EXPLOSION, Config.PARTICULE_DUREE_VIE_EXPLOSION
            );
        }
    },

    // Impact d'un tir qui touche sans achever sa cible : même principe, en plus petit
    // nombre et plus courte durée de vie.
    creerImpact(x, y, couleur) {
        for (let i = 0; i < Config.PARTICULE_NOMBRE_IMPACT; i++) {
            const angle = Math.random() * Math.PI * 2;
            const vitesse = Config.PARTICULE_VITESSE_MIN
                + Math.random() * (Config.PARTICULE_VITESSE_MAX - Config.PARTICULE_VITESSE_MIN);
            this.activerUne(
                x, y,
                Math.cos(angle) * vitesse, Math.sin(angle) * vitesse,
                couleur, TAILLE_PARTICULE_IMPACT, Config.PARTICULE_DUREE_VIE_IMPACT
            );
        }
    },

    // Flash de départ d'un tir : particules projetées dans la direction du tir
    // (angleDirection), pas dans toutes les directions comme les deux fonctions
    // ci-dessus — avec une légère dispersion pour ne pas paraître alignées sur un
    // simple segment.
    creerTir(x, y, angleDirection, couleur) {
        for (let i = 0; i < Config.PARTICULE_NOMBRE_TIR; i++) {
            const angle = angleDirection + (Math.random() - 0.5) * DISPERSION_ANGLE_TIR;
            const vitesse = Config.PARTICULE_VITESSE_MIN
                + Math.random() * (Config.PARTICULE_VITESSE_MAX - Config.PARTICULE_VITESSE_MIN);
            this.activerUne(
                x, y,
                Math.cos(angle) * vitesse, Math.sin(angle) * vitesse,
                couleur, TAILLE_PARTICULE_TIR, Config.PARTICULE_DUREE_VIE_TIR
            );
        }
    },

    mettreAJour(dt) {
        for (const particule of this.pool) {
            if (!particule.actif) continue;

            particule.x += particule.vx * dt;
            particule.y += particule.vy * dt;
            particule.dureeVieRestante -= dt;
            if (particule.dureeVieRestante <= 0) {
                particule.actif = false;
            }
        }
    },

    // Un petit cercle plein par particule active, estompé progressivement (alpha et
    // taille au prorata de la durée de vie restante). Jamais de halo (shadowBlur) ici,
    // à la différence des tours ou des ennemis (phase 4A) : potentiellement des
    // centaines de particules actives en même temps, le coût de rendu par appel n'en
    // vaudrait pas le gain visuel à cette échelle (voir Config.HALO_FLOU_TOUR_BASE).
    dessiner(ctx) {
        for (const particule of this.pool) {
            if (!particule.actif) continue;

            const ratio = particule.dureeVieRestante / particule.dureeVieInitiale;
            ctx.globalAlpha = ratio;
            ctx.fillStyle = particule.couleur;
            ctx.beginPath();
            ctx.arc(particule.x, particule.y, particule.tailleInitiale * ratio, 0, Math.PI * 2);
            ctx.fill();
        }
        // Remis à 1 après coup : un oubli ferait disparaître (ou estomper) tout ce qui
        // est dessiné ensuite dans la même frame, puisque globalAlpha s'applique à
        // n'importe quel dessin tant qu'il n'est pas explicitement changé.
        ctx.globalAlpha = 1;
    }
};
