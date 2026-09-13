// Petit serveur statique pour tester le jeu en local (sans dépendance npm) : sert les
// fichiers du dossier passé en premier argument sur le port passé en second argument.
// Usage : node serveur-statique.js <dossier> <port>
const http = require('http');
const fs = require('fs');
const path = require('path');

const racine = process.argv[2] || '.';
const port = parseInt(process.argv[3], 10) || 8080;

const typesMime = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    // Ajoutés en phase 5 (PWA) : sans le bon type MIME pour le manifeste et les
    // icônes, certains navigateurs refusent de considérer l'app comme installable.
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.png': 'image/png'
};

http.createServer((req, res) => {
    let chemin = decodeURIComponent(req.url.split('?')[0]);
    if (chemin === '/') chemin = '/index.html';
    const fichier = path.join(racine, chemin);

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
