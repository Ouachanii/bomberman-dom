// server.js — Node WebSocket server (authoritative-ish, simple)
// Run: npm i ws express && node server.js
import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';

const app = express();
app.use(express.static('.'));
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const MAX_PLAYERS = 4; const MIN_TO_START = 2; const WAIT_WINDOW_MS = 20_000; const READY_COUNTDOWN_MS = 10_000;
let lobby = { players: [], count: 0, countdown: null, timer: null, seed: (Math.random() * 1e9) | 0 };
const peers = new Map(); // ws -> { id,name,slot }

const game = { started: false, state: { players: {}, bombs: [], flames: [] } };

function broadcast(obj) { const s = JSON.stringify(obj); for (const ws of wss.clients) if (ws.readyState === 1) ws.send(s); }
function syncLobby() { broadcast({ t: 'lobby', lobby: { players: lobby.players, count: lobby.players.length, countdown: lobby.countdown } }); }
function startCountdown() {
  if (lobby.countdown != null) return; lobby.countdown = Math.ceil(READY_COUNTDOWN_MS / 1000); syncLobby();
  lobby.timer = setInterval(() => { lobby.countdown--; syncLobby(); if (lobby.countdown <= 0) { clearInterval(lobby.timer); startGame(); } }, 1000);
}
function resetLobby() { if (lobby.timer) clearInterval(lobby.timer); lobby = { players: [], count: 0, countdown: null, timer: null, seed: (Math.random() * 1e9) | 0 }; }
resetLobby();
function startGame() {
  console.log('[SERVER] starting game with players:', lobby.players.map(p => p.name));
  game.started = true; game.state = { players: {}, bombs: [], flames: [] };
  for (const p of lobby.players) { game.state.players[p.id] = { id: p.id, x: p.spawn.x, y: p.spawn.y, bombs: 1, flame: 1, lives: 3, alive: true, slot: p.slot, name: p.name }; }
  broadcast({ t: 'start', seed: lobby.seed, players: lobby.players.map(p => ({ id: p.id, name: p.name, slot: p.slot })) });
  // begin state tick to clients (10/s)
  setInterval(() => broadcast({ t: 'srv-state', state: game.state }), 100);
}

function nextSlot() { const used = new Set(lobby.players.map(p => p.slot)); for (let i = 0; i < MAX_PLAYERS; i++) if (!used.has(i)) return i; return null; }
function spawnForSlot(slot, COLS = 15, ROWS = 13) { const sp = [{ x: 1, y: 1 }, { x: COLS - 2, y: 1 }, { x: 1, y: ROWS - 2 }, { x: COLS - 2, y: ROWS - 2 }]; return sp[slot]; }

wss.on('connection', (ws) => {
  console.log('[SERVER] client connected');
  ws.on('message', (buf) => {
    let msg; try { msg = JSON.parse(buf.toString()); } catch (err) { console.warn('[SERVER] malformed message', buf.toString()); return; }
    console.log('[SERVER] msg', msg.t, msg);
    if (msg.t === 'join') {
      console.log('[SERVER] join attempt:', msg.name);
      if (game.started) { ws.send(JSON.stringify({ t: 'chat', from: 'sys', text: 'Game in progress. Please wait.' })); return; }
      const rawName = String(msg.name || '').trim(); const name = rawName.slice(0, 12);
      if (!name) { ws.send(JSON.stringify({ t: 'join-reject', reason: 'empty', message: 'Empty nickname' })); return; }
      // duplicate name check (case-insensitive)
      if (lobby.players.some(p => p.name && p.name.toLowerCase() === name.toLowerCase())) {
        console.log('[SERVER] rejected duplicate nickname:', name);
        ws.send(JSON.stringify({ t: 'join-reject', reason: 'duplicate', message: 'Nickname already taken' }));
        ws.send(JSON.stringify({ t: 'chat', from: 'sys', text: 'Nickname "' + name + '" is already taken. Choose another.' }));
        return;
      }
      const id = Math.random().toString(36).slice(2, 9);
      const slot = nextSlot(); if (slot == null) { ws.send(JSON.stringify({ t: 'chat', from: 'sys', text: 'Room full.' })); return; }
      const p = { id, name, slot, spawn: spawnForSlot(slot) };
      peers.set(ws, p); lobby.players.push(p); syncLobby(); ws.send(JSON.stringify({ t: 'chat', from: 'sys', text: `Welcome ${p.name}!` }));
      console.log('[SERVER] joined:', p.name, 'slot', slot);
      // start timers per rules
      if (lobby.players.length >= MIN_TO_START) {
        // start 20s window if not already
        if (!lobby.windowStarted) { lobby.windowStarted = true; setTimeout(() => { if (!game.started && lobby.players.length >= MIN_TO_START) startCountdown(); }, WAIT_WINDOW_MS); }
      }
      if (lobby.players.length === MAX_PLAYERS) startCountdown();
    }
    else if (msg.t === 'chat') {
      const p = peers.get(ws); const from = p ? p.name : 'anon'; console.log('[SERVER] chat from', from, msg.text);
      broadcast({ t: 'chat', from, text: String(msg.text).slice(0, 300) });
    }
    else if (msg.t === 'input') {
      const p = peers.get(ws); if (!p || !game.started) return; const gp = game.state.players[p.id]; if (!gp) return; gp.x = msg.pos.x; gp.y = msg.pos.y;
    }
    else if (msg.t === 'bomb') {
      const p = peers.get(ws); if (!p || !game.started) return; const b = { owner: p.id, x: msg.bomb.x, y: msg.bomb.y, born: Date.now(), fuseMs: msg.bomb.fuseMs };
      console.log('[SERVER] bomb placed by', p.name, b.x, b.y);
      if (!game.state.bombs.some(o => o.x === b.x && o.y === b.y)) game.state.bombs.push(b);
      setTimeout(() => explode(b), b.fuseMs);
    }
  });
  ws.on('close', () => {
    console.log('[SERVER] client disconnected');
    const p = peers.get(ws); if (!p) return; peers.delete(ws); lobby.players = lobby.players.filter(x => x.id !== p.id); syncLobby();
  });
});

function explode(bomb) {
  const flameCells = [{ x: bomb.x, y: bomb.y }]; const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]]; const range = (game.state.players[bomb.owner]?.flame) || 1;
  for (const [dx, dy] of dirs) { for (let r = 1; r <= range; r++) { flameCells.push({ x: bomb.x + dx * r, y: bomb.y + dy * r }); } }
  const fl = { cells: flameCells, born: Date.now(), ttl: 450 }; game.state.flames.push(fl);
  setTimeout(() => { game.state.flames = game.state.flames.filter(f => f !== fl); }, fl.ttl + 10);
  // remove bomb from list
  game.state.bombs = game.state.bombs.filter(b => !(b.x === bomb.x && b.y === bomb.y));
}

const PORT = process.env.PORT || 8080; server.listen(PORT, () => console.log('http://localhost:' + PORT));
