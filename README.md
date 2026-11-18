# Dessin partagé

Application web de dessin collaboratif basée sur Express, WebSocket et l’API Canvas. Plusieurs utilisateurs peuvent dessiner depuis leur navigateur, mais l’application doit encore être raccordée complètement à son système de salles et de synchronisation.

## Arborescence du projet

```text
dessin-partage/
├── README.md
└── server/
    ├── package.json
    ├── package-lock.json
    ├── server.js
    └── public/
        ├── index.html
        ├── style.css
        └── app.js
```

- `README.md` : documentation du projet.
- `server/package.json` : métadonnées Node.js, dépendances et commande de démarrage.
- `server/package-lock.json` : versions exactes installées des dépendances npm.
- `server/server.js` : serveur HTTP, fichiers statiques, WebSocket et gestion des salles.
- `server/public/index.html` : structure HTML et commandes visibles.
- `server/public/style.css` : mise en page responsive, barre d’outils et canevas.
- `server/public/app.js` : rendu Canvas, outils de dessin et communication WebSocket.
- `server/node_modules/` : dépendances npm installées localement.

## Fonctionnalités actuelles

- Dessin sur une surface Canvas plein écran.
- Sélection du crayon, du pinceau ou de la gomme.
- Sélection de la couleur.
- Réglage de la taille du trait.
- Effacement local du dessin.
- Adaptation à l’écran, au téléphone, à la tablette et au bureau.
- Prise en charge tactile avec `touch-action: none`.
- Serveur WebSocket prêt à gérer des salles, un historique et la présence.
- HTTPS automatique côté navigateur avec protocole `wss`; HTTP avec protocole `ws`.

## Prérequis

- Node.js 20 ou supérieur.
- npm, fourni généralement avec Node.js.
- Un navigateur récent prenant en charge Canvas, Pointer Events et WebSocket.

## Installation

Depuis la racine du projet :

```powershell
cd .\server
npm install
```

L’installation crée ou met à jour `node_modules/` et `package-lock.json`.

## Démarrage

Depuis le dossier `server` :

```powershell
npm start
```

Le script `npm start` exécute :

```text
node server.js
```

Le serveur écoute sur `0.0.0.0`, sur le port défini par `PORT`, ou sur le port `8080` par défaut.

Ouvrez ensuite :

```text
http://localhost:8080
```

Pour utiliser un autre port :

```powershell
$env:PORT = "3000"
npm start
```

## Description des parties principales

### `server/package.json`

Ce fichier configure le projet Node.js.

#### Dépendances importantes

- `express` : sert les fichiers statiques et fournit le serveur HTTP.
- `ws` : ajoute le serveur WebSocket utilisé pour communiquer avec les navigateurs.

```json
"engines": {
  "node": ">=20"
}
```

Cette propriété indique que Node.js 20 est le minimum prévu.

```json
"scripts": {
  "start": "node server.js"
}
```

Cette commande permet de lancer l’application avec `npm start`.

### `server/server.js`

Ce fichier est le cœur côté serveur.

#### Configuration Express et HTTP

```js
const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
```

- `app` représente l’application Express.
- `public/` est exposé directement comme dossier de fichiers statiques.
- `http.createServer(app)` crée le serveur HTTP sur lequel WebSocket peut être ajouté.

#### Serveur WebSocket

```js
const wss = new WebSocketServer({
  server,
  maxPayload: 64 * 1024
});
```

Ce bloc :

- partage le même port entre HTTP et WebSocket;
- limite chaque message à 64 KiB;
- protège contre les messages WebSocket excessivement volumineux.

#### Gestion des salles

```js
const MAX_HISTORY = 20000;
const rooms = new Map();
```

- `rooms` associe le nom d’une salle à son état.
- Chaque salle contient un historique, un ensemble de clients et un timer de nettoyage.
- `MAX_HISTORY` limite l’historique à 20 000 messages.

```js
function getRoom(name) {
  if (!rooms.has(name)) {
    rooms.set(name, {
      history: [],
      clients: new Set(),
      cleanup: null
    });
  }

  const room = rooms.get(name);
  clearTimeout(room.cleanup);
  return room;
}
```

Ce bloc crée une salle si elle n’existe pas et annule son éventuel timer de suppression.

#### Diffusion des messages

```js
function broadcast(room, text, except) {
  for (const client of room.clients) {
    if (client !== except && client.readyState === WebSocket.OPEN) {
      client.send(text);
    }
  }
}
```

Cette fonction envoie un message à tous les clients ouverts de la salle, à l’exception optionnelle de l’auteur.

```js
function sendPresence(room) {
  broadcast(
    room,
    JSON.stringify({ type: 'presence', count: room.clients.size }),
    null
  );
}
```

Le nombre actuel de clients connectés est envoyé après chaque arrivée ou départ.

#### Gestion des départs

```js
function leave(ws) {
  const name = ws.roomName;
  const room = name && rooms.get(name);
  if (!room) return;

  room.clients.delete(ws);
  ws.roomName = null;
  sendPresence(room);

  if (room.clients.size === 0) {
    room.cleanup = setTimeout(() => {
      if (room.clients.size === 0) rooms.delete(name);
    }, 30 * 60 * 1000);
  }
}
```

Lorsqu’une salle devient vide, elle reste conservée en mémoire pendant 30 minutes avant d’être supprimée.

#### Connexion WebSocket

À chaque connexion :

- `ws.isAlive` initialise la détection de connexion inactive;
- `pong` confirme que le client répond;
- `message` reçoit les JSON envoyés par le navigateur;
- `close` retire le client de sa salle.

#### Rejoint d’une salle

```js
if (msg.type === 'join') {
  if (
    typeof msg.room !== 'string'
    || !/^[a-z0-9-]{1,32}$/i.test(msg.room)
  ) return;

  leave(ws);
  const name = msg.room.toLowerCase();
  const room = getRoom(name);
  ws.roomName = name;
  room.clients.add(ws);

  ws.send(JSON.stringify({
    type: 'history',
    items: room.history
  }));
  sendPresence(room);
  return;
}
```

Les noms de salles sont limités à 32 caractères et peuvent contenir uniquement des lettres, des chiffres et des tirets. Le nouvel arrivant reçoit l’historique existant.

#### Réception d’un tracé ou d’un effacement

```js
if (msg.type === 'stroke') {
  room.history.push(msg);
  if (room.history.length > MAX_HISTORY) room.history.shift();
  broadcast(room, JSON.stringify(msg), ws);
}

else if (msg.type === 'clear') {
  room.history = [];
  broadcast(room, JSON.stringify(msg), ws);
}
```

Les traits sont conservés dans l’historique jusqu’à la limite fixée. Une commande `clear` vide cet historique et demande aux autres navigateurs d’effacer la salle.

#### Battement de cœur

Toutes les 30 secondes, le serveur envoie un `ping` à chaque client. Les clients qui ne répondent pas par `pong` sont terminés. Cela évite de conserver des connexions mortes.

#### Port d’écoute

```js
const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () =>
  console.log('Serveur sur le port', PORT)
);
```

Le serveur utilise `PORT` lorsqu’il est fourni, sinon `8080`.

### `server/public/index.html`

Ce fichier construit l’interface avec :

- la barre d’outils;
- les trois boutons d’outils;
- le sélecteur de couleur;
- le curseur de taille;
- le bouton d’effacement;
- le canevas;
- l’indicateur de présence;
- le bouton d’invitation.

```html
<canvas id="board"></canvas>
```

Le canevas est la zone sur laquelle l’utilisateur dessine.

```html
<input type="color" id="color" value="#000000">
<input type="range" id="size" min="1" max="40" value="4">
```

Ces deux contrôles définissent respectivement la couleur et l’épaisseur du trait.

### `server/public/style.css`

#### Mise en page générale

```css
.app {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}
```

L’application occupe tout l’écran en disposition verticale sur les petits écrans.

#### Canevas tactile

```css
canvas {
  touch-action: none;
}
```

Cette règle empêche le navigateur de défiler ou de zoomer pendant un geste de dessin.

#### Barre d’outils responsive

Le bloc média suivant transforme la barre horizontale en barre verticale :

```css
@media (min-width: 768px) and (orientation: landscape),
       (min-width: 1024px) {
  .app {
    flex-direction: row;
  }

  .toolbar {
    flex-direction: column;
    width: 76px;
  }
}
```

Sur téléphone portrait, elle reste horizontale. Sur tablette paysage ou écran large, elle passe sur le côté gauche.

#### Taille des boutons tactiles

```css
@media (pointer: coarse) {
  .toolbar button {
    min-width: 48px;
    min-height: 48px;
  }
}
```

Cette règle agrandit les boutons sur les appareils tactiles.

#### Indicateur de connexion

```css
#status
```

Le bloc d’état est fixé en haut à droite. `#dot.on` passe son point en vert lorsque la connexion est active.

### `server/public/app.js`

Ce fichier gère le dessin et la communication avec le serveur.

#### Connexion WebSocket

```js
const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
const socket = new WebSocket(`${protocol}://${location.host}`);
```

La connexion utilise automatiquement `wss` en HTTPS et `ws` en HTTP.

#### Initialisation du Canvas

```js
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
```

`canvas` représente l’élément HTML et `ctx` fournit les opérations de dessin 2D.

#### Adaptation à la densité d’écran

```js
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
}
```

Le Canvas est redimensionné selon la taille réelle de l’écran. `dpr` évite les traits flous sur les écrans à haute densité.

#### Outils disponibles

```js
const TOOLS = {
  pencil: { mult: 0.5, alpha: 1 },
  brush:  { mult: 2,   alpha: 0.85 },
  eraser: { mult: 3,   alpha: 1 },
};
```

- `mult` augmente ou réduit la taille de l’outil.
- `alpha` contrôle la transparence du tracé.

Les clics sur les boutons `[data-tool]` modifient l’outil actif et la classe `active`.

#### Style courant

```js
function currentStyle() {
  return {
    tool,
    color: colorInput.value,
    size: Number(sizeInput.value)
  };
}
```

Chaque segment transporte son propre outil, sa couleur et sa taille.

#### Tracé d’un segment

```js
function drawSegment(from, to, style) {
  const t = TOOLS[style.tool];

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = t.alpha;
  ctx.lineWidth = style.size * t.mult;
  ctx.strokeStyle = style.color;

  ctx.globalCompositeOperation =
    style.tool === 'eraser'
      ? 'destination-out'
      : 'source-over';

  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}
```

Ce bloc centralise le rendu. Les extrémités arrondies donnent des traits plus naturels. Pour la gomme, `destination-out` retire réellement les pixels déjà dessinés.

#### Événements Pointer

```js
canvas.addEventListener('pointerdown', (e) => {
  drawing = true;
  canvas.setPointerCapture(e.pointerId);
  last = getPos(e);
  drawSegment(last, currentStyle());
});
```

Au début du geste :

- le dessin passe à l’état actif;
- le pointeur est capturé par le Canvas;
- la dernière position est mémorisée;
- un premier segment est tracé.

```js
canvas.addEventListener('pointermove', (e) => {
  if (!drawing) return;
  const p = getPos(e);
  const style = currentStyle();

  drawSegment(last, p, style);
  socket.send(JSON.stringify({
    type: 'segment',
    from: last,
    to: p,
    style
  }));

  last = p;
});
```

Pendant le geste, chaque mouvement devient un segment local puis un message WebSocket. Les événements `pointerup` et `pointercancel` arrêtent le dessin.

## Format des messages WebSocket

Le serveur attend actuellement les types suivants :

```json
{
  "type": "join",
  "room": "ma-salle"
}
```

```json
{
  "type": "history",
  "items": []
}
```

```json
{
  "type": "presence",
  "count": 2
}
```

```json
{
  "type": "stroke",
  "from": { "x": 10, "y": 20 },
  "to": { "x": 15, "y": 25 },
  "style": {
    "tool": "pencil",
    "color": "#000000",
    "size": 4
  }
}
```

```json
{
  "type": "clear"
}
```

## Flux de dessin prévu

1. Le navigateur ouvre une connexion WebSocket.
2. Il rejoint une salle par le message `join`.
3. Le serveur renvoie l’historique de cette salle.
4. Chaque mouvement produit un segment.
5. Le segment est envoyé au serveur.
6. Le serveur diffuse le segment aux autres clients.

## Limites connues à corriger

Plusieurs blocs nécessitent actuellement une correction pour obtenir une collaboration pleinement fonctionnelle :

1. **Nom des messages incompatible**
   - Le client envoie `type: "segment"`.
   - Le serveur attend `type: "stroke"`.
   - Modifier l’un des deux côtés pour utiliser le même nom est nécessaire.

2. **Écouteur WebSocket ajouté trop souvent**
   - `socket.addEventListener('message', ...)` est placé à l’intérieur de `pointermove`.
   - Un nouvel écouteur est donc créé pour chaque mouvement.
   - Cet écouteur doit être placé une seule fois après la création du WebSocket.

3. **Effacement non synchronisé**
   - Le bouton n’utilise que `ctx.clearRect(...)`.
   - Il ne devrait pas seulement effacer localement : il doit aussi envoyer `type: "clear"` au serveur.

4. **Effacement du Canvas incomplet**
   - `clearRect(0, 0, canvas.width, canvas.height)` utilise les dimensions physiques du canevas.
   - Après le changement DPR, les coordonnées de rendu peuvent être différentes.
   - Il est préférable d’effacer avec les dimensions CSS ou de réinitialiser/redimensionner correctement le Canvas.

5. **Salles non utilisées par le client**
   - Le serveur implémente `join`, `history` et `presence`.
   - Le navigateur n’envoie actuellement aucun message `join`.
   - Il ne lit pas non plus les messages `presence` ou `history`.

6. **Bouton Inviter sans logique**
   - `#share` existe dans le HTML.
   - Aucun gestionnaire JavaScript ne copie l’adresse ou partage de lien.

7. **Structure HTML à nettoyer**
   - Une balise `<body>` est ouverte une fois dans `<head>` puis une deuxième fois dans le contenu.
   - Il ne doit exister qu’une seule balise `<body>` autour de tout le contenu visible.

8. **Pas de tests automatisés**
   - Le script `test` affiche actuellement uniquement une erreur.
   - Aucun test serveur ou navigateur n’est configuré.

9. **Premier point du tracé incorrect**
   - `pointerdown` appelle `drawSegment(last, currentStyle())`.
   - `drawSegment` attend trois arguments : `from`, `to` et `style`.
   - Ce bloc doit tracer un seul point ou créer un segment valide vers la première position seulement après avoir reçu les paramètres attendus.

## Sécurité et déploiement

L’implémentation ne possède pas encore :

- d’authentification;
- de propriétaire ou modérateur de salle;
- de persistance en base de données;
- de chiffrement applicatif;
- de limitation spécifique du débit;
- de validation complète de tous les champs du message.

Pour une utilisation réelle sur Internet :

- servir l’application derrière un hébergeur HTTPS;
- définir une politique pour les noms et accès aux salles;
- valider strictement les coordonnées, la taille et les couleurs;
- ajouter une protection contre les abus;
- utiliser une base de données ou Redis si plusieurs instances du serveur sont déployées;
- conserver une durée d’historique raisonnable.

## Dépannage

### Le port est déjà utilisé

Arrêtez le processus qui utilise `8080`, puis relancez :

```powershell
npm start
```

Ou choisissez un autre port :

```powershell
$env:PORT = "3000"
npm start
```

### Les dépendances sont absentes

Depuis le dossier `server` :

```powershell
npm install
```

### Node.js est trop ancien

Vérifiez la version :

```powershell
node --version
```

Puis installez Node.js 20 ou une version plus récente.

### Le WebSocket ne se connecte pas

Vérifiez que :

- `server.js` est lancé;
- le navigateur utilise la bonne adresse;
- aucun pare-feu ne bloque le port;
- un proxy inverse transmet aussi les connexions WebSocket;
- l’adresse utilise `ws://` en local HTTP et `wss://` en HTTPS.
