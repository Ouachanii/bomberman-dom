/***** mini-framework adapter (auto-detect + fallback) *********************************/
// This adapter will try to detect a real mini-framework on window.miniFW or window.MiniFW
// If found it will use its `h`, `mount` and `createStore` implementations. Otherwise it
// falls back to the lightweight inline implementation used in the scaffold.
(function () {
  const detected = window.miniFW || window.MiniFW || window.__MINI_FW__;
  if (detected && typeof detected.h === 'function' && typeof detected.mount === 'function') {
    console.log('[mini-fw] Detected external mini-framework, wiring adapter');
    window.h = detected.h;
    window.mount = detected.mount;
    window.createStore = detected.createStore || detected.store || (detected.createStore && detected.createStore.bind(detected));
    return;
  }
  console.log('[mini-fw] No external framework found — using local fallback');
  // fallback hyperscript + mount + store
  window.h = (tag, props = {}, ...kids) => ({ tag, props, kids: kids.flat() });
  window.mount = (vnode, parent) => { parent.replaceChildren(render(vnode)); };
  function render(v) {
    if (v == null || v === false) return document.createComment('');
    if (typeof v === 'string' || typeof v === 'number') return document.createTextNode(String(v));
    const el = document.createElement(v.tag);
    for (const [k, val] of Object.entries(v.props || {})) {
      if (k.startsWith('on') && typeof val === 'function') el.addEventListener(k.slice(2).toLowerCase(), val);
      else if (k === 'class') el.className = val; 
      else if (k === 'style') Object.assign(el.style, val); 
      else el.setAttribute(k, val);
    }
    for (const kid of v.kids) el.appendChild(render(kid));
    return el;
  }
  window.render = render;
  // tiny store with subscriptions
  window.createStore = function (initial) {
    let state = structuredClone(initial); const subs = new Set();
    return {
      get: () => state,
      set: (up) => { state = typeof up === 'function' ? up(state) : up; subs.forEach(fn => fn(state)); },
      sub: (fn) => (subs.add(fn), () => subs.delete(fn)),
    };
  };
})();

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
    // Borders are walls
    if (x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1) return TILE.WALL;
    // Solid wall checkerboard
    if (x % 2 === 0 && y % 2 === 0) return TILE.WALL;
    // Keep starting zones clear (2 tiles from corners)
    const safe = ((x < 3 && y < 3) || (x > COLS - 4 && y < 3) || (x < 3 && y > ROWS - 4) || (x > COLS - 4 && y > ROWS - 4));
    if (safe) return TILE.EMPTY;
    // Random blocks
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

/***** Physics & helpers **************************************************/
const canWalk = (grid, x, y) => grid[y]?.[x] === TILE.EMPTY || grid[y]?.[x] === TILE.POWER;
const clamp = (v, min, max) => v < min ? min : v > max ? max : v;

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
        // destroy and maybe spawn powerup
        grid[ny][nx] = Math.random() < 0.2 ? TILE.POWER : TILE.EMPTY; // powerup tile rendered with letter
        break;
      }
    }
  }
  // damage players
  for (const pid in state.players) {
    const p = state.players[pid]; if (!p.alive) continue;
    if (cells.some(c => c.x === Math.round(p.x) && c.y === Math.round(p.y))) {
      p.lives--; if (p.lives <= 0) { p.alive = false; }
      p.x = p.px = p.spawn.x; p.y = p.py = p.spawn.y; // respawn if still alive
    }
  }
  state.flames.push({ cells, born: performance.now(), ttl: 450 });
}

/***** Game State *********************************************************/
const initial = {
  screen: 'lobby', // lobby | game | over
  me: { id: null, name: '', ready: false },
  lobby: { players: [], count: 0, countdown: null },
  conn: { ws: null, room: null },

  // game
  map: genMap((Math.random() * 1e9) | 0),
  players: {}, // id -> player
  bombs: [],
  flames: [],
  startedAt: null,
  fps: 0,
};

const store = createStore(initial);

/***** WebSocket client ***************************************************/
const WS_URL = location.origin.replace(/^http/, 'ws'); // assumes same host/port
function connect() {
  console.log('[WS] connecting to', WS_URL);
  const ws = new WebSocket(WS_URL);
  store.set(s => ({ ...s, conn: { ...s.conn, ws } }));
  ws.addEventListener('open', () => { logSys('connected'); console.log('[WS] open'); });
  ws.addEventListener('message', (ev) => {
    try { const msg = JSON.parse(ev.data); console.log('[WS] recv', msg.t, msg); } 
    catch (e) { console.warn('[WS] recv non-json', ev.data); }
    const msg = JSON.parse(ev.data);
    switch (msg.t) {
      case 'lobby': store.set(s => ({ ...s, lobby: msg.lobby })); break;
      case 'start': startGame(msg.seed, msg.players); break;
      case 'chat': appendChat(msg); break;
      case 'srv-state': reconcile(msg.state); break;
    }
  });
  ws.addEventListener('close', (ev) => { logSys('disconnected'); console.log('[WS] close', ev && ev.code); });
  ws.addEventListener('error', (ev) => { console.error('[WS] error', ev); });
  return ws;
}

function wsSend(obj) { 
  const ws = store.get().conn.ws; 
  try { if (ws && ws.readyState === 1) { ws.send(JSON.stringify(obj)); 
    console.log('[WS] send', obj.t || obj); } 
    else { 
      console.warn('[WS] send failed — socket not open', obj); 
    } 
  } catch (e) { console.error('[WS] send error', e, obj); } }

/***** Lobby **************************************************************/
function joinLobby(name) {
  const n = String(name || '').trim();
  console.log('[AUTH] joinLobby attempt:', n);
  if (!n) {
    console.warn('[AUTH] empty nickname blocked');
    logSys('Please enter a nickname before joining');
    return;
  }
  wsSend({ t: 'join', name: n });
}

/***** Chat UI/state ******************************************************/
const chatLog = [];
function appendChat(msg) { chatLog.push(msg); renderRight(); scrollChatToEnd(); }
function logSys(text) { appendChat({ t: 'chat', from: 'sys', text }); }
function sendChat(text) { wsSend({ t: 'chat', text }); appendChat({ t: 'chat', from: 'me', text }); }
function scrollChatToEnd() { const el = document.getElementById('chatlog'); if (el) el.scrollTop = el.scrollHeight; }

/***** Game start / reconciliation ****************************************/
function startGame(seed, players) {
  console.log('[GAME] startGame seed', seed, 'players', players);
  const map = genMap(seed);
  const ps = {};
  for (const p of players) {
    const spawn = spawns[p.slot];
    ps[p.id] = { ...createPlayer(p.id, spawn), spawn, name: p.name };
  }
  store.set(s => ({ ...s, screen: 'game', map, players: ps, bombs: [], flames: [], startedAt: performance.now() }));
}

function reconcile(serverState) {
  // naive: trust server for bombs/flames and positions
  const s = store.get();
  if (s.screen !== 'game') return;
  store.set(st => ({ ...st, bombs: serverState.bombs, flames: serverState.flames, players: { ...st.players, ...serverState.players } }));
}

/***** Input handling *****************************************************/
const keys = new Set();
addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
    e.preventDefault();
    keys.add(e.key);
  } 
});
addEventListener('keyup', e => keys.delete(e.key));

function handleInput(dt) {
  const s = store.get(); if (s.screen !== 'game') return;
  const me = s.players[s.me.id]; if (!me || !me.alive) return;
  let vx = 0, vy = 0;
  if (keys.has('ArrowUp') || keys.has('w')) vy -= 1;
  if (keys.has('ArrowDown') || keys.has('s')) vy += 1;
  if (keys.has('ArrowLeft') || keys.has('a')) vx -= 1;
  if (keys.has('ArrowRight') || keys.has('d')) vx += 1;
  const speed = (me.speed) * dt; // tiles per ms
  const nx = me.x + vx * speed; const ny = me.y + vy * speed;
  const rx = Math.round(nx), ry = Math.round(ny);
  if (canWalk(s.map.grid, rx, ry)) { 
    me.x = clamp(nx, 1, COLS - 2); 
    me.y = clamp(ny, 1, ROWS - 2); 
  }

  if (keys.has(' ')) {
    // place bomb at rounded cell
    placeBomb(Math.round(me.x), Math.round(me.y));
    keys.delete(' ');
  }
  // pickup powerups
  const t = s.map.grid[Math.round(me.y)]?.[Math.round(me.x)];
  if (t === TILE.POWER) {
    s.map.grid[Math.round(me.y)][Math.round(me.x)] = TILE.EMPTY;
    const rng = Math.random();
    if (rng < 0.34) me.bombs++; else if (rng < 0.67) me.flame++; else me.speed += 1 / 16;
  }

  wsSend({ t: 'input', id: s.me.id, pos: { x: me.x, y: me.y } });
}

function placeBomb(x, y) {
  const s = store.get(); const me = s.players[s.me.id]; if (!me) return;
  if (s.bombs.filter(b => b.owner === s.me.id).length >= me.bombs) return;
  if (s.bombs.some(b => b.x === x && b.y === y)) return;
  const bomb = createBomb(s.me.id, x, y);
  s.bombs.push(bomb); wsSend({ t: 'bomb', bomb: { owner: s.me.id, x, y, fuseMs: bomb.fuseMs } });
}

/***** Game loop **********************************************************/
let last = performance.now(), frames = 0, fpsNow = 0, fpsAcc = 0, fpsTimer = 0;
function loop(now) {
  const dt = now - last; last = now; // ms
  handleInput(dt);
  tickBombs(now);
  tickFlames(now);
  frames++; fpsAcc += 1; fpsTimer += dt; 
  if (fpsTimer >= 1000) { 
    fpsNow = frames; 
    frames = 0; 
    fpsTimer = 0; 
    store.set(s => ({ ...s, fps: fpsNow })); 
  }
  renderLeft(); // cheap DOM diffs
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function tickBombs(now) {
  const s = store.get(); if (s.screen !== 'game') return;
  const due = s.bombs.filter(b => now - b.born >= b.fuseMs);
  for (const b of due) { explode(s, b); }
  if (due.length) s.bombs = s.bombs.filter(b => !due.includes(b));
}
function tickFlames(now) {
  const s = store.get(); if (s.screen !== 'game') return;
  s.flames = s.flames.filter(f => now - f.born < f.ttl);
}

/***** Views **************************************************************/
const leftRoot = document.getElementById('left');
const rightRoot = document.getElementById('right');

function Lobby() {
  const s = store.get();

  return h('div', {},
    h('h2', {}, 'Bomberman-DOM'),

    // Nickname input + Join button
    h('div', { class: 'row' },
      h('input', {
        id: 'nick',
        type: 'text',
        placeholder: 'Nickname',
        value: s.me.name, // reflect store value
        oninput: (e) => {
          const value = e.target.value;
          store.set(st => ({ ...st, me: { ...st.me, name: value } }));
        }
      }),
      h('button', {
        onclick: () => {
          const name = document.getElementById('nick').value.trim();
          if (!name) {
            logSys('Please enter a nickname before joining');
            return;
          }

          // Connect WS if not already connected
          const wsState = store.get().conn.ws;
          if (!wsState || wsState.readyState !== 1) connect();

          // Send join message
          joinLobby(name);
        }
      }, 'Join')
    ),

    // Lobby info
    h('div', {},
      h('div', {}, 'Players: ', h('span', { class: 'counter' }, String(s.lobby.count)), ' / 4'),
      s.lobby.countdown != null ? h('div', { class: 'timer' }, `Starting in ${s.lobby.countdown}s…`) : null
    ),

    // Tip
    h('div', { class: 'small' }, 'Tip: game starts at 4 players, or at ≥2 after a 20s window + auto 10s countdown.')
  );
}


function Game() {
  const s = store.get();
  return h('div', {},
    h('div', { class: 'hud' },
      h('div', { class: 'pill' }, `FPS ${s.fps}`),
      ...Object.values(s.players).map(p => h('div', { class: 'pill' }, `${p.name} ❤ ${p.lives}  💣${p.bombs} 🔥${p.flame}`))
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

// cache static grid element so we don’t rebuild each frame
let cachedGridHtml = null;
function renderGrid(grid) {
  if (!cachedGridHtml) {
    const gridWrap = document.createElement('div'); gridWrap.className = 'grid';
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const d = document.createElement('div'); d.className = 'tile'; d.dataset.x = x; d.dataset.y = y; gridWrap.appendChild(d);
    }
    cachedGridHtml = gridWrap;
  }
  // paint classes only when changed
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const idx = y * COLS + x; const el = cachedGridHtml.children[idx];
    const t = grid[y][x];
    const cls = t === TILE.WALL ? 'tile t-wall' : t === TILE.BLOCK ? 'tile t-block' : t === TILE.POWER ? 'tile t-pu' : 'tile t-empty';
    if (el.className !== cls) el.className = cls;
    if (t === TILE.POWER) el.textContent = '';
  }
  return cachedGridHtml;
}

// dynamic layers updated per frame without reflow storms
function renderLayers() {
  const s = store.get(); if (s.screen !== 'game') return;
  const lp = document.getElementById('layer-players');
  const lb = document.getElementById('layer-bombs');
  const lf = document.getElementById('layer-flames');

  lp.replaceChildren(); lb.replaceChildren(); lf.replaceChildren();

  for (const b of s.bombs) { 
    const el = elSprite('bomb', b.x, b.y); lb.appendChild(el); 
  }
  for (const f of s.flames) { 
    for (const c of f.cells) { 
      const el = elSprite('flame', c.x, c.y); lf.appendChild(el); 
    } 
  }
  for (const [id, p] of Object.entries(s.players)) {
    const el = elSprite('player p' + (p.slot ?? 0) + (p.alive ? '' : ' dead'), p.x, p.y); 
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

function renderLeft() {
  const s = store.get();
  if (s.screen === 'lobby') {
    mount(Lobby(), leftRoot);
  } else {

    mount(Game(), leftRoot);
    renderLayers();

  }
}

function ChatPanel() {
  return h('div', {},
    h('h3', {}, 'Chat & Status'),
    h('div', { id: 'chatlog', class: 'mono small' }, chatLog.map(m =>
      h('div', { class: m.from === 'sys' ? 'sys' : m.from === 'me' ? 'me' : 'other' },
        `[${new Date().toLocaleTimeString()}] `, m.from === 'sys' ? '* ' : '', m.text)
    )
    ),
    h('form', { onsubmit: (e) => { 
      e.preventDefault(); 
      const i = document.getElementById('chatmsg'); 
      const v = i.value.trim(); 
      if (v) { sendChat(v); i.value = '';
      } 
    } 
  },
      h('div', { class: 'row' },
        h('input', { id: 'chatmsg', type: 'text', placeholder: 'Say hi…' }),
        h('button', {}, 'Send')
      )
    ),
    h('div', { class: 'small' }, 'Connected to: ', location.origin.replace(/^http/, 'ws')),
    h('div', { class: 'small' }, 'Performance: requestAnimationFrame @ 60fps (no subframe style thrashing)')
  );
}

function renderRight() { mount(ChatPanel(), rightRoot); }

// initial render
renderLeft();
renderRight();

/***** SERVER MESSAGES EXPECTED *******************************************
 * t:"lobby"          { lobby: { players:[{id,name,slot}], count, countdown|null } }
 * t:"start"          { seed, players:[{id,name,slot}] }
 * t:"chat"           { from, text }
 * t:"srv-state"      { state: { players,bombs,flames } }
 * t:"input" (client) { id, pos:{x,y} }
 * t:"bomb"  (client) { bomb:{owner,x,y,fuseMs} }
****************************************************************************/