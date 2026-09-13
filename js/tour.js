// tour.js — Classes Tour et Projectile.
//
// Tour : pose fixe sur une case, cherche une cible parmi les ennemis à portée et tire
// à cadence régulière. Trois types de tours (Mitrailleuse, Canon, Sniper, voir
// Config.TYPES_TOURS) partagent ce même comportement de ciblage/tir et ne diffèrent
// que par les valeurs lues dans le constructeur et par leur apparence. Une tour peut
// aussi être améliorée (jusqu'à Config.NIVEAU_MAX_TOUR) ou vendue (phase 2B) : voir
// recalculerStats, coutAmelioration, ameliorer et montantVente ci-dessous.
//
// Projectile : tiré par une tour, suit sa cible jusqu'à l'impact ou jusqu'à ce que la
// cible meure avant lui. Recyclé via un pool plutôt que créé/détruit à la volée (voir
// Jeu.initialiserPoolProjectiles) pour éviter de solliciter le ramasse-miettes en
// pleine partie.

class Tour {
    // `type` est une clé de Config.TYPES_TOURS ('mitrailleuse', 'canon' ou 'sniper').
    // Conservée sur l'instance (this.type) pour retrouver le coût d'achat de base au
    // calcul du coût d'une amélioration (voir coutAmelioration).
    constructor(colonne, ligne, type) {
        this.colonne = colonne;
        this.ligne = ligne;
        this.type = type;

        const centre = Carte.caseVersPixels(colonne, ligne);
        this.x = centre.x;
        this.y = centre.y;

        const caracteristiques = Config.TYPES_TOURS[type];
        this.couleur = caracteristiques.couleur;

        // Valeurs de base (niveau 1), conservées à part de portee/degats/cadence :
        // recalculerStats() part toujours de ces valeurs fixes plutôt que de
        // multiplier la valeur courante à chaque amélioration, pour ne jamais
        // accumuler d'erreur d'arrondi si on ajoute un jour davantage de niveaux.
        this.degatsBase = caracteristiques.degats;
        this.cadenceBase = caracteristiques.cadence;
        this.porteeBase = caracteristiques.portee;

        this.niveau = 1;
        // Somme du coût d'achat initial et de toutes les améliorations payées
        // jusqu'ici : sert de base au calcul du remboursement à la vente (voir
        // montantVente).
        this.investissementTotal = caracteristiques.cout;

        this.portee = 0;
        this.degats = 0;
        this.cadence = 0;
        this.recalculerStats();

        this.tempsDepuisDernierTir = 0;
        this.cible = null;
    }

    // Recalcule degats/cadence/portee à partir des valeurs de base et du niveau
    // actuel. Appelée à la construction et après chaque amélioration — jamais en
    // multipliant la valeur courante, voir la note du constructeur. Le bonus
    // permanent de dégâts éventuellement débloqué par le joueur (phase 3B,
    // Progression.multiplicateurDegats) s'applique ici, en plus du multiplicateur de
    // niveau de la tour : les deux se cumulent.
    recalculerStats() {
        this.degats = this.degatsBase
            * Config.AMELIORATION_MULTIPLICATEUR_DEGATS ** (this.niveau - 1)
            * Progression.multiplicateurDegats();
        this.cadence = this.cadenceBase * Config.AMELIORATION_MULTIPLICATEUR_CADENCE ** (this.niveau - 1);
        this.portee = this.porteeBase * Config.AMELIORATION_MULTIPLICATEUR_PORTEE ** (this.niveau - 1);
    }

    // Coût du prochain palier d'amélioration, ou null si le niveau maximum est déjà
    // atteint. Le coût dépend du niveau actuel (chaque palier coûte plus cher que le
    // précédent) et de l'éventuel bonus permanent de réduction débloqué par le joueur
    // (phase 3B, Progression.multiplicateurCoutAmelioration).
    coutAmelioration() {
        if (this.niveau >= Config.NIVEAU_MAX_TOUR) return null;
        return Math.round(
            Config.TYPES_TOURS[this.type].cout
            * this.niveau
            * Config.AMELIORATION_COUT_FACTEUR
            * Progression.multiplicateurCoutAmelioration()
        );
    }

    // Fait passer la tour au palier suivant. Ne déduit pas elle-même les crédits :
    // l'appelant (Interface, sur clic du bouton Améliorer) vérifie et déduit le coût
    // avant d'appeler cette méthode.
    ameliorer() {
        if (this.niveau >= Config.NIVEAU_MAX_TOUR) return;
        this.investissementTotal += this.coutAmelioration();
        this.niveau++;
        this.recalculerStats();
    }

    // Montant remboursé à la vente : un pourcentage de tout ce qui a été investi
    // (achat initial + améliorations payées), pas seulement du prix d'achat.
    montantVente() {
        return Math.round(this.investissementTotal * Config.VENTE_POURCENTAGE_REMBOURSEMENT);
    }

    // Progression d'un ennemi le long de SON chemin, normalisée entre 0 (tout juste
    // apparu) et 1 (sur le point d'arriver) — phase 6A. Avec plusieurs chemins,
    // potentiellement de longueurs différentes, comparer les `indexPointDePassage`
    // bruts entre deux ennemis n'a plus de sens : un ennemi à l'index 5 d'un chemin de
    // 15 cases est en réalité bien plus avancé qu'un ennemi à l'index 5 d'un chemin de
    // 40 cases. Protégée contre un chemin d'une seule case (longueur - 1 = 0) : cas
    // extrême improbable vu Config.LONGUEUR_CHEMIN_MIN, mais qui produirait sinon une
    // division par zéro (Infinity) plutôt qu'une progression exploitable.
    progressionEnnemi(ennemi) {
        const longueurChemin = Carte.chemins[ennemi.cheminIndex].pointsDePassage.length;
        if (longueurChemin <= 1) return 0;
        return ennemi.indexPointDePassage / (longueurChemin - 1);
    }

    // Choisit l'ennemi à attaquer parmi ceux à portée. Ne réévalue pas la cible tant
    // que celle en cours reste valide (vivante, pas arrivée, toujours à portée) :
    // sans cette vérification, deux ennemis à progression égale feraient tourner le
    // canon de l'un à l'autre à chaque frame, ce qui donne un rendu tremblant. Compare
    // la progression normalisée (voir progressionEnnemi ci-dessus) plutôt que l'index
    // brut, pour rester correcte même entre deux ennemis venant de chemins différents.
    chercherCible(ennemis) {
        const portee = this.portee * Jeu.facteurEchelle;

        if (this.cible && this.cible.vivant && !this.cible.arrive) {
            const distance = Math.hypot(this.cible.x - this.x, this.cible.y - this.y);
            if (distance <= portee) {
                return;
            }
        }

        let meilleureCible = null;
        let meilleureProgression = -Infinity;
        for (const ennemi of ennemis) {
            if (!ennemi.vivant || ennemi.arrive) continue;

            const distance = Math.hypot(ennemi.x - this.x, ennemi.y - this.y);
            if (distance > portee) continue;

            const progression = this.progressionEnnemi(ennemi);
            if (!meilleureCible || progression > meilleureProgression) {
                meilleureCible = ennemi;
                meilleureProgression = progression;
            }
        }

        this.cible = meilleureCible;
    }

    mettreAJour(dt, ennemis, pool) {
        this.chercherCible(ennemis);

        if (!this.cible) return;

        this.tempsDepuisDernierTir += dt;
        if (this.tempsDepuisDernierTir >= 1 / this.cadence) {
            this.tirer(pool);
            this.tempsDepuisDernierTir = 0;
        }
    }

    // Active le premier projectile inactif du pool. Si tous sont déjà en vol (cas
    // rare), le tir demandé est simplement ignoré pour cette frame (le flash de
    // particules et le son de tir aussi, dans ce cas : rien à montrer ni à faire
    // entendre pour un tir qui n'a pas eu lieu).
    tirer(pool) {
        const projectile = pool.find(p => !p.actif);
        if (!projectile) return;

        projectile.activer(this.x, this.y, this.cible, this.degats, this.couleur);

        // Flash de tir (phase 4B) : quelques particules projetées vers la cible,
        // depuis un point légèrement décalé du centre pour évoquer le canon plutôt
        // que le socle lui-même.
        const angle = Math.atan2(this.cible.y - this.y, this.cible.x - this.x);
        const decalage = Carte.tailleCase * 0.3;
        Particules.creerTir(
            this.x + Math.cos(angle) * decalage,
            this.y + Math.sin(angle) * decalage,
            angle,
            this.couleur
        );
        Son.jouerTir(this.type);
    }

    // Trace un polygone régulier plein (socle) centré sur (cx, cy) : `cotes` sommets,
    // `rotation` en radians pour orienter le premier sommet (permet par ex. de pointer
    // un côté plat vers le haut plutôt qu'un sommet). Partagé par les trois formes de
    // socle ci-dessous plutôt que dupliqué.
    dessinerSoclePolygone(ctx, rayon, cotes, rotation) {
        ctx.beginPath();
        for (let i = 0; i < cotes; i++) {
            const angle = rotation + (i / cotes) * Math.PI * 2;
            const px = this.x + Math.cos(angle) * rayon;
            const py = this.y + Math.sin(angle) * rayon;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
    }

    // Trace un canon (segment épais) depuis le centre de la tour, à l'angle donné,
    // décalé perpendiculairement de `decalage` pixels (0 = canon central). Partagé par
    // les trois types : seuls longueur, épaisseur et nombre de canons diffèrent.
    dessinerCanon(ctx, angle, longueur, epaisseur, decalage) {
        const perpendiculaire = angle + Math.PI / 2;
        const baseX = this.x + Math.cos(perpendiculaire) * decalage;
        const baseY = this.y + Math.sin(perpendiculaire) * decalage;

        ctx.strokeStyle = '#d0d0d8';
        ctx.lineWidth = epaisseur;
        ctx.beginPath();
        ctx.moveTo(baseX, baseY);
        ctx.lineTo(baseX + Math.cos(angle) * longueur, baseY + Math.sin(angle) * longueur);
        ctx.stroke();
    }

    // Formes distinctes par type de tour (phase 4A), pour ne plus dépendre de la
    // lettre M/C/S posée en phase 2A pour les distinguer :
    // - Mitrailleuse : losange compact, deux canons fins jumelés (cadence élevée) ;
    // - Canon : octogone massif, un seul canon épais (gros dégâts, cadence lente) ;
    // - Sniper : triangle effilé, un canon long et fin (portée très supérieure).
    // Le halo néon (couleur du type, voir Config.HALO_FLOU_TOUR_BASE) s'intensifie
    // légèrement à chaque amélioration, pour que le niveau d'une tour se lise aussi
    // d'un coup d'œil sans ouvrir le panneau d'amélioration. `ctx.shadowBlur` est
    // remis à 0 avant les canons : le halo doit rester propre au socle, pas baver sur
    // le reste de la scène dessinée ensuite dans la même frame.
    dessiner(ctx) {
        const taille = Carte.tailleCase;

        let angle = -Math.PI / 2;
        if (this.cible) {
            angle = Math.atan2(this.cible.y - this.y, this.cible.x - this.x);
        }

        ctx.shadowColor = this.couleur;
        ctx.shadowBlur = Config.HALO_FLOU_TOUR_BASE + (this.niveau - 1) * Config.HALO_FLOU_TOUR_PAR_NIVEAU;
        ctx.fillStyle = this.couleur;

        if (this.type === 'mitrailleuse') {
            this.dessinerSoclePolygone(ctx, taille * 0.32, 4, Math.PI / 4);
        } else if (this.type === 'canon') {
            this.dessinerSoclePolygone(ctx, taille * 0.34, 8, 0);
        } else {
            this.dessinerSoclePolygone(ctx, taille * 0.36, 3, -Math.PI / 2);
        }

        ctx.shadowBlur = 0;

        if (this.type === 'mitrailleuse') {
            const decalage = taille * 0.09;
            this.dessinerCanon(ctx, angle, taille * 0.32, Math.max(1.5, taille * 0.05), decalage);
            this.dessinerCanon(ctx, angle, taille * 0.32, Math.max(1.5, taille * 0.05), -decalage);
        } else if (this.type === 'canon') {
            this.dessinerCanon(ctx, angle, taille * 0.3, Math.max(3, taille * 0.12), 0);
        } else {
            this.dessinerCanon(ctx, angle, taille * 0.5, Math.max(1.5, taille * 0.05), 0);
        }
    }
}

class Projectile {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.cible = null;
        this.degats = 0;
        // Couleur de la tour tireuse (phase 4B), utilisée uniquement pour teinter les
        // particules d'impact à l'arrivée (voir mettreAJour ci-dessous) — le
        // projectile lui-même reste dessiné en blanc, voir dessiner().
        this.couleur = '#ffffff';
        this.actif = false;
    }

    // Réinitialise les propriétés d'un projectile inactif du pool au lieu d'en créer
    // un nouveau avec `new` (voir la note en tête de fichier).
    activer(x, y, cible, degats, couleur) {
        this.x = x;
        this.y = y;
        this.cible = cible;
        this.degats = degats;
        this.couleur = couleur;
        this.actif = true;
    }

    mettreAJour(dt) {
        if (!this.actif) return;

        // La cible a déjà été détruite par un autre projectile arrivé avant celui-ci :
        // pas de dégâts, on libère simplement le projectile.
        if (!this.cible.vivant) {
            this.actif = false;
            return;
        }

        const dx = this.cible.x - this.x;
        const dy = this.cible.y - this.y;
        const distanceRestante = Math.hypot(dx, dy);

        if (distanceRestante < Config.PROJECTILE_RAYON_IMPACT) {
            this.cible.subirDegats(this.degats);
            // Impact sans mise à mort (phase 4B) : la mort elle-même déclenche sa
            // propre explosion ailleurs (Jeu.simuler, au moment où l'ennemi est
            // retiré de la liste des actifs), pour ne jamais superposer les deux
            // effets sur un seul et même coup fatal.
            if (this.cible.vivant) {
                Particules.creerImpact(this.x, this.y, this.couleur);
            }
            this.actif = false;
            return;
        }

        const pas = Config.PROJECTILE_VITESSE * Jeu.facteurEchelle * dt;
        this.x += (dx / distanceRestante) * pas;
        this.y += (dy / distanceRestante) * pas;
    }

    dessiner(ctx) {
        if (!this.actif) return;

        ctx.fillStyle = '#f5f5ff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
        ctx.fill();
    }
}
