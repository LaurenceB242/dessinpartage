const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, maxPayload: 64 * 1024 });

const MAX_HISTORY = 20000;               // limite de messages gardés par salle
const rooms = new Map();                 // nom -> { history, clients, cleanup }

function getRoom(name) {
  if (!rooms.has(name)) rooms.set(name, { history: [], clients: new Set(), cleanup: null });
  const room = rooms.get(name);
  clearTimeout(room.cleanup);
  return room;
}

function broadcast(room, text, except) {
  for (const c of room.clients) {
    if (c !== except && c.readyState === WebSocket.OPEN) c.send(text);
  }
}

function sendPresence(room) {
  broadcast(room, JSON.stringify({ type: 'presence', count: room.clients.size }), null);
}

function leave(ws) {
  const name = ws.roomName;
  const room = name && rooms.get(name);
  if (!room) return;
  room.clients.delete(ws);
  ws.roomName = null;
  sendPresence(room);
  if (room.clients.size === 0) {
    // salle vide : on la garde 30 min puis on la supprime
    room.cleanup = setTimeout(() => {
      if (room.clients.size === 0) rooms.delete(name);
    }, 30 * 60 * 1000);
  }
}

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('error', () => {});

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }

    if (msg.type === 'join') {
      if (typeof msg.room !== 'string' || !/^[a-z0-9-]{1,32}$/i.test(msg.room)) return;
      leave(ws);
      const name = msg.room.toLowerCase();
      const room = getRoom(name);
      ws.roomName = name;
      room.clients.add(ws);
      ws.send(JSON.stringify({ type: 'history', items: room.history }));
      sendPresence(room);
      return;
    }

    const room = rooms.get(ws.roomName);
    if (!room || !room.clients.has(ws)) return;

    if (msg.type === 'stroke') {
      room.history.push(msg);
      if (room.history.length > MAX_HISTORY) room.history.shift();
      broadcast(room, JSON.stringify(msg), ws);
    } else if (msg.type === 'clear') {
      room.history = [];
      broadcast(room, JSON.stringify(msg), ws);
    }
  });

  ws.on('close', () => leave(ws));
});

// Battement de cœur : évite que l'hébergeur coupe les connexions inactives
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => console.log('Serveur sur le port', PORT));