// Petit serveur statique pour tester le jeu en local (sans dépendance npm) : sert les
// fichiers du dossier passé en premier argument sur le port passé en second argument.
// Usage : node serveur-statique.js <dossier> <port>
const http = require('http');
const fs = require('fs');
const path = require('path');

const racine = path.resolve(process.argv[2] || '.');
const port = parseInt(process.argv[3], 10) || 8080;

const typesMime = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    // Ajoutés en phase 5 (PWA) : sans le bon type MIME pour le manifeste et les
    // icônes, certains navigateurs refusent de considérer l'app comme installable.
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.png': 'image/png',
    '.webp': 'image/webp'
};

http.createServer((req, res) => {
    let chemin;
    try {
        chemin = decodeURIComponent(req.url.split('?')[0]);
    } catch {
        // Adresse mal encodée (ex. « %E0%A4%A ») : sans ce garde-fou, l'exception
        // arrêtait le serveur entier au lieu de refuser cette seule requête.
        res.writeHead(400);
        res.end('Bad request');
        return;
    }
    if (chemin === '/') chemin = '/index.html';
    const fichier = path.join(racine, chemin);

    // Refuse toute adresse qui sortirait du dossier servi (ex. « /../../etc/passwd »).
    if (fichier !== racine && !fichier.startsWith(racine + path.sep)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    fs.readFile(fichier, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not found');
            return;
        }
        const ext = path.extname(fichier);
        res.writeHead(200, { 'Content-Type': typesMime[ext] || 'application/octet-stream' });
        res.end(data);
    });
}).listen(port, () => console.log(`Serveur sur http://localhost:${port}`));
