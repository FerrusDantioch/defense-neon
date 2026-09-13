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
        this.couleur = COULEURS_CSS_ENNEMIS[caracteristiques.couleur] || caracteristiques.couleur;

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
        const cible = pointsDePassage[this.indexPointDePassage + 1];
        if (!cible) {
            this.arrive = true;
            return;
        }

        const dx = cible.x - this.x;
        const dy = cible.y - this.y;
        const distanceRestante = Math.hypot(dx, dy);
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

    // Dessine l'ennemi : un cercle dont le rayon dépend des points de vie de base du
    // type (pas des points de vie déjà gonflés par le multiplicateur de vague, sinon
    // un Standard tardif finirait par paraître aussi gros qu'un Blindé), surmonté
    // d'une barre de vie à deux couleurs. Halo néon (phase 4A) de la couleur du type,
    // retiré aussitôt après (ctx.shadowBlur = 0) pour ne pas déteindre sur la barre de
    // vie ni sur le reste de la scène dessinée ensuite dans la même frame.
    dessiner(ctx) {
        const tailleCase = Carte.tailleCase;
        const pointsDeVieBase = Config.TYPES_ENNEMIS[this.type].pointsDeVie;
        const rayon = tailleCase * (0.12 + pointsDeVieBase / 1000);

        ctx.shadowColor = this.couleur;
        ctx.shadowBlur = Config.HALO_FLOU_ENNEMI;
        ctx.fillStyle = this.couleur;
        ctx.beginPath();
        ctx.arc(this.x, this.y, rayon, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

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
}
