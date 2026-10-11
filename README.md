# Défense Néon

Jeu de défense de tours (« tower defense ») dans une ville néon, qui se joue dans le
navigateur, sur ordinateur comme sur téléphone, sans rien installer. Il fonctionne
aussi hors ligne une fois ouvert une première fois, et peut être installé comme une
application.

## Comment jouer

Des robots avancent le long de trois voies, de leur entrée (à gauche) à leur sortie (à
droite). Chaque robot qui atteint la sortie fait perdre 1 point d'**intégrité** ; à 0,
la partie est perdue. Pour les arrêter, construisez des tours sur les cases le long des
voies : choisissez une tour dans la barre sous le plateau, puis touchez une case. Sur
téléphone, un premier toucher montre l'aperçu, un second construit. Touchez une tour
déjà construite pour l'améliorer, choisir sa cible ou la vendre.

Les ennemis détruits et chaque vague terminée rapportent des **crédits**. Dès que tous
les ennemis d'une vague sont apparus, le bouton « Appeler la vague » lance la suivante
en avance, avec un bonus de crédits pour chaque ennemi encore en jeu.

### Les tours

| Tour | Coût | Rôle |
| --- | --- | --- |
| Mitrailleuse | 40 | Tir très rapide et bon marché, efficace contre les ennemis légers |
| Canon | 70 | Gros dégâts par tir, idéal contre les Blindés |
| Sniper | 100 | Très longue portée |
| Flak | 80 | **Seule tour capable d'abattre les drones**, dégâts de zone |
| Caserne | 90 | Pose un soldat qui bloque le chemin et combat au corps à corps |
| Gel | 60 | Ne tire pas : ralentit tous les ennemis à sa portée, drones compris |

Chaque tour qui tire peut viser l'ennemi **le plus avancé** (par défaut), **le plus
résistant** ou **le plus proche** : bouton « Cible » dans son panneau.

### Les ennemis

| Ennemi | Dès la vague | À savoir |
| --- | --- | --- |
| Standard | 1 | Ennemi de base |
| Rapide | 3 | Très rapide mais fragile |
| Blindé | 6 | Lent mais très résistant |
| Drone | 8 | Il vole : seul le Flak peut l'abattre |
| Soigneur | 11 | Soigne ses voisins : éliminez-le en premier |
| Bouclier | 13 | Son bouclier se recharge : tirez sans relâche |
| Boss | 5, 10, 15… | Énorme réserve de points de vie |

Le jeu annonce chaque nouvel ennemi à son arrivée, et le texte à côté du bouton de
lancement décrit toujours la vague suivante.

### Modes de jeu

- **Durée** : Rapide (10 vagues), Standard (20), Longue (35) ou Sans fin.
- **Difficulté supérieure** : ennemis plus résistants, moins de crédits et d'intégrité
  au départ, mais plus d'expérience gagnée.
- **Défi du jour** : la même carte pour tout le monde ce jour-là, en mode Sans fin. Le
  bouton « Partager mon score » copie (ou partage, sur téléphone) votre résultat.
- **Progression** : l'expérience gagnée à chaque partie fait monter de niveau et
  débloque des bonus permanents.
- **Reprise** : la partie en cours est sauvegardée entre deux vagues. Si vous fermez la
  page, le bouton « Reprendre la partie » de l'écran d'accueil la retrouve.

### Raccourcis clavier

| Touche | Action |
| --- | --- |
| 1 à 6 | Choisir une tour |
| Espace | Lancer (ou appeler en avance) la vague suivante |
| P | Pause |
| V | Vitesse ×1 / ×2 |
| A | Améliorer la tour sélectionnée |
| C | Changer la cible de la tour sélectionnée |
| Échap | Fermer le panneau de la tour |
| M | Couper ou remettre le son |

## Tester le jeu sur son ordinateur

Le plus simple : ouvrir le fichier `index.html` dans un navigateur. Tout fonctionne,
sauf l'installation et le mode hors ligne, qui demandent une vraie adresse web.

Pour tout tester, avec [Node.js](https://nodejs.org) installé, lancez dans le dossier
du jeu :

```
node outils/serveur-statique.js . 8080
```

puis ouvrez <http://localhost:8080> dans le navigateur.

## Mettre le jeu en ligne

Le jeu n'a besoin d'aucune étape de construction : il suffit de publier le dossier tel
quel (par exemple sur Netlify, en déposant le dossier). Après une mise à jour, les
joueurs reçoivent la nouvelle version automatiquement au chargement suivant.

## Vérifications automatiques

À chaque envoi de modifications sur GitHub, des vérifications se lancent toutes
seules (onglet **Actions** du dépôt, ou en bas d'une pull request) :

1. aucun fichier JavaScript ne contient d'erreur d'écriture ;
2. les cartes générées sont toutes valides (300 cartes testées) ;
3. une partie est jouée dans un vrai navigateur : construction, raccourcis clavier,
   appel anticipé, sauvegarde et reprise, écran de fin, partage, affichage sur
   téléphone…

Une coche verte signifie que tout est bon ; une croix rouge indique l'étape qui a
échoué, avec le détail. Pour lancer la partie de test sur votre ordinateur :

```
npm install --no-save playwright
npx playwright install chromium
node outils/test-navigateur.js
```

## Organisation des fichiers

- `index.html` : la page du jeu ; `css/style.css` : son apparence.
- `js/` : le code du jeu. `config.js` rassemble tous les réglages (prix des tours,
  vie des ennemis, nombre de vagues…) : c'est le fichier à modifier pour équilibrer le
  jeu.
- `sw.js` et `manifest.webmanifest` : fonctionnement hors ligne et installation.
- `outils/` : outils de développement (serveur local, partie de test, simulations
  d'équilibrage), jamais utilisés par les joueurs.
- `ARCHITECTURE.md` : documentation technique détaillée, fichier par fichier.
