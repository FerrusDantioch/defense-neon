// sw.js — Service worker de Défense Néon (phase 5). Ne s'active jamais sous file://
// (les navigateurs exigent une origine http/https, voir ARCHITECTURE.md) : sous ce
// protocole, navigator.serviceWorker.register échoue simplement, et le jeu continue de
// fonctionner sans les bénéfices d'installation et de cache explicite qu'il apporte une
// fois servi par Netlify ou un serveur local.
//
// À incrémenter à chaque mise à jour déployée du jeu : le nom sert aussi de clé de
// version, voir activate() ci-dessous qui purge tout cache dont le nom diffère.
const CACHE_NOM = 'defense-neon-v25';

// './images/decor-fond.png' (phase 7C bis) : le fichier réellement déposé dans le
// projet est un .png, pas le .webp initialement prévu par le prompt de cette
// sous-phase (aucun outil de conversion vers WebP disponible dans cet environnement au
// moment de l'intégrer, voir ARCHITECTURE.md) — le nom et l'extension ci-dessous, dans
// index.html et dans cette liste, ont été ajustés en conséquence pour rester exacts.
const FICHIERS_A_METTRE_EN_CACHE = [
    './',
    './index.html',
    './manifest.webmanifest',
    './css/style.css',
    './js/config.js',
    './js/aleatoire.js',
    './js/carte.js',
    './js/ennemi.js',
    './js/vagues.js',
    './js/unite.js',
    './js/tour.js',
    './js/progression.js',
    './js/particules.js',
    './js/son.js',
    './js/decor.js',
    './js/interface.js',
    './js/jeu.js',
    './icones/icone-192.png',
    './icones/icone-512.png',
    './images/decor-fond.png'
];

self.addEventListener('install', (evenement) => {
    evenement.waitUntil(
        caches.open(CACHE_NOM)
            .then((cache) => cache.addAll(FICHIERS_A_METTRE_EN_CACHE))
            .then(() => self.skipWaiting())
    );
});

// Sans clients.claim(), un onglet déjà ouvert au moment du déploiement d'une nouvelle
// version resterait contrôlé par l'ancien service worker (et donc l'ancien cache)
// jusqu'à sa fermeture complète — skipWaiting() seul ne fait qu'activer le nouveau
// worker en arrière-plan, il ne lui donne pas le contrôle des pages déjà ouvertes.
self.addEventListener('activate', (evenement) => {
    evenement.waitUntil(
        caches.keys()
            .then((nomsCaches) => Promise.all(
                nomsCaches
                    .filter((nom) => nom !== CACHE_NOM)
                    .map((nom) => caches.delete(nom))
            ))
            .then(() => self.clients.claim())
    );
});

// Cache-first : le jeu ne dépend d'aucune donnée dynamique ni d'API externe, donc
// servir depuis le cache dès qu'une ressource y est présente est à la fois le plus
// simple et le plus adapté (aucun risque de servir une réponse périmée qui compterait).
self.addEventListener('fetch', (evenement) => {
    evenement.respondWith(
        caches.match(evenement.request)
            .then((reponseEnCache) => reponseEnCache || fetch(evenement.request))
    );
});
