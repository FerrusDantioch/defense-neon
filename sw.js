// sw.js — Service worker de Défense Néon (phase 5). Ne s'active jamais sous file://
// (les navigateurs exigent une origine http/https, voir ARCHITECTURE.md) : sous ce
// protocole, navigator.serviceWorker.register échoue simplement, et le jeu continue de
// fonctionner sans les bénéfices d'installation et de cache explicite qu'il apporte une
// fois servi par Netlify ou un serveur local.
//
// Stratégie « réseau d'abord » (voir le gestionnaire fetch plus bas) : une mise à jour
// du jeu arrive d'elle-même au chargement suivant, sans rien incrémenter ici. Changer
// ce nom ne sert plus qu'à repartir d'un cache entièrement neuf (activate() ci-dessous
// purge tout cache dont le nom diffère) ; v28 marque le passage à cette stratégie, et
// remplace donc une bonne fois les copies laissées par l'ancienne (cache d'abord).
// v29 : ajout de statistiques.js et sauvegarde.js à la liste ci-dessous (octobre 2026).
const CACHE_NOM = 'defense-neon-v29';

// Au-delà de ce délai sans réponse du réseau (connexion présente mais quasi
// inutilisable), la copie en cache est servie à la place, si elle existe.
const DELAI_RESEAU_MS = 3000;

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
    './js/statistiques.js',
    './js/sauvegarde.js',
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
            // `cache: 'reload'` : contourne le cache HTTP du navigateur, pour copier
            // la version réellement en ligne plutôt qu'une version déjà périmée.
            .then((cache) => cache.addAll(
                FICHIERS_A_METTRE_EN_CACHE.map((url) => new Request(url, { cache: 'reload' }))
            ))
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

// Réseau d'abord, cache en secours. Jusqu'à la v27, ce service worker servait le
// cache d'abord : rapide, mais une mise à jour du jeu n'atteignait les joueurs que si
// CACHE_NOM avait été incrémenté — oubli fait deux fois de suite, laissant les jeux
// installés sur l'ancienne version. Désormais :
// - en ligne, chaque fichier vient du réseau (toujours la dernière version, et tous
//   les fichiers d'une même version ensemble) et sa copie en cache est remplacée ;
// - hors ligne, ou si le serveur est en panne (erreur 5xx), la copie en cache est
//   servie ;
// - si le réseau traîne au-delà de DELAI_RESEAU_MS, la copie en cache est servie
//   sans l'attendre, et la réponse du réseau, quand elle arrive, met la copie à jour
//   pour la fois suivante.
// Seules les lectures (GET) des fichiers du jeu lui-même sont concernées ; tout le
// reste suit le chemin normal du navigateur.
self.addEventListener('fetch', (evenement) => {
    const requete = evenement.request;
    if (requete.method !== 'GET' || new URL(requete.url).origin !== self.location.origin) return;

    // La copie est faite immédiatement, avant que la page ne commence à lire la
    // réponse : une réponse ne peut plus être dupliquée une fois sa lecture entamée.
    const reseau = fetch(requete).then((reponse) => ({
        reponse,
        copie: reponse.ok ? reponse.clone() : null
    }));

    // waitUntil : le service worker reste actif jusqu'à la fin de la mise en cache,
    // même si la page a déjà été servie depuis le cache entre-temps.
    evenement.waitUntil(
        reseau
            .then(({ copie }) => copie && caches.open(CACHE_NOM).then((cache) => cache.put(requete, copie)))
            .catch(() => {})
    );

    evenement.respondWith(reponseReseauOuCache(requete, reseau.then(({ reponse }) => reponse)));
});

// Renvoie la réponse du réseau si elle arrive à temps et sans panne du serveur, sinon
// la copie en cache ; à défaut de copie, la réponse (ou l'erreur) du réseau telle
// quelle. Une redirection ou un 404 est une vraie réponse, transmise telle quelle :
// remplacer une redirection d'hébergeur (ex. /index.html → /) par la copie servirait
// indéfiniment une page périmée, puisque seules les réponses 2xx sont recopiées.
function reponseReseauOuCache(requete, reseau) {
    return new Promise((resoudre, rejeter) => {
        let termine = false;
        const conclure = (reponse) => {
            if (!termine) {
                termine = true;
                resoudre(reponse);
            }
        };

        const minuteur = setTimeout(() => {
            caches.match(requete).then((enCache) => {
                if (enCache) conclure(enCache);
            });
        }, DELAI_RESEAU_MS);

        reseau.then(
            (reponse) => {
                clearTimeout(minuteur);
                if (reponse.status >= 500) {
                    caches.match(requete).then((enCache) => conclure(enCache || reponse));
                } else {
                    conclure(reponse);
                }
            },
            (erreur) => {
                clearTimeout(minuteur);
                caches.match(requete).then((enCache) => {
                    if (enCache) {
                        conclure(enCache);
                    } else if (!termine) {
                        termine = true;
                        rejeter(erreur);
                    }
                });
            }
        );
    });
}
