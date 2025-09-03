// player-utils.js

function applyPowerup(player, type) {
  switch (type) {
    case 'bombs':
      player.bombs++;
      break;
    case 'flames':
      player.flames++;
      break;
    case 'speed':
      player.speed = Math.min(player.speed + 0.5, 3); // Max speed limit
      break;
  }
}

function broadcastPlayersUpdate(io, players) {
  io.emit('playersUpdate', { players });
}

module.exports = {
  applyPowerup,
  broadcastPlayersUpdate
};