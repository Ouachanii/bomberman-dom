import { h, mount, createStore, events } from './myFramework/index.js';

/***** Constants *********************************************************/
const CELL = 32; const COLS = 15; const ROWS = 13; const MAX_PLAYERS = 4;
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const TILE = { EMPTY: 0, WALL: 1, BLOCK: 2, POWER: 3 };
const PWR = { BOMB: 'B', FLAME: 'F', SPEED: 'S' };

/***** RNG util with seed (server shares seed for sync) *******************/
function xorshift(seed) { let x = seed | 0; return () => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) / 4294967296; }; }

/***** Map generation *****************************************************/
function genMap(seed = 1234) {
  const rnd = xorshift(seed);
  const grid = Array.from({ length: ROWS }, (_, y) => Array.from({ length: COLS }, (_, x) => {
    if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) return TILE.WALL;
    if (x % 2 === 0 && y % 2 === 0) return TILE.WALL;
    const safe = ((x < 3 && y < 3) || (x > COLS - 4 && y < 3) || (x < 3 && y > ROWS - 4) || (x > COLS - 4 && y > ROWS - 4));
    if (safe) return TILE.EMPTY;
    return rnd() < 0.6 ? TILE.BLOCK : TILE.EMPTY;
  }));
  return { grid, seed };
}

/***** Entities ***********************************************************/
let nextBombId = 1;
function createPlayer(id, spawn) {
  return { id, x: spawn.x, y: spawn.y, px: spawn.x, py: spawn.y, speed: 4 / 16, bombs: 1, flame: 1, lives: 3, alive: true, placed: 0, name: "?" };
}
function createBomb(owner, x, y, fuseMs = 2100) {
  return { id: nextBombId++, owner, x, y, born: performance.now(), fuseMs };
}

const spawns = [{ x: 1, y: 1 }, { x: COLS - 2, y: 1 }, { x: 1, y: ROWS - 2 }, { x: COLS - 2, y: ROWS - 2 }];

/***** Game State *********************************************************/
const initial = {
  screen: 'lobby',
  me: { id: null, name: '', ready: false },
  lobby: { players: [], count: 0, countdown: null },
  conn: { ws: null, room: null },
  map: genMap((Math.random() * 1e9) | 0),
  players: {},
  bombs: [],
  flames: [],
  startedAt: null,
  fps: 0,
};

const store = createStore(initial);

/***** WebSocket client ***************************************************/
const WS_URL = 'ws://localhost:8080';

function connect() {
  console.log('[WS] connecting to', WS_URL);
  const ws = new WebSocket(WS_URL);
  
  ws.addEventListener('open', () => { 
    console.log('[WS] connection open');
    logSys('Connected to server');
    store.set(s => ({ ...s, conn: { ...s.conn, ws } }));
  });
  
  ws.addEventListener('message', (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      console.log('[WS] received:', msg);
      
      switch (msg.t) {
        case 'lobby': 
          console.log('[LOBBY] Update:', msg.lobby);
          store.set(s => ({ ...s, lobby: msg.lobby })); 
          break;
        case 'join-reject':
          console.log('[AUTH] Join rejected:', msg.message);
          logSys(msg.message);
          break;
        case 'start': 
          console.log('[GAME] Starting game');
          startGame(msg.seed, msg.players); 
          break;
        case 'chat': 
          appendChat(msg); 
          break;
        case 'srv-state': 
          reconcile(msg.state); 
          break;
      }
    } catch (e) {
      console.warn('[WS] Failed to parse message:', e);
    }
  });
  
  ws.addEventListener('close', () => { 
    console.log('[WS] connection closed');
    logSys('Disconnected from server - reconnecting...');
    store.set(s => ({ ...s, conn: { ...s.conn, ws: null } }));
    // Try to reconnect after a short delay
    setTimeout(() => {
      if (store.get().me.name) {  // If we had a name, try to rejoin
        joinLobby(store.get().me.name);
      }
    }, 1000);
  });
  
  ws.addEventListener('error', (ev) => { 
    console.error('[WS] connection error:', ev);
    logSys('Connection error - please try again');
  });
  
  return ws;
}

function wsSend(obj) {
  const ws = store.get().conn.ws;
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(obj));
    console.log('[WS] send', obj.t || obj);
  } else {
    console.warn('[WS] send failed — socket not open', obj);
  }
}

/***** Components ********************************************************/
function Lobby() {
  const s = store.get();
  
  return h('div', {},
    h('h2', {}, 'Bomberman-DOM'),
    h('div', { class: 'row' },
      h('input', {
        id: 'nick',
        type: 'text',
        placeholder: 'Nickname',
        value: s.me.name || '',
        key: 'nickname-input', // Preserve input state
        oninput: (e) => {
          const value = e.target.value || '';
          if (value !== s.me.name) {
            console.log('Updating nickname to:', value); // Debug log
            store.set(st => ({ ...st, me: { ...st.me, name: value } }));
          }
        },
        // Add onchange handler to ensure value is committed
        onchange: (e) => {
          const value = e.target.value || '';
          store.set(st => ({ ...st, me: { ...st.me, name: value } }));
        }
      }),
      h('button', {
        onclick: () => {
          const name = s.me.name?.trim();
          console.log('Current nickname:', name); // Debug log
          if (!name || name.length === 0) {
            logSys('Please enter a nickname before joining');
            return;
          }
          store.set(st => ({ ...st, me: { ...st.me, name } }));
          joinLobby(name);
        }
      }, 'Join')
    ),
    h('div', {},
      h('div', {}, 'Players: ',
        h('span', { class: 'counter' }, String(s.lobby.count)), ' / 4'
      ),
      s.lobby.countdown != null 
        ? h('div', { class: 'timer' }, `Starting in ${s.lobby.countdown}s…`)
        : null
    ),
    h('div', { class: 'small' },
      'Tip: game starts at 4 players, or at ≥2 after a 20s window + auto 10s countdown.'
    )
  );
}

function Game() {
  const s = store.get();
  return h('div', {},
    h('div', { class: 'hud' },
      h('div', { class: 'pill' }, `FPS ${s.fps}`),
      ...Object.values(s.players).map(p => 
        h('div', { class: 'pill' }, 
          `${p.name} ❤ ${p.lives} 💣${p.bombs} 🔥${p.flame}`
        )
      )
    ),
    Board(s),
    s.screen === 'over' ? h('h3', {}, 'Game Over') : null
  );
}

function Board(s) {
  const gridEl = renderGrid(s.map.grid);
  const layers = h('div', { class: 'layer-root' },
    h('div', { class: 'layer', id: 'layer-bombs' }),
    h('div', { class: 'layer', id: 'layer-flames' }),
    h('div', { class: 'layer', id: 'layer-players' })
  );
  return h('div', { id: 'stage' }, gridEl, layers);
}

function ChatPanel() {
  return h('div', {},
    h('h3', {}, 'Chat & Status'),
    h('div', { 
      id: 'chatlog',
      class: 'mono small'
    }, chatLog.map(m =>
      h('div', {
        class: m.from === 'sys' ? 'sys' : m.from === 'me' ? 'me' : 'other'
      }, [
        `[${new Date().toLocaleTimeString()}] `,
        m.from === 'sys' ? '* ' : '',
        m.text
      ])
    )),
    h('form', {
      onsubmit: (e) => {
        e.preventDefault();
        const input = document.getElementById('chatmsg');
        const text = input.value.trim();
        if (text) {
          sendChat(text);
          input.value = '';
        }
      }
    },
      h('div', { class: 'row' },
        h('input', {
          id: 'chatmsg',
          type: 'text',
          placeholder: 'Say hi…'
        }),
        h('button', {}, 'Send')
      )
    ),
    h('div', { class: 'small' }, 'Connected to: ', WS_URL),
    h('div', { class: 'small' },
      'Performance: requestAnimationFrame @ 60fps (no subframe style thrashing)'
    )
  );
}

/***** Rendering *********************************************************/
const leftRoot = document.getElementById('left');
const rightRoot = document.getElementById('right');

function renderLeft() {
  const s = store.get();
  if (s.screen === 'lobby') {
    mount(Lobby(), leftRoot);
  } else {
    mount(Game(), leftRoot);
    renderLayers();
  }
}

function renderRight() {
  mount(ChatPanel(), rightRoot);
}

// Set up selective re-rendering based on state changes
store.subscribe((s) => {
  // Only re-render lobby on lobby-related changes
  if (s.screen === 'lobby' && (s.lobby.count !== store.get().lobby.count || s.lobby.countdown !== store.get().lobby.countdown)) {
    renderLeft();
  }
  // Re-render game screen on game state changes
  if (s.screen === 'game') {
    renderLayers();
  }
});

/***** Game loop *********************************************************/
let last = performance.now(), frames = 0, fpsNow = 0, fpsAcc = 0, fpsTimer = 0;

function loop(now) {
  const dt = now - last;
  last = now;
  
  handleInput(dt);
  tickBombs(now);
  tickFlames(now);
  
  frames++;
  fpsAcc += 1;
  fpsTimer += dt;
  
  if (fpsTimer >= 1000) {
    fpsNow = frames;
    frames = 0;
    fpsTimer = 0;
    store.set(s => ({ ...s, fps: fpsNow }));
  }
  
  requestAnimationFrame(loop);
}

/***** Game logic ********************************************************/
function joinLobby(name) {
  const n = String(name || '').trim();
  console.log('[AUTH] joinLobby attempt:', n);
  
  if (!n) {
    console.warn('[AUTH] empty nickname blocked');
    logSys('Please enter a nickname before joining');
    return;
  }

  // First ensure we have a connection
  let ws = store.get().conn.ws;
  if (!ws || ws.readyState !== 1) {
    ws = connect();
  }

  // Only try to join if we have an open connection
  if (ws.readyState === 1) {
    wsSend({ t: 'join', name: n });
  } else {
    ws.addEventListener('open', () => {
      console.log('[WS] connection opened, sending join request');
      wsSend({ t: 'join', name: n });
    }, { once: true });
  }
}

function startGame(seed, players) {
  console.log('[GAME] startGame seed', seed, 'players', players);
  
  const map = genMap(seed);
  const ps = {};
  
  for (const p of players) {
    const spawn = spawns[p.slot];
    ps[p.id] = { ...createPlayer(p.id, spawn), spawn, name: p.name };
    // Set my ID when starting game
    if (p.name === store.get().me.name) {
      store.set(s => ({ ...s, me: { ...s.me, id: p.id } }));
    }
  }
  
  store.set(s => ({
    ...s,
    screen: 'game',
    map,
    players: ps,
    bombs: [],
    flames: [],
    startedAt: performance.now()
  }));
  
  // Force immediate render after game start
  renderLeft();
  renderLayers();
}

function reconcile(serverState) {
  const s = store.get();
  if (s.screen !== 'game') return;
  
  store.set(st => ({
    ...st,
    bombs: serverState.bombs,
    flames: serverState.flames,
    players: { ...st.players, ...serverState.players }
  }));
}

// Chat
const chatLog = [];

function appendChat(msg) {
  chatLog.push(msg);
  renderRight();
  scrollChatToEnd();
}

function logSys(text) {
  appendChat({ t: 'chat', from: 'sys', text });
}

function sendChat(text) {
  wsSend({ t: 'chat', text });
  appendChat({ t: 'chat', from: 'me', text });
}

function scrollChatToEnd() {
  const el = document.getElementById('chatlog');
  if (el) el.scrollTop = el.scrollHeight;
}

// Input handling
const keys = new Set();

addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
    e.preventDefault();
    keys.add(e.key);
  }
});

addEventListener('keyup', e => keys.delete(e.key));

function handleInput(dt) {
  const s = store.get();
  if (s.screen !== 'game') return;
  
  const me = s.players[s.me.id];
  if (!me || !me.alive) return;
  
  let vx = 0, vy = 0;
  
  if (keys.has('ArrowUp') || keys.has('w')) vy -= 1;
  if (keys.has('ArrowDown') || keys.has('s')) vy += 1;
  if (keys.has('ArrowLeft') || keys.has('a')) vx -= 1;
  if (keys.has('ArrowRight') || keys.has('d')) vx += 1;
  
  const speed = (me.speed) * dt;
  const nx = me.x + vx * speed;
  const ny = me.y + vy * speed;
  const rx = Math.round(nx);
  const ry = Math.round(ny);
  
  if (canWalk(s.map.grid, rx, ry)) {
    me.x = clamp(nx, 1, COLS - 2);
    me.y = clamp(ny, 1, ROWS - 2);
  }
  
  if (keys.has(' ')) {
    placeBomb(Math.round(me.x), Math.round(me.y));
    keys.delete(' ');
  }
  
  const t = s.map.grid[Math.round(me.y)]?.[Math.round(me.x)];
  if (t === TILE.POWER) {
    s.map.grid[Math.round(me.y)][Math.round(me.x)] = TILE.EMPTY;
    const rng = Math.random();
    if (rng < 0.34) me.bombs++;
    else if (rng < 0.67) me.flame++;
    else me.speed += 1 / 16;
  }
  
  wsSend({ t: 'input', id: s.me.id, pos: { x: me.x, y: me.y } });
}

function placeBomb(x, y) {
  const s = store.get();
  const me = s.players[s.me.id];
  if (!me) return;
  
  if (s.bombs.filter(b => b.owner === s.me.id).length >= me.bombs) return;
  if (s.bombs.some(b => b.x === x && b.y === y)) return;
  
  const bomb = createBomb(s.me.id, x, y);
  s.bombs.push(bomb);
  
  wsSend({
    t: 'bomb',
    bomb: {
      owner: s.me.id,
      x, y,
      fuseMs: bomb.fuseMs
    }
  });
}

function tickBombs(now) {
  const s = store.get();
  if (s.screen !== 'game') return;
  
  const due = s.bombs.filter(b => now - b.born >= b.fuseMs);
  for (const b of due) {
    explode(s, b);
  }
  if (due.length) s.bombs = s.bombs.filter(b => !due.includes(b));
}

function tickFlames(now) {
  const s = store.get();
  if (s.screen !== 'game') return;
  s.flames = s.flames.filter(f => now - f.born < f.ttl);
}

function explode(state, bomb) {
  const { grid } = state.map;
  const cells = [{ x: bomb.x, y: bomb.y }];
  const addFlame = (x, y) => cells.push({ x, y });
  
  for (const [dx, dy] of Object.values(DIRS)) {
    for (let r = 1; r <= state.players[bomb.owner].flame; r++) {
      const nx = bomb.x + dx * r, ny = bomb.y + dy * r;
      const t = grid[ny]?.[nx];
      
      if (t === undefined || t === TILE.WALL) break;
      addFlame(nx, ny);
      
      if (t === TILE.BLOCK) {
        grid[ny][nx] = Math.random() < 0.2 ? TILE.POWER : TILE.EMPTY;
        break;
      }
    }
  }
  
  // Damage players
  for (const pid in state.players) {
    const p = state.players[pid];
    if (!p.alive) continue;
    
    if (cells.some(c => c.x === Math.round(p.x) && c.y === Math.round(p.y))) {
      p.lives--;
      if (p.lives <= 0) {
        p.alive = false;
      }
      p.x = p.px = p.spawn.x;
      p.y = p.py = p.spawn.y;
    }
  }
  
  state.flames.push({ cells, born: performance.now(), ttl: 450 });
}

// Grid rendering helpers
let cachedGridHtml = null;

function renderGrid(grid) {
  if (!cachedGridHtml) {
    const gridWrap = document.createElement('div');
    gridWrap.className = 'grid';
    
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const d = document.createElement('div');
        d.className = 'tile';
        d.dataset.x = x;
        d.dataset.y = y;
        gridWrap.appendChild(d);
      }
    }
    
    cachedGridHtml = gridWrap;
  }
  
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const idx = y * COLS + x;
      const el = cachedGridHtml.children[idx];
      const t = grid[y][x];
      
      const cls = t === TILE.WALL ? 'tile t-wall'
        : t === TILE.BLOCK ? 'tile t-block'
        : t === TILE.POWER ? 'tile t-pu'
        : 'tile t-empty';
      
      if (el.className !== cls) {
        el.className = cls;
      }
      
      if (t === TILE.POWER) {
        el.textContent = '';
      }
    }
  }
  
  return cachedGridHtml;
}

function renderLayers() {
  const s = store.get();
  if (s.screen !== 'game') return;
  
  const lp = document.getElementById('layer-players');
  const lb = document.getElementById('layer-bombs');
  const lf = document.getElementById('layer-flames');
  
  lp.replaceChildren();
  lb.replaceChildren();
  lf.replaceChildren();
  
  for (const b of s.bombs) {
    const el = elSprite('bomb', b.x, b.y);
    lb.appendChild(el);
  }
  
  for (const f of s.flames) {
    for (const c of f.cells) {
      const el = elSprite('flame', c.x, c.y);
      lf.appendChild(el);
    }
  }
  
  for (const [id, p] of Object.entries(s.players)) {
    const el = elSprite(
      'player p' + (p.slot ?? 0) + (p.alive ? '' : ' dead'),
      p.x,
      p.y
    );
    el.textContent = (p.name || id).slice(0, 2).toUpperCase();
    lp.appendChild(el);
  }
}

function elSprite(cls, x, y) {
  const el = document.createElement('div');
  el.className = 'sprite ' + cls;
  el.style.transform = `translate(${x * CELL}px,${y * CELL}px)`;
  return el;
}

// Utils
function canWalk(grid, x, y) {
  return grid[y]?.[x] === TILE.EMPTY || grid[y]?.[x] === TILE.POWER;
}

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

// Start the game
renderLeft();
renderRight();
requestAnimationFrame(loop);
