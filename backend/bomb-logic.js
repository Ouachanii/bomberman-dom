// bomb-logic.js
const { applyPowerup, broadcastPlayersUpdate } = require('./player-utils'); // For applying powerups and updating player state

function explodeBomb(io, bomb, gameState, resetGame) {
  gameState.bombs = gameState.bombs.filter(b => b.id !== bomb.id);

  const player = gameState.players[bomb.playerId];
  if (player) {
    player.bombs++; // Return bomb to player

    // Emit updated player stats
    io.emit('playerStatsUpdate', {
      playerId: bomb.playerId,
      stats: {
        bombs: player.bombs,
        flames: player.flames,
        speed: player.speed,
        lives: player.lives
      }
    });
  }

  const explosions = [];
  const directions = [
    [0, 0], // Center
    [0, -1], [0, 1], // Up, Down
    [-1, 0], [1, 0]  // Left, Right
  ];

  directions.forEach(([dx, dy]) => {
    // Determine flame range (default to 1 if player somehow doesn't exist or flames property is missing)
    const flameRange = (player && player.flames !== undefined) ? player.flames : 1;
    for (let i = 0; i <= flameRange; i++) {
      const x = bomb.x + dx * i;
      const y = bomb.y + dy * i;

      if (x < 0 || x >= 15 || y < 0 || y >= 13) break; // Out of bounds
      if (gameState.map[y][x] === 'wall') {
        explosions.push({ x, y }); // Show explosion on wall, but stop propagation
        break;
      }

      explosions.push({ x, y });

      // Destroy blocks and maybe spawn powerup
      if (gameState.map[y][x] === 'block') {
        console.log('Block destroyed at:', x, y);

        gameState.map[y][x] = 'empty';
        if (Math.random() < 0.3) { // 30% chance to spawn powerup
          const powerupTypes = ['bombs', 'flames', 'speed'];
          const powerup = {
            x, y,
            type: powerupTypes[Math.floor(Math.random() * powerupTypes.length)]
          };
          gameState.powerups.push(powerup);
          gameState.map[y][x] = 'powerup';
        }
        break; // Stop explosion propagation through blocks
      }
    }
  });

  // Check player damage
  const damagedPlayers = [];
  Object.keys(gameState.players).forEach(playerId => {
    const p = gameState.players[playerId];
    // Player is alive and is within an explosion tile
    if (p.alive && explosions.some(exp => exp.x === p.x && exp.y === p.y)) {
      p.lives--;
      damagedPlayers.push({
        playerId,
        lives: p.lives,
        alive: p.lives > 0
      });

      if (p.lives <= 0) {
        p.alive = false;
        io.emit('playerDied', { playerId });
        broadcastPlayersUpdate(io, gameState.players);
      }

      // Emit real-time life update immediately
      io.emit('playerStatsUpdate', {
        playerId,
        stats: {
          bombs: p.bombs,
          flames: p.flames,
          speed: p.speed,
          lives: p.lives
        }
      });
    }
  });

  io.emit('bombExploded', {
    bombId: bomb.id,
    explosions,
    damagedPlayers
  });

  io.emit('mapUpdate', { map: gameState.map });

  // Send updated game state to ensure powerups are synced
  io.emit('gameStateUpdate', {
    players: gameState.players,
    powerups: gameState.powerups,
    map: gameState.map
  });

  // Check win condition
  const alivePlayers = Object.values(gameState.players).filter(p => p.alive);
  if (alivePlayers.length <= 1) {
    io.emit('gameOver', { winner: alivePlayers[0] || null });
    setTimeout(() => resetGame(io), 5000);
  }
}

module.exports = {
  explodeBomb
};