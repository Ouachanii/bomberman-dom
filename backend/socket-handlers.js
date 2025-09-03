// socket-handlers.js
const {
  MAX_PLAYERS, MIN_PLAYERS, WAITING_TIME, COUNTDOWN_TIME,
  startGame, resetGame
} = require('./game-state');
const { applyPowerup, broadcastPlayersUpdate } = require('./player-utils');
const { explodeBomb } = require('./bomb-logic');


function setupSocketHandlers(io, gameState, activeNicknames, resetGameCallback) {

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Helper to call resetGame from game-state.js with the `io` instance
    const resetGameWithIo = () => resetGameCallback(io);

    socket.on('joinGame', (nickname) => {
      // Prevent joining if game started or during 10s countdown
      if (gameState.playerCount >= MAX_PLAYERS) {
        socket.emit('joinError', 'Game is full');
        socket.disconnect(true); // Disconnect the client immediately
        return;
      }
      if (gameState.gameStarted || gameState.gameTimer) {
        socket.emit('joinError', 'Game already started or in countdown');
        socket.disconnect(true);
        return;
      }
      // Check if nickname is already in use
      if (activeNicknames.has(nickname)) {
        socket.emit('joinError', 'Nickname is already taken');
        socket.disconnect(true);
        return;
      }

      gameState.playerCount++;
      gameState.players[socket.id] = {
        id: socket.id,
        nickname: nickname,
        x: 0, // Will be set by startGame
        y: 0, // Will be set by startGame
        lives: 3,
        bombs: 1,
        flames: 1,
        speed: 1,
        alive: true,
        colorIndex: gameState.nextColorIndex
      };

      gameState.nextColorIndex = (gameState.nextColorIndex + 1) % MAX_PLAYERS;

      // Add nickname to active nicknames set
      activeNicknames.add(nickname);

      socket.emit('joined', { playerId: socket.id, playerCount: gameState.playerCount });
      io.emit('playerJoined', {
        playerCount: gameState.playerCount,
        players: gameState.players,
        waitingTime: gameState.waitingTime
      });
      console.log(`${nickname} joined. Current players: ${gameState.playerCount}`);

      // Start waiting time counter if we have min players and it's not already running
      if (gameState.playerCount >= MIN_PLAYERS && !gameState.waitingTimeCounter && !gameState.gameStarted && !gameState.gameTimer) {
        gameState.waitingTime = WAITING_TIME; // Reset to initial waiting time
        io.emit('updateWaitingTime', { waitingTime: gameState.waitingTime });
        console.log(`Starting waiting timer for ${WAITING_TIME} seconds.`);

        gameState.waitingTimeCounter = setInterval(() => {
          gameState.waitingTime--;
          io.emit('updateWaitingTime', { waitingTime: gameState.waitingTime });

          // When waiting time ends, start the game countdown
          if (gameState.waitingTime <= 0) {
            clearInterval(gameState.waitingTimeCounter);
            gameState.waitingTimeCounter = null;
            io.emit('countdown', { time: 10 });
            console.log('Waiting time ended, starting 10-second countdown...');
            gameState.gameTimer = setTimeout(() => {
              startGame(io); // Pass io instance
              gameState.gameTimer = null;
            }, COUNTDOWN_TIME);
          }
        }, 1000);
      }

      // If MAX_PLAYERS joins during waiting, immediately start 10s countdown
      if (gameState.playerCount === MAX_PLAYERS && !gameState.gameStarted) {
        if (gameState.waitingTimeCounter) {
          clearInterval(gameState.waitingTimeCounter);
          gameState.waitingTimeCounter = null;
          console.log('Max players reached, stopping waiting timer.');
        }
        if (!gameState.gameTimer) { // Only start countdown if not already running
          io.emit('countdown', { time: 10 });
          console.log('Max players reached, starting 10-second countdown...');
          gameState.gameTimer = setTimeout(() => {
            startGame(io); // Pass io instance
            gameState.gameTimer = null;
          }, COUNTDOWN_TIME);
        }
      }
    });

    socket.on('playerMove', (data) => {
      if (!gameState.gameStarted || !gameState.players[socket.id] || !gameState.players[socket.id].alive) return;

      const player = gameState.players[socket.id];
      const { direction } = data;
      let { x, y } = player;

      // Validate direction input to prevent arbitrary client-side movement
      if (!['up', 'down', 'left', 'right'].includes(direction)) {
        console.warn(`Invalid move direction received from ${socket.id}: ${direction}`);
        return;
      }

      let newX = x, newY = y;
      switch (direction) {
        case 'up': newY -= 1; break;
        case 'down': newY += 1; break;
        case 'left': newX -= 1; break;
        case 'right': newX += 1; break;
      }

      // Check bounds and collisions
      if (newX >= 0 && newX < 15 && newY >= 0 && newY < 13 &&
        (gameState.map[newY][newX] === 'empty' || gameState.map[newY][newX] === 'powerup')) {

        // Check powerup pickup
        if (gameState.map[newY][newX] === 'powerup') {
          const powerup = gameState.powerups.find(p => p.x === newX && p.y === newY);
          if (powerup) {
            applyPowerup(player, powerup.type);
            gameState.powerups = gameState.powerups.filter(p => !(p.x === newX && p.y === newY));
            gameState.map[newY][newX] = 'empty';

            io.emit('powerupCollected', {
              playerId: socket.id,
              powerupType: powerup.type,
              x: newX,
              y: newY
            });

            // Emit updated player stats
            io.emit('playerStatsUpdate', {
              playerId: socket.id,
              stats: {
                bombs: player.bombs,
                flames: player.flames,
                speed: player.speed,
                lives: player.lives
              }
            });

            // Send updated game state to all players
            io.emit('gameStateUpdate', {
              players: gameState.players,
              powerups: gameState.powerups,
              map: gameState.map
            });
          }
        }

        player.x = newX;
        player.y = newY;
        io.emit('playerMoved', { playerId: socket.id, x: newX, y: newY });
      }
    });

    socket.on('placeBomb', () => {
      if (!gameState.gameStarted || !gameState.players[socket.id] || !gameState.players[socket.id].alive) return;

      const player = gameState.players[socket.id];
      const existingBomb = gameState.bombs.find(b => b.x === player.x && b.y === player.y);

      if (!existingBomb && player.bombs > 0) {
        const bomb = {
          id: Date.now(),
          x: player.x,
          y: player.y,
          playerId: socket.id,
          timer: 3000 // 3 seconds
        };

        gameState.bombs.push(bomb);
        player.bombs--;

        io.emit('bombPlaced', bomb);

        // Emit updated player stats immediately when bomb is placed
        io.emit('playerStatsUpdate', {
          playerId: socket.id,
          stats: {
            bombs: player.bombs,
            flames: player.flames,
            speed: player.speed,
            lives: player.lives
          }
        });

        setTimeout(() => {
          explodeBomb(io, bomb, gameState, resetGameWithIo); // Pass io and gameState
        }, bomb.timer);
      }
    });

    socket.on('chatMessage', (message) => {
      // Basic message validation
      if (typeof message !== 'string' || message.trim().length === 0) {
        console.warn(`Invalid chat message received from ${socket.id}`);
        return;
      }
      if (gameState.players[socket.id]) {
        io.emit('chatMessage', {
          nickname: gameState.players[socket.id].nickname,
          message: message.substring(0, 200), // Truncate long messages
          timestamp: Date.now()
        });
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);

      const disconnectedPlayer = gameState.players[socket.id];

      if (disconnectedPlayer) {
        // Remove nickname from active nicknames
        activeNicknames.delete(disconnectedPlayer.nickname);

        // If game is started, just mark as dead
        if (gameState.gameStarted) {
          disconnectedPlayer.alive = false;
          broadcastPlayersUpdate(io, gameState.players);
        } else {
          // Only remove from players if game hasn't started or is waiting
          delete gameState.players[socket.id];
          gameState.playerCount--;
          console.log(`${disconnectedPlayer.nickname} left. Current players: ${gameState.playerCount}`);
        }

        // Win condition check (relevant if game is ongoing)
        if (gameState.gameStarted) {
          const alivePlayers = Object.values(gameState.players).filter(p => p.alive);
          if (alivePlayers.length === 1) {
            io.emit('gameOver', { winner: alivePlayers[0] });
            console.log(`Game Over! Winner: ${alivePlayers[0].nickname}`);
            setTimeout(resetGameWithIo, 5000); // Call reset with io
            return;
          }
          if (alivePlayers.length === 0) { // All players disconnected or died
            io.emit('gameOver', { winner: null, message: 'All players disconnected or died!' });
            console.log('Game Over! No winner (all players left/died).');
            setTimeout(resetGameWithIo, 5000); // Call reset with io
            return;
          }
        }

        // Waiting logic if game hasn't started
        if (!gameState.gameStarted) {
          // Clear waiting time counter if less than MIN_PLAYERS
          if (gameState.playerCount < MIN_PLAYERS && gameState.waitingTimeCounter) {
            clearInterval(gameState.waitingTimeCounter);
            gameState.waitingTimeCounter = null;
            gameState.waitingTime = WAITING_TIME; // Reset waiting time
            io.emit('updateWaitingTime', { waitingTime: gameState.waitingTime });
            console.log('Player count dropped below minimum, waiting timer stopped.');
          }
          // If no players left, reset the entire game
          if (gameState.playerCount === 0) {
            console.log('All players disconnected, resetting game.');
            resetGameWithIo(); // Call reset with io
          } else {
            // Notify remaining players about the player who left
            io.emit('playerLeft', {
              playerCount: gameState.playerCount,
              players: gameState.players,
              waitingTime: gameState.waitingTime
            });
          }
        }
      }
    });
  });
}

module.exports = setupSocketHandlers;