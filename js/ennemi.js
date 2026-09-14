// ennemi.js — Classe Ennemi : une unité qui suit le chemin de la carte, case par
// case, jusqu'à l'arrivée. Ne connaît rien des vagues qui la génèrent (c'est le rôle
// de vagues.js) ni des tours qui l'attaquent (tour.js) : elle sait seulement se
// déplacer, encaisser des dégâts et se dessiner.

// Les noms de couleurs de Config.TYPES_ENNEMIS ne sont pas tous des mots-clés CSS
// valides ('jaune' n'existe pas pour un canvas) : cette table fait la conversion en
// couleurs hexadécimales réelles, sans toucher à la configuration elle-même.
const COULEURS_CSS_ENNEMIS = {
    cyan: '#00e5ff',
    jaune: '#f1c40f',
    orange: '#ff8c1a'
};

// Teintes claires/sombres dérivées de la couleur de base de chaque type (phase 7A),
// pour les détails des châssis robotiques : capteur/« œil » et accent de réacteur en
// clair, chenilles/plaques d'armure en sombre. Tables volontairement incomplètes —
// seules les entrées réellement utilisées par un châssis sont présentes (le Rapide
// n'a pas de partie sombre, voir dessinerChassisRapide plus bas).
const COULEURS_CSS_ENNEMIS_CLAIR = {
    cyan: '#a6f7ff',
    jaune: '#fff3b0',
    orange: '#ffd9a6'
};
const COULEURS_CSS_ENNEMIS_SOMBRE = {
    cyan: '#0a4a52',
    orange: '#9c4c00'
};

class Ennemi {
    // `type` est une clé de Config.TYPES_ENNEMIS. `multiplicateurPointsDeVie` vient de
    // la vague en cours : il fait grossir les points de vie de base au fil des vagues
    // sans toucher à la vitesse ni à la récompense. `cheminIndex` (phase 6A) fixe une
    // fois pour toutes quel chemin de Carte.chemins cet ennemi suit — tiré par
    // l'appelant (Vagues.mettreAJour) via Aleatoire, jamais changé ensuite.
    constructor(type, multiplicateurPointsDeVie, cheminIndex) {
        const caracteristiques = Config.TYPES_ENNEMIS[type];

        this.type = type;
        this.pointsDeVieMax = Math.round(caracteristiques.pointsDeVie * multiplicateurPointsDeVie);
        this.pointsDeVie = this.pointsDeVieMax;
        this.vitesse = caracteristiques.vitesse;
        this.recompense = caracteristiques.recompense;
        // Dégâts par seconde infligés à une unité de Caserne qui bloque cet ennemi
        // (phase 7E) — voir Jeu.resoudreCombatsCasernes, jeu.js. Sans effet en dehors
        // de ce cas précis (jamais lu par le ciblage des tours à distance).
        this.degatsCorpsACorps = caracteristiques.degatsCorpsACorps;
        this.couleur = COULEURS_CSS_ENNEMIS[caracteristiques.couleur] || caracteristiques.couleur;
        // Conservé à part de this.couleur (déjà résolue en hexadécimal) pour
        // retrouver la bonne teinte claire/sombre du châssis
        // (COULEURS_CSS_ENNEMIS_CLAIR/_SOMBRE ci-dessus, phase 7A) sans avoir à
        // relire Config.TYPES_ENNEMIS à chaque frame dessinée.
        this.nomCouleur = caracteristiques.couleur;

        this.cheminIndex = cheminIndex;

        // Index du prochain point de passage visé dans
        // Carte.chemins[this.cheminIndex].pointsDePassage (0 = le tout premier
        // segment, entre le départ et la case suivante du chemin).
        this.indexPointDePassage = 0;
        this.vivant = true;
        this.arrive = false;

        const depart = Carte.chemins[this.cheminIndex].pointsDePassage[0];
        this.x = depart.x;
        this.y = depart.y;

        // Orientation initiale du châssis (phase 7A), calculée ici de la même façon
        // que dans deplacer() ci-dessous plutôt que laissée à une valeur par défaut :
        // Vagues.mettreAJour() (qui crée les ennemis) est appelée après la boucle de
        // déplacement dans Jeu.simuler() — deplacer() n'aura donc pas encore tourné
        // une seule fois pour ce nouvel ennemi au moment de son tout premier
        // dessiner(), dans la même frame.
        const premierPoint = Carte.chemins[this.cheminIndex].pointsDePassage[1];
        this.angleDirection = premierPoint
            ? Math.atan2(premierPoint.y - this.y, premierPoint.x - this.x)
            : 0;
    }

    // Avance l'ennemi de `vitesse * dt` pixels le long de SON chemin (Carte.chemins
    // [this.cheminIndex] — jamais un autre, y compris à un point où deux chemins se
    // croisent : cet ennemi ne lit que le tableau de points de passage de son propre
    // chemin, il n'a aucun moyen de dévier vers l'autre). On vise toujours le point de
    // passage suivant (jamais plus loin) : quand la distance qui reste jusqu'à ce
    // point est plus courte que le pas de cette frame, on se cale exactement dessus et
    // on passe au segment suivant, plutôt que de continuer tout droit et dévier
    // légèrement du chemin à chaque virage.
    deplacer(dt) {
        if (!this.vivant || this.arrive) return;

        const pointsDePassage = Carte.chemins[this.cheminIndex].pointsDePassage;
        const indexProchainPoint = this.indexPointDePassage + 1;
        const cible = pointsDePassage[indexProchainPoint];
        if (!cible) {
            this.arrive = true;
            return;
        }

        // Blocage par une unité de Caserne (phase 7E) : si une Caserne a une unité
        // vivante sur ce même chemin, dont le point de blocage se situe au niveau du
        // point que cet ennemi s'apprête à atteindre ou avant (indexBlocage <=
        // indexProchainPoint — un ennemi encore plus loin en amont n'est, lui, pas
        // encore concerné), l'ennemi reste figé cette frame plutôt que d'avancer :
        // son combat au corps à corps avec cette unité est résolu ailleurs, une fois
        // par frame pour toutes les Casernes à la fois (Jeu.resoudreCombatsCasernes,
        // jeu.js), pas ici. Plusieurs ennemis bloqués au même point s'y superposeront
        // visuellement plutôt que de former une file organisée — limite assumée,
        // voir ARCHITECTURE.md.
        // PHASE 7F : un futur ennemi volant devra ignorer complètement cette
        // vérification et ne jamais être retenu par un blocage au sol.
        const bloquePar = Jeu.toursActives.find(tour =>
            tour.typeDegats === 'caserne'
            && tour.unite
            && tour.unite.vivante
            && tour.unite.cheminIndex === this.cheminIndex
            && tour.unite.indexPointDePassage <= indexProchainPoint
        );
        if (bloquePar) return;

        const dx = cible.x - this.x;
        const dy = cible.y - this.y;
        const distanceRestante = Math.hypot(dx, dy);

        // Orientation visuelle du châssis (phase 7A), recalculée à chaque frame à
        // partir du même vecteur direction que le déplacement lui-même — avant même
        // de savoir si ce pas atteindra le point de passage visé, pour qu'un virage
        // fasse tourner le châssis dès qu'il s'y engage, pas seulement une fois
        // arrivé exactement sur le point d'angle. Lue par Ennemi.dessiner() pour
        // orienter le dessin ; jamais par aucune mécanique de jeu (ciblage, dégâts,
        // vitesse), qui restent toutes inchangées par cette phase purement visuelle.
        this.angleDirection = Math.atan2(dy, dx);

        // Jeu.facteurEchelle convertit la vitesse de référence (calibrée pour une
        // case de 40 px) en pixels réels selon la taille de case courante : voir le
        // calcul de ce facteur dans Jeu.redimensionner().
        const pas = this.vitesse * Jeu.facteurEchelle * dt;

        if (pas >= distanceRestante) {
            this.x = cible.x;
            this.y = cible.y;
            this.indexPointDePassage++;

            if (this.indexPointDePassage >= pointsDePassage.length - 1) {
                this.arrive = true;
            }
        } else {
            this.x += (dx / distanceRestante) * pas;
            this.y += (dy / distanceRestante) * pas;
        }
    }

    // Inflige des dégâts et marque l'ennemi comme mort si ses points de vie tombent à
    // zéro ou moins. Appelée par Projectile.mettreAJour à l'impact.
    subirDegats(montant) {
        this.pointsDeVie -= montant;
        if (this.pointsDeVie <= 0) {
            this.pointsDeVie = 0;
            this.vivant = false;
        }
    }

    // Dessine l'ennemi : une silhouette de châssis robotique vue de haut (phase 7A,
    // remplace le simple cercle de la phase 4A), orientée dans le sens du déplacement,
    // surmontée d'une barre de vie à deux couleurs. Le rayon caractéristique dépend
    // des points de vie de base du type (pas des points de vie déjà gonflés par le
    // multiplicateur de vague, sinon un Standard tardif finirait par paraître aussi
    // gros qu'un Blindé) — sert à la fois de taille globale du châssis et de
    // dimension de la barre de vie, exactement comme le rayon du cercle qu'il
    // remplace.
    //
    // ctx.translate() + ctx.rotate() orientent tout le dessin du châssis selon
    // this.angleDirection (mis à jour dans deplacer() ci-dessus), à l'intérieur d'un
    // save()/restore() : la rotation ne doit affecter ni la barre de vie ci-dessous
    // (qui doit rester horizontale et lisible quelle que soit l'orientation du
    // robot), ni le reste de la scène dessinée ensuite dans la même frame. Vue du
    // dessus délibérée (châssis façon petit véhicule/drone au sol, jamais un
    // personnage de profil) : cohérent avec l'angle de caméra du reste du plateau
    // (carte, tours), qui est lui aussi vu de haut depuis la phase 1A.
    //
    // Aucun ctx.shadowBlur ici (voir Config.HALO_FLOU_TOUR_BASE et la note associée,
    // config.js) : chaque châssis est composé de plusieurs formes (corps, capteur,
    // chenilles ou plaques), et un halo posé sur chacune multiplierait le coût par
    // appel de shadowBlur par autant de formes et par ennemi — contrairement au
    // simple cercle qu'ils remplacent, où ce coût ne s'appliquait qu'une fois par
    // ennemi. À 60 ennemis à l'écran (le seuil de fluidité visé pour cette phase),
    // cette multiplication ne vaudrait pas le gain visuel, même principe que celui
    // déjà posé en 4A pour les particules et les projectiles.
    dessiner(ctx) {
        const tailleCase = Carte.tailleCase;
        const pointsDeVieBase = Config.TYPES_ENNEMIS[this.type].pointsDeVie;
        const rayon = tailleCase * (0.12 + pointsDeVieBase / 1000);

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angleDirection);

        if (this.type === 'rapide') {
            this.dessinerChassisRapide(ctx, rayon);
        } else if (this.type === 'blinde') {
            this.dessinerChassisBlinde(ctx, rayon);
        } else {
            this.dessinerChassisStandard(ctx, rayon);
        }
        // PHASE 7F : quatrième châssis ici pour le drone volant — silhouette plus
        // anguleuse et aérienne, pensée pour se distinguer d'un coup d'œil des trois
        // véhicules au sol ci-dessus, toujours vue de haut et toujours sans
        // shadowBlur (même raisonnement que ci-dessus).

        ctx.restore();

        const largeurBarre = rayon * 2;
        const hauteurBarre = Math.max(2, tailleCase * 0.06);
        const xBarre = this.x - rayon;
        const yBarre = this.y - rayon - hauteurBarre - 3;
        const ratioVie = this.pointsDeVie / this.pointsDeVieMax;

        ctx.fillStyle = '#555560';
        ctx.fillRect(xBarre, yBarre, largeurBarre, hauteurBarre);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(xBarre, yBarre, largeurBarre * ratioVie, hauteurBarre);
    }

    // Hexagone centré sur l'origine, éventuellement allongé ou aplati selon les deux
    // rayons donnés (rayonX ≠ rayonY) — partagé par les châssis Standard et Blindé
    // ci-dessous, seules leurs proportions et leur remplissage diffèrent. Même
    // principe de forme partagée que Tour.dessinerSoclePolygone (tour.js). Appelée
    // uniquement en coordonnées locales (après translate()/rotate() dans dessiner()
    // ci-dessus) : +x pointe toujours vers l'avant du châssis.
    dessinerHexagone(ctx, rayonX, rayonY) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const px = Math.cos(angle) * rayonX;
            const py = Math.sin(angle) * rayonY;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
    }

    // Châssis Standard (phase 7A) : hexagone légèrement allongé dans le sens de la
    // marche, capteur circulaire clair pointant vers l'avant, deux chenilles
    // latérales sombres de part et d'autre du corps — le châssis de référence, ni le
    // plus véloce ni le plus massif des trois.
    dessinerChassisStandard(ctx, rayon) {
        ctx.fillStyle = this.couleur;
        this.dessinerHexagone(ctx, rayon * 1.15, rayon * 0.85);

        ctx.fillStyle = COULEURS_CSS_ENNEMIS_CLAIR[this.nomCouleur];
        ctx.beginPath();
        ctx.arc(rayon * 0.45, 0, rayon * 0.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = COULEURS_CSS_ENNEMIS_SOMBRE[this.nomCouleur];
        const largeurChenille = rayon * 1.5;
        const hauteurChenille = rayon * 0.32;
        ctx.fillRect(-largeurChenille / 2, rayon * 0.95 - hauteurChenille / 2, largeurChenille, hauteurChenille);
        ctx.fillRect(-largeurChenille / 2, -rayon * 0.95 - hauteurChenille / 2, largeurChenille, hauteurChenille);
    }

    // Châssis Rapide (phase 7A) : profil effilé en flèche mousse (nez pointu, épaules
    // larges, arrière tronqué), plus étroit et plus long que le Standard, sans
    // chenilles — il glisse plutôt qu'il ne roule. Petit accent lumineux triangulaire
    // à l'arrière, purement décoratif (repère de vitesse), jamais un halo au sens de
    // la règle de performance de la phase 4A : voir la note sur l'absence de
    // shadowBlur dans dessiner() ci-dessus, qui s'applique aussi à ce triangle.
    dessinerChassisRapide(ctx, rayon) {
        ctx.fillStyle = this.couleur;
        ctx.beginPath();
        ctx.moveTo(rayon * 1.6, 0);
        ctx.lineTo(rayon * 0.2, rayon * 0.55);
        ctx.lineTo(-rayon * 1.0, rayon * 0.3);
        ctx.lineTo(-rayon * 1.0, -rayon * 0.3);
        ctx.lineTo(rayon * 0.2, -rayon * 0.55);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = COULEURS_CSS_ENNEMIS_CLAIR[this.nomCouleur];
        ctx.beginPath();
        ctx.moveTo(-rayon * 1.0, rayon * 0.15);
        ctx.lineTo(-rayon * 1.0, -rayon * 0.15);
        ctx.lineTo(-rayon * 1.4, 0);
        ctx.closePath();
        ctx.fill();
    }

    // Châssis Blindé (phase 7A) : hexagone large et trapu (peu allongé, contrairement
    // au Standard), deux plaques d'armure latérales sombres en léger surplomb du
    // corps principal, et un capteur central plus gros que celui du Standard — plus
    // large et plus « carré » à l'œil que les deux autres châssis.
    dessinerChassisBlinde(ctx, rayon) {
        ctx.fillStyle = this.couleur;
        this.dessinerHexagone(ctx, rayon * 1.0, rayon * 1.05);

        ctx.fillStyle = COULEURS_CSS_ENNEMIS_SOMBRE[this.nomCouleur];
        const largeurPlaque = rayon * 0.5;
        const hauteurPlaque = rayon * 0.36;
        ctx.fillRect(rayon * 0.05, rayon * 0.95, largeurPlaque, hauteurPlaque);
        ctx.fillRect(rayon * 0.05, -rayon * 0.95 - hauteurPlaque, largeurPlaque, hauteurPlaque);

        ctx.fillStyle = COULEURS_CSS_ENNEMIS_CLAIR[this.nomCouleur];
        ctx.beginPath();
        ctx.arc(rayon * 0.2, 0, rayon * 0.38, 0, Math.PI * 2);
        ctx.fill();
    }
}
