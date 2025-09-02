// Main application entry point
import { renderApp } from './mini-framework/render.js';
import { initRouter } from './mini-framework/router.js';
import { initGame, joinGame, getState, onGameUpdate, initInput, sendChatMessage, handleKeyDown, handleKeyUp } from './game.js';

let animationId;
let lastFrameTime = 0;
const TARGET_FPS = 60;
const FRAME_TIME = 1000 / TARGET_FPS;
let chatInputFocused = false;

function h(type, props = {}, ...children) {
  return {
    type,
    props,
    children: children.flat()
  };
}

function NicknameScreen() {
  const state = getState();

  function handleSubmit(e) {
    e.preventDefault();
    const nickname = e.target.nickname.value.trim();
    if (nickname.length > 0 && nickname.length <= 20) {
      joinGame(nickname);
    }
  }

  return h('div', { class: 'screen' },
    h('h1', {}, 'Bomberman DOM'),
    h('p', {}, 'Enter your nickname to join the battle!'),
    state.error && h('p', { style: 'color: #ff4444;' }, state.error),
    h('form', { onsubmit: handleSubmit },
      h('input', {
        type: 'text',
        name: 'nickname',
        placeholder: 'Enter nickname...',
        maxlength: '20',
        required: true
      }),
      h('br'),
      h('button', { type: 'submit', class: 'btn' }, 'Join Game')
    )
  );
}

function WaitingScreen() {
  const state = getState();

  function handleChatSubmit(e) {
    e.preventDefault();
    const message = e.target.message.value.trim();
    if (message) {
      sendChatMessage(message);
      e.target.message.value = '';
    }
  }

  return h('div', { class: 'screen waiting-screen' },
    h('div', { class: 'waiting-info' },
      h('h1', {}, 'Waiting for Players'),
      h('p', {}, `Players: ${state.playerCount}/4`),
      state.waitingTime > 0 && state.playerCount >= 2 ? [
        h('div', { class: 'waiting-time' }, `Waiting time: ${state.waitingTime}s`)
      ] : [],
      state.countdown > 0 ? [
        h('div', { class: 'countdown' }, `Game starts in: ${state.countdown}s`)
      ] :
        state.playerCount < 2 ? [
          h('p', {}, 'Waiting for more players...')
        ] : [],
      h('div', { class: 'player-list' },
        Object.values(state.players).map((player, index) =>
          h('div', { key: player.id, class: 'player-info' },
            h('span', { class: `player-${index}` }, '●'), ' ', player.nickname
          )
        )
      )
    ),
    h('div', { class: 'chat-container' },
      h('div', { class: 'chat' },
        h('h4', {}, 'Chat'),
        h('div', { class: 'chat-messages' },
          ...state.chatMessages.slice(-20).map((msg, index) =>
            h('div', { key: index, class: 'message' },
              h('strong', {}, msg.nickname + ': '),
              msg.message
            )
          )
        ),
        h('form', { class: 'chat-input', onsubmit: handleChatSubmit },
          h('input', {
            type: 'text',
            name: 'message',
            placeholder: 'Type message...',
            maxlength: '100'
          }),
          // h('button', { type: 'submit', class: 'btn chat-btn' }, 'Send')
        )
      )
    )
  );
}

function GameScreen() {

  const state = getState();

  const myPlayer = state.players[state.myPlayerId];

  function handleChatSubmit(e) {
    e.preventDefault();
    const message = e.target.message.value.trim();
    if (message) {
      sendChatMessage(message);
      e.target.message.value = '';
    }
  }

  const playerArray = Object.values(state.players);

  return h('div', { class: 'game-container' },
    // Game Board
    h('div', { class: 'game-board', style: 'width: 480px; height: 416px;' },
      // Map cells
      ...state.map.flatMap((row, y) =>
        row.map((cell, x) =>
          h('div', {
            key: `cell-${x}-${y}`,
            class: `game-cell ${cell}`,
            style: `left: ${x * 32}px; top: ${y * 32}px;`
          })
        )
      ),

      // Players
      ...Object.values(state.players)
        .map(player =>
          h('div', {
            key: player.id,
            class: `player player-${player.colorIndex}` + (player.alive ? '' : ' player-dead'),
            style: `left: ${player.x * 32}px; top: ${player.y * 32}px;`
          })
        ),

      // Powerups with icons
      ...state.powerups.map((powerup, index) => {
        let icon = '';
        switch (powerup.type) {
          case 'bombs':
            icon = '💣';
            break;
          case 'flames':
            icon = '🔥';
            break;
          case 'speed':
            icon = '🚀';
            break;
        }
        return h('div', { key: `powerup-${index}`, class: `powerup ${powerup.type}`, style: `left: ${powerup.x * 32}px; top: ${powerup.y * 32}px;` }, icon);
      }),

      // Bombs
      ...state.bombs.map(bomb =>
        h('div', {
          key: `bomb-${bomb.id}`,
          class: 'bomb',
          style: `left: ${bomb.x * 32}px; top: ${bomb.y * 32}px;`
        })
      ),

      // Explosions
      ...state.explosions.map((explosion, index) =>
        h('div', {
          key: `explosion-${index}`,
          class: 'explosion',
          style: `left: ${explosion.x * 32}px; top: ${explosion.y * 32}px;`
        })
      )
    ),

    // Sidebar split into left and right
    h('div', { class: 'sidebar-container' },
      h('div', { class: 'sidebar-left' },
        myPlayer && h('span', { class: 'my-stats' },
          h('h3', {}, 'Your Stats'),
          h('div', {
            class: `stat stat-lives ${myPlayer._prevLives !== undefined && myPlayer._prevLives !== myPlayer.lives ? 'value-changed' : ''}`,
            onanimationend: () => { myPlayer._prevLives = myPlayer.lives; }
          }, `❤️ Lives: ${myPlayer.lives ?? 0}`),
          h('div', {
            class: `stat stat-bombs ${myPlayer._prevBombs !== undefined && myPlayer._prevBombs !== myPlayer.bombs ? 'value-changed' : ''}`,
            onanimationend: () => { myPlayer._prevBombs = myPlayer.bombs; }
          }, `💣 Bombs: ${myPlayer.bombs ?? 1}`),
          h('div', {
            class: `stat stat-flames ${myPlayer._prevFlames !== undefined && myPlayer._prevFlames !== myPlayer.flames ? 'value-changed' : ''}`,
            onanimationend: () => { myPlayer._prevFlames = myPlayer.flames; }
          }, `🔥 Flames: ${myPlayer.flames ?? 1}`),
          h('div', {
            class: `stat stat-speed ${myPlayer._prevSpeed !== undefined && myPlayer._prevSpeed !== myPlayer.speed ? 'value-changed' : ''}`,
            onanimationend: () => { myPlayer._prevSpeed = myPlayer.speed; }
          }, `🚀 Speed: ${myPlayer.speed ? myPlayer.speed.toFixed(1) : 1}`)
        ),
        h('div', { class: 'controls' },
          h('h4', {}, 'Controls'),
          h('p', {}, 'Arrow Keys : Move'),
          h('p', {}, 'Space : Place Bomb')
        )
      ),
      h('div', { class: 'sidebar-right' },
        h('h3', {}, 'Players'),
        h('span', { class: 'player-list' },
          ...playerArray
            .filter(player => player.alive) // Only show alive players
            .map((player) => {
              const isMe = player.id === state.myPlayerId;
              return h('div', {
                key: player.id,
                class: 'player-info player-stats',
                style: isMe ? 'border: 2px solid #007bff; padding: 8px; margin: 4px 0; border-radius: 4px;' : 'padding: 8px; margin: 4px 0;'
              },
                h('div', { class: 'player-header' },
                  h('span', { class: `player-${player.colorIndex}` }, '●'),
                  ' ',
                  player.nickname,
                  isMe ? ' (You)' : ''
                ),
              );
            })
        )
      )
    )
  );
}

function GameOverScreen() {
  const state = getState();

  return h('div', { class: 'screen' },

    h('h1', {}, 'Game Over!'),

    state.winner ?

      h('h2', {}, `🎉 ${state.winner.nickname} Wins! 🎉`) :

      h('h2', {}, 'No Winner'),

    h('p', {}, '🏆 Go back to lobby champion! 🏆'),

    h('button', {
      class: 'btn',
      onclick: () => window.location.reload()            ///////////////
    }, 'Play Again')
  );



}

function appHandleKeyDown(e) {
  if (!chatInputFocused) {
    handleKeyDown(e);
  }
}
function appHandleKeyUp(e) {
  if (!chatInputFocused) {
    handleKeyUp(e);
  }
}



function App() {
  const state = getState();

  // Add keyboard event handlers to the root element
  const appProps = {
    onkeydown: appHandleKeyDown,
    onkeyup: appHandleKeyUp,
    tabindex: '0', // Make div focusable
    style: 'outline: none;' // Remove focus outline
  };

  let content;
  switch (state.screen) {
    case 'nickname':
      content = NicknameScreen();
      break;
    case 'waiting':
      content = WaitingScreen();
      break;
    case 'game':
      content = GameScreen();
      break;
    case 'gameover':
      content = GameOverScreen();
      break;
    default:
      content = h('div', {}, 'Loading...');
  }

  return h('div', appProps, content);
}

function gameLoop(currentTime) {
  if (!lastFrameTime) {
    lastFrameTime = currentTime;
  }

  const deltaTime = currentTime - lastFrameTime;

  if (deltaTime >= FRAME_TIME) {
    // Calculate FPS and skip frames if needed
    const framesElapsed = Math.floor(deltaTime / FRAME_TIME);
    if (framesElapsed < 3) { // Only render if we haven't skipped too many frames
      renderApp(App, document.getElementById('app'));
    }
    lastFrameTime = currentTime - (deltaTime % FRAME_TIME);
  }

  animationId = requestAnimationFrame(gameLoop);
}

function init() {

  initRouter();
  initGame();
  initInput();

  onGameUpdate(() => {
    renderApp(App, document.getElementById('app'));
  });

  // Start game loop
  animationId = requestAnimationFrame(gameLoop);

  // Focus the app for keyboard input
  setTimeout(() => {
    const appElement = document.getElementById('app');
    if (appElement.firstChild) {
      appElement.firstChild.focus();
    }
  }, 100);
}

// 🚀 Start the application
init();