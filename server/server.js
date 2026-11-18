const { WebSocketServer, WebSocket } = require('ws');

const wss = new WebSocketServer({ port: 8080, host: '0.0.0.0' });
console.log('Serveur lancé sur le port 8080');

wss.on('connection', (ws) => {
  console.log('Client connecté, total :', wss.clients.size);

  ws.on('message', (data) => {
    
    // À VOUS : renvoyer `data.toString()` à tous les clients de wss.clients
    // SAUF celui qui l'a envoyé (ws), et seulement si
    // client.readyState === WebSocket.OPEN
  });

  ws.on('close', () => console.log('Client parti'));
});