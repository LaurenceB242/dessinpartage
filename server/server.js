const { WebSocketServer, WebSocket } = require('ws');

const wss = new WebSocketServer({ port: 8080, host: '0.0.0.0' });
console.log('Serveur lancé sur le port 8080');

wss.on('connection', (ws) => {
  console.log('Client connecté, total :', wss.clients.size);

  ws.on('message', (data) => {
    
    const text = data.toString();
    for (const client of wss.clients) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(text);
        }
    }
  });

  ws.on('close', () => console.log('Client parti'));
});