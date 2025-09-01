const MAP_WIDTH_CELLS = 15;
const MAP_HEIGHT_CELLS = 13;
const CELL_SIZE = 50;

const MAP_WIDTH_PX = MAP_WIDTH_CELLS * CELL_SIZE;
const MAP_HEIGHT_PX = MAP_HEIGHT_CELLS * CELL_SIZE;

const TILE = { EMPTY: 0, BLOCK: 1, WALL: 2 };

function generateMap() {
  const map = Array(MAP_HEIGHT_CELLS).fill(null).map(() => Array(MAP_WIDTH_CELLS).fill(TILE.EMPTY));
  for (let y = 1; y < MAP_HEIGHT_CELLS; y += 2) {
    for (let x = 1; x < MAP_WIDTH_CELLS; x += 2) {
      map[y][x] = TILE.WALL;
    }
  }
  for (let y = 0; y < MAP_HEIGHT_CELLS; y++) {
    for (let x = 0; x < MAP_WIDTH_CELLS; x++) {
      if (map[y][x] === TILE.EMPTY) {
        const isCorner = (y < 2 && x < 2) || (y < 2 && x > MAP_WIDTH_CELLS - 3) ||
                         (y > MAP_HEIGHT_CELLS - 3 && x < 2) || (y > MAP_HEIGHT_CELLS - 3 && x > MAP_WIDTH_CELLS - 3);
        if (!isCorner) {
          map[y][x] = Math.random() < 0.75 ? TILE.BLOCK : TILE.EMPTY;
        }
      }
    }
  }
  return map;
}

function createInitialGameState(players) {
    const map = generateMap();
    const playerSize = 40;
    const initialPositions = [
        { x: 0, y: 0 },
        { x: MAP_WIDTH_PX - playerSize, y: 0 },
        { x: 0, y: MAP_HEIGHT_PX - playerSize },
        { x: MAP_WIDTH_PX - playerSize, y: MAP_HEIGHT_PX - playerSize },
    ];
    const gamePlayers = players.map((p, i) => ({
        id: p.id, nickname: p.nickname, ...initialPositions[i],
        size: playerSize, lives: 3, speed: 2, bombs: 1, flame: 1, isAlive: true,
        movement: { up: false, down: false, left: false, right: false },
    }));
    return { map, players: gamePlayers, bombs: [], explosions: [], powerUps: [], changes: [] };
}

function handlePlayerStartMoving(player, direction) {
    if (player && player.movement.hasOwnProperty(direction)) {
        player.movement[direction] = true;
    }
}

function handlePlayerStopMoving(player, direction) {
    if (player && player.movement.hasOwnProperty(direction)) {
        player.movement[direction] = false;
    }
}

function handlePlaceBomb(player, gameState) {
    const { players, bombs, changes } = gameState;
    const playerState = players.find(p => p.id === player.id);

    if (!playerState || !playerState.isAlive) return;

    const cellX = Math.floor((playerState.x + playerState.size / 2) / CELL_SIZE);
    const cellY = Math.floor((playerState.y + playerState.size / 2) / CELL_SIZE);
    const alreadyHasBomb = bombs.some(b => b.x === cellX && b.y === cellY);

    if (playerState.bombs > bombs.filter(b => b.ownerId === player.id).length && !alreadyHasBomb) {
        const newBomb = {
            ownerId: player.id, x: cellX, y: cellY,
            timer: 3, flame: playerState.flame,
        };
        gameState.bombs.push(newBomb);
        changes.push({ type: 'BOMB_PLACED', payload: newBomb });
    }
}

function handleExplosions(gameState) {
    const { bombs, map, players, explosions, changes } = gameState;
    let explodingBombs = bombs.filter(b => b.timer <= 0);
    if (explodingBombs.length === 0) return;

    const newExplosionCells = new Set();

    // Chain reaction loop
    let newBombsToExplode = true;
    while(newBombsToExplode) {
        newBombsToExplode = false;
        explodingBombs.forEach(bomb => {
            // Create event before adding to explosion cells
            changes.push({ type: 'BOMB_EXPLODED', payload: { x: bomb.x, y: bomb.y } });
            newExplosionCells.add(`${bomb.x},${bomb.y}`);
            const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
            directions.forEach(([dx, dy]) => {
                for (let i = 1; i <= bomb.flame; i++) {
                    const x = bomb.x + dx * i;
                    const y = bomb.y + dy * i;
                    if (x < 0 || x >= MAP_WIDTH_CELLS || y < 0 || y >= MAP_HEIGHT_CELLS) break;
                    const tile = map[y][x];
                    if (tile === TILE.WALL) break;
                    newExplosionCells.add(`${x},${y}`);

                    // Check for chain reaction
                    const otherBombIndex = bombs.findIndex(b => b.x === x && b.y === y && b.timer > 0);
                    if (otherBombIndex !== -1) {
                        bombs[otherBombIndex].timer = 0;
                        newBombsToExplode = true;
                    }

                    if (tile === TILE.BLOCK) {
                        map[y][x] = TILE.EMPTY;
                        changes.push({ type: 'BLOCK_DESTROYED', payload: { x, y } });
                        if (Math.random() < 0.3) {
                            const powerUpTypes = ['flame', 'bombs', 'speed'];
                            const type = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
                            const newPowerUp = { x, y, type };
                            gameState.powerUps.push(newPowerUp);
                            changes.push({ type: 'POWERUP_SPAWNED', payload: newPowerUp });
                        }
                        break;
                    }
                }
            });
        });
        // Update the list of bombs to explode for the next iteration of the while loop
        explodingBombs = bombs.filter(b => b.timer <= 0);
    }


    if (newExplosionCells.size > 0) {
        const explosionData = { cells: Array.from(newExplosionCells).map(s => ({x: parseInt(s.split(',')[0]), y: parseInt(s.split(',')[1])})), timer: 0.5 };
        explosions.push(explosionData);
        changes.push({ type: 'EXPLOSION_STARTED', payload: explosionData });

        players.forEach(player => {
            if (!player.isAlive) return;
            const playerCellX = Math.floor((player.x + player.size / 2) / CELL_SIZE);
            const playerCellY = Math.floor((player.y + player.size / 2) / CELL_SIZE);
            if (newExplosionCells.has(`${playerCellX},${playerCellY}`)) {
                player.lives--;
                changes.push({ type: 'PLAYER_DAMAGED', payload: { id: player.id, lives: player.lives } });
                if (player.lives <= 0) {
                    player.isAlive = false;
                    changes.push({ type: 'PLAYER_DIED', payload: { id: player.id } });
                }
            }
        });
    }

    gameState.bombs = bombs.filter(b => b.timer > 0);
}

function isColliding(x, y, size, map) {
    const points = [
        { x: x, y: y }, { x: x + size - 1, y: y }, { x: x, y: y + size - 1 }, { x: x + size - 1, y: y + size - 1 },
        { x: x + size / 2, y: y }, { x: x + size / 2, y: y + size - 1 }, { x: x, y: y + size / 2 }, { x: x + size - 1, y: y + size / 2 },
    ];
    for (const point of points) {
        const cellX = Math.floor(point.x / CELL_SIZE);
        const cellY = Math.floor(point.y / CELL_SIZE);
        if (cellX < 0 || cellX >= MAP_WIDTH_CELLS || cellY < 0 || cellY >= MAP_HEIGHT_CELLS) return true;
        const tile = map[cellY][cellX];
        if (tile === TILE.WALL || tile === TILE.BLOCK) return true;
    }
    return false;
}

function updatePlayerPosition(player, gameState) {
    if (!player.isAlive) return;
    const { speed, size, movement } = player;
    const { map, changes } = gameState;

    let newX = player.x;
    let newY = player.y;

    if (movement.up) newY -= speed;
    if (movement.down) newY += speed;
    if (movement.left) newX -= speed;
    if (movement.right) newX += speed;

    const originalX = player.x;
    const originalY = player.y;

    if (newX !== originalX) {
        const tempPlayer = { ...player, x: newX, y: player.y };
        if (!isColliding(tempPlayer.x, tempPlayer.y, size, map)) {
            player.x = newX;
        }
    }
    if (newY !== originalY) {
        const tempPlayer2 = { ...player, y: newY };
        if (!isColliding(tempPlayer2.x, tempPlayer2.y, size, map)) {
            player.y = newY;
        }
    }

    if (player.x < 0) player.x = 0;
    if (player.x + size > MAP_WIDTH_PX) player.x = MAP_WIDTH_PX - size;
    if (player.y < 0) player.y = 0;
    if (player.y + size > MAP_HEIGHT_PX) player.y = MAP_HEIGHT_PX - size;

    if (player.x !== originalX || player.y !== originalY) {
        changes.push({ type: 'PLAYER_MOVED', payload: { id: player.id, x: player.x, y: player.y } });
    }

    const playerCellX = Math.floor((player.x + size / 2) / CELL_SIZE);
    const playerCellY = Math.floor((player.y + size / 2) / CELL_SIZE);
    const powerUpIndex = gameState.powerUps.findIndex(p => p.x === playerCellX && p.y === playerCellY);

    if (powerUpIndex !== -1) {
        const powerUp = gameState.powerUps[powerUpIndex];
        changes.push({ type: 'POWERUP_COLLECTED', payload: { x: powerUp.x, y: powerUp.y } });
        switch (powerUp.type) {
            case 'bombs': player.bombs++; break;
            case 'flame': player.flame++; break;
            case 'speed': player.speed += 0.5; break;
        }
        changes.push({ type: 'PLAYER_STATS_CHANGED', payload: { id: player.id, bombs: player.bombs, flame: player.flame, speed: player.speed } });
        gameState.powerUps.splice(powerUpIndex, 1);
    }
}

module.exports = {
  createInitialGameState,
  handlePlayerStartMoving,
  handlePlayerStopMoving,
  updatePlayerPosition,
  handlePlaceBomb,
  handleExplosions,
  TILE,
};