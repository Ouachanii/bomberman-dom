// game-state.js
const { initializeMap, getStartingPosition } = require('./map-utils'); // Import map utilities

// Game Constants
const MAX_PLAYERS = 4;
const MIN_PLAYERS = 2;
const WAITING_TIME = 20; // 20 seconds
const COUNTDOWN_TIME = 10000; // 10 seconds (10 seconds)

// Store active nicknames (shared across all modules)
const activeNicknames = new Set();

// Game state (will be mutable, so we export a reference)
let gameState = {
  players: {},
  gameStarted: false,
  waitingTimer: null, // For the 20-second waiting phase
  gameTimer: null,    // For the 10-second countdown before game start
  waitingTimeCounter: null, // For the interval that decrements waitingTime
  waitingTime: WAITING_TIME, // Current remaining waiting time
  map: [],
  bombs: [],
  powerups: [],
  nextColorIndex: 0,
  playerCount: 0, // Keep track of current player count
};

function initializeGame() {
  gameState.map = initializeMap(); // Initialize map once at server start
}

function startGame(io) {
  // If only one player, declare them winner and reset
  const playerIds = Object.keys(gameState.players);
  if (playerIds.length === 1) {
    const winner = gameState.players[playerIds[0]];
    io.emit('gameStart', gameState); // Optionally show the game started
    io.emit('gameOver', { winner });
    setTimeout(() => resetGame(io), 5000);
    return;
  }

  gameState.gameStarted = true;
  gameState.map = initializeMap(); // Regenerate map for a new game

  // Position players
  let playerIndex = 0;
  Object.keys(gameState.players).forEach(id => {
    const pos = getStartingPosition(playerIndex);
    gameState.players[id].x = pos.x;
    gameState.players[id].y = pos.y;
    gameState.players[id].lives = 3;
    gameState.players[id].bombs = 1; // Reset bomb count
    gameState.players[id].flames = 1; // Reset flame count
    gameState.players[id].speed = 1; // Reset speed
    gameState.players[id].alive = true; // Reset alive status
    playerIndex++;
  });

  io.emit('gameStart', gameState);
  console.log('Game Started!');
}

function resetGame(io) {
  gameState = {
    players: {},
    gameStarted: false,
    waitingTimer: null,
    gameTimer: null,
    waitingTimeCounter: null,
    waitingTime: WAITING_TIME,
    map: initializeMap(), // Re-initialize map on reset
    bombs: [],
    powerups: [],
    nextColorIndex: 0,
    playerCount: 0,
  };
  activeNicknames.clear(); // Clear all active nicknames
  io.emit('gameReset'); // Notify clients of game reset
  console.log('Game Reset!');
}

module.exports = {
  gameState,
  activeNicknames,
  initializeGame,
  startGame,
  resetGame,
  MAX_PLAYERS,
  MIN_PLAYERS,
  WAITING_TIME,
  COUNTDOWN_TIME
};