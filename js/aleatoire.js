// aleatoire.js — Générateur pseudo-aléatoire déterministe (algorithme mulberry32).
// À graine identique, la suite de nombres produite est toujours identique : si une
// carte générée pose problème, il suffit de garder sa graine pour la reproduire à
// volonté. Avec Math.random(), un bug de génération serait presque impossible à rejouer.

const Aleatoire = {
    // État interne du générateur (un entier 32 bits non signé).
    etat: 0,

    // Graine actuellement utilisée, conservée pour pouvoir l'afficher à l'écran.
    graineActuelle: 0,

    // Prépare le générateur avec une graine donnée. Si aucune graine n'est fournie,
    // on en tire une à partir de l'horloge, pour que chaque partie soit différente
    // par défaut tout en restant reproductible via cette graine.
    initialiser(graine) {
        if (graine === undefined || graine === null) {
            graine = Date.now() >>> 0;
        }
        this.graineActuelle = graine >>> 0;
        this.etat = this.graineActuelle;
    },

    // Renvoie un flottant dans [0, 1). C'est le cœur de mulberry32 : quelques
    // opérations de mélange de bits suffisent à produire une bonne distribution.
    nombre() {
        this.etat |= 0;
        this.etat = (this.etat + 0x6d2b79f5) | 0;
        let t = this.etat;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },

    // Renvoie un entier aléatoire entre min et max, bornes incluses.
    entier(min, max) {
        return Math.floor(this.nombre() * (max - min + 1)) + min;
    },

    // Renvoie un élément pris au hasard dans un tableau.
    choix(tableau) {
        return tableau[this.entier(0, tableau.length - 1)];
    }
};
