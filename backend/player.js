
export default class Player {
  constructor(nickname, id, conn) {
    this.x = 0;
    this.y = 0;
    this.nickname = nickname;
    this.id = id;
    this.conn = conn;
    this.positionX = 52;
    this.positionY = 0;
    this.width = 21;
    this.height = 40;
    this.lives = 3;
    this.fire = 1;
    this.isMoving = false;
    this.isDead = false;
    this.direction = "up";
    this.movementStartTime = null;
    this.bombes = 0;

    this.setTimeoutbomb = null;
    this.setTimeoutspeed = null;
    this.setTimeoutfire = null;
    this.overlappingBombs = new Set();
    this.userPx = 5

    this.powerUps = {
      bombs: {
        level: 1,
        maxLevel: 5,
        baseValue: 1,
        cooldown: 3000,
        numBomb: 1,
      },
      flames: {
        level: 1,
        maxLevel: 4,
        baseValue: 1
      },
      speed: {
        level: 1,
        maxLevel: 5,
        baseValue: 25
      }
    };
  }

  loseLife() {
    if (!this.isAlive()) { return }
    this.lives -= 1;
  }

  isAlive() {
    return this.lives > 0;
  }

  Updatemove(data, room) {
    if (!this.isAlive()) {
      return;
    }
    let movementStartTime = null;
    const deltaTime = data.deltaTime;

    const moveSpeed = this.powerUps.speed.baseValue * (8000 / 60 / 1000); // Convert to pixels per second

    const prevX = this.x;
    const prevY = this.y;

    switch (data.direction) {
      case "up":
        this.y -= moveSpeed;
        this.direction = "up";
        this.isMoving = true;
        break;
      case "down":
        this.y += moveSpeed;
        this.direction = "down";
        this.isMoving = true;
        break;
      case "left":
        this.x -= moveSpeed;
        this.direction = "left";
        this.isMoving = true;
        break;
      case "right":
        this.x += moveSpeed;
        this.direction = "right";
        this.isMoving = true;
        break;
      default:
        break;
    }

    const spriteMap = { // Sprite positions for each direction
      up: [
        { x: 55, y: 82 },
        { x: 28, y: 82 },
        { x: 55, y: 82 },
        { x: 81, y: 82 },
      ],
      right: [
        { x: 30, y: 41 },
        { x: 55, y: 41 },
        { x: 30, y: 41 },
        { x: -5, y: 41 },
      ],
      down: [
        { x: 52, y: 0 },
        { x: 27, y: 0 },
        { x: 52, y: 0 },
        { x: 78, y: 0 },
      ],
      left: [
        { x: -5, y: 124 },
        { x: 30, y: 124 },
        { x: -5, y: 124 },
        { x: 82, y: 124 },
      ],
    };

    if (this.#checkCollision(room)) { // Check for collision with walls or blocks
      this.x = prevX;
      this.y = prevY;
    } else {
      this.#checkRewardCollection(room); // Check for reward collection
      this.#updateBombOverlap(room);// Update bomb overlap status
    }

    if (this.isMoving) {
      let currentSprite = spriteMap[this.direction];

      if (!this.movementStartTime) this.movementStartTime = Date.now();
      let elapsed = Date.now() - this.movementStartTime;
      let frameDuration = 200;
      let frameIndex =
        Math.floor(elapsed / frameDuration) % currentSprite.length;
      this.positionX = currentSprite[frameIndex].x;
      this.positionY = currentSprite[frameIndex].y;

      let Data = {
        type: "playerMove",
        position: {
          x: this.x,
          y: this.y,
          spriteX: this.positionX,
          spriteY: this.positionY,
          direction: this.direction,
        },
        Id: this.id,
        element: this.playerElement,
      };

      room.broadcast(Data);
      this.isMoving = false;
    } else {
      if (movementStartTime) {
        const frames = spriteMap[this.direction];
        if (frames) {
          this.positionX = frames[0].x;
          this.positionY = frames[0].y;
        }
        movementStartTime = null;
        this.isMoving = false;
        this.movementStartTime = null;
      }
    }
  }

  #checkCollision(room) {
    const playerLeft = this.x;
    const playerTop = this.y;
    const playerRight = this.x + this.width;
    const playerBottom = this.y + this.height;

    const playerCenterX = this.x + this.width / 2;
    const playerCenterY = this.y + this.height / 2;

    const playerTileX = Math.floor(playerCenterX / room.tileSize);
    const playerTileY = Math.floor(playerCenterY / room.tileSize);

    for (let y = playerTileY - 1; y <= playerTileY + 1; y++) {
      for (let x = playerTileX - 1; x <= playerTileX + 1; x++) {
        if (y >= 0 && y < room.map.length && x >= 0 && x < room.map[0].length) {
          const tileType = room.map[y][x];

          if (
            tileType === 1 ||
            tileType === 2 ||
            tileType === 3 ||
            tileType === 4 && !this.overlappingBombs.has(`${y}_${x}`)
          ) {
            const tileLeft = x * room.tileSize;
            const tileTop = y * room.tileSize;
            const tileRight = tileLeft + room.tileSize;
            const tileBottom = tileTop + room.tileSize;

            if (
              playerLeft < tileRight - 6 &&
              playerRight > tileLeft - 4 &&
              playerTop < tileBottom - 16 &&
              playerBottom > tileTop
            ) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  #updateBombOverlap(room) {
    const playerCenterX = this.x + this.width / 2;
    const playerCenterY = this.y + this.height / 2;

    const playerTileX = Math.floor(playerCenterX / room.tileSize);
    const playerTileY = Math.floor(playerCenterY / room.tileSize);

    const tileKey = `${playerTileY}_${playerTileX}`;


    const toRemove = [];
    for (const bombKey of this.overlappingBombs) {
      const [bombRow, bombCol] = bombKey.split("_").map(Number);
      const bombTileLeft = bombCol * room.tileSize;
      const bombTileTop = bombRow * room.tileSize;
      const bombTileRight = bombTileLeft + room.tileSize;
      const bombTileBottom = bombTileTop + room.tileSize;

      const outside =
        this.x + this.width < bombTileLeft ||
        this.x > bombTileRight - 6 ||
        this.y + this.height < bombTileTop ||
        this.y > bombTileBottom - 16;

      if (outside) {
        toRemove.push(bombKey);
      }
    }

    for (const key of toRemove) {
      console.log(`Removing bomb overlap: ${key}`);
      this.overlappingBombs.delete(key);
    }

    const mapValid =
      playerTileY >= 0 &&
      playerTileY < room.map.length &&
      playerTileX >= 0 &&
      playerTileX < room.map[0].length;

    if (mapValid) {
      const tileValue = room.map[playerTileY][playerTileX];

      if (tileValue === 4) {
        this.overlappingBombs.add(tileKey);
      }
    }
  }

  placebomb(room) {

    const row = Math.floor((this.y + 20) / room.tileSize);
    const col = Math.floor((this.x + 20) / room.tileSize);
    if (this.powerUps.bombs.numBomb <= this.bombes) {
      return;
    }
    if (room.map[row][col] == 4) {
      return
    }

    if (!this.isAlive()) {
      return;
    }
    this.bombes++;
    setTimeout(() => {
      this.bombes--;
    }, 3000);


    const frames = [
      { x: -5, y: 0 }, // Frame 1
      { x: -40, y: 0 }, // Frame 2
      { x: -75, y: 0 }, // Frame 3
      { x: -112, y: 0 }, // Frame 4
      { x: -146, y: 0 }, // Frame 5
      { x: -75, y: 36 }, // Frame 6
      { x: -112, y: 36 }, // Frame 7
      { x: -146, y: 36 }, // Frame 8
    ];

    this.overlappingBombs.add(`${row}_${col}`);

    this.#drawBomb(row, col, room);

    setTimeout(() => {
      this.#removeBomb(row, col, room);
      this.#destroyWall(row, col, frames, room);

      this.overlappingBombs.delete(`${row}_${col}`);
    }, 3000);
  }



  #drawBomb(row, col, room) {
    room.map[row][col] = 4;
    room.broadcast({
      type: "drawBomb",
      position: {
        row: row,
        col: col,
      },
    });
  }

  #removeBomb(row, col, room) {
    room.map[row][col] = 0;
    room.broadcast({
      type: "removeBomb",
      position: {
        row: row,
        col: col,
      },
    });
  }

  #destroyWall(row, col, frames, room) {
    room.broadcast({
      type: "drawExplosion",
      position: {
        row: row,
        col: col,
      },
      frames: frames,
    });
    room.broadcast({
      type: "HitByExplosion",
      row: row,
      col: col,
    });

    // Propager l'explosion dans chaque direction
    const directionsMap = {
      up: { dr: -1, dc: 0 },
      right: { dr: 0, dc: 1 },
      down: { dr: 1, dc: 0 },
      left: { dr: 0, dc: -1 }
    };
    Object.entries(directionsMap).forEach(([_, { dr, dc }]) => {
      const flameRange = this.powerUps.flames.baseValue;

      for (let range = 1; range <= flameRange; range++) {
        const newRow = row + (dr * range);
        const newCol = col + (dc * range);

        if (newRow < 0 || newRow >= room.map.length ||
          newCol < 0 || newCol >= room.map[0].length) {
          break;
        }

        const tileValue = room.map[newRow][newCol];

        if (tileValue === 1 || tileValue === 4) {
          break;
        }

        room.broadcast({
          type: "HitByExplosion",
          row: newRow,
          col: newCol,
        });

        if (tileValue === 3) {
          const gift = Math.random() < 0.2;
          const index = Math.floor(Math.random() * 3);

          room.map[newRow][newCol] = 0;
          room.broadcast({
            type: "destroyWall",
            position: {
              row: newRow,
              col: newCol,
            },
            gift: gift,
            index: index,
            frames: frames,
          });

          if (gift) {
            room.addReward(newRow, newCol, index);
          }

          // break; // Arrêter la propagation après avoir détruit un mur
        }

        if (tileValue === 0 || tileValue === 5 || tileValue === 6 ||
          tileValue === 7 || tileValue === 8) {
          room.broadcast({
            type: "drawExplosion",
            position: {
              row: newRow,
              col: newCol,
            },
            frames: frames,
          });
        }
      }
    });
  }
  isPlayerHitByExplosion(data, room) {
    const playerCenterX = this.x + this.width / 2;
    const playerCenterY = this.y + this.height / 2;

    const playerTileRow = Math.floor(playerCenterY / room.tileSize);
    const playerTileCol = Math.floor(playerCenterX / room.tileSize);

    if (data.row === playerTileRow && data.col === playerTileCol) {
      const playersArray = Array.from(room.players.values());

      this.loseLife();
      this.conn.send(
        JSON.stringify({
          type: "hearts",
          Id: this.id,
          hearts: this.lives,
        })
      );
      room.broadcast({
        type: "brodcastplayerinfo",
        players: playersArray
      })

      this.checkPlayerwin(room, Array.from(room.players))

      if (!this.isAlive()) {
        this.isDead = true;
        room.broadcast({
          type: "playerDead",
          Id: this.id,
        });
      }
    }
  }

  checkPlayerwin(room, players) {
    let alivePlayers = [];

    for (let index = 0; index < players.length; index++) {
      const player = players[index][1]; // Get the Player object
      if (player.lives > 0) {
        alivePlayers.push(player);
      }
    }

    if (alivePlayers.length === 1) {
      room.started = false
      room.broadcast({
        type: "theWinnerIs",
        name: alivePlayers[0].nickname
      });
    } else if (alivePlayers.length === 0) {
      console.log("No players alive. It's a draw!");
    }
  }

  #checkRewardCollection(room) {
    const playerCenterX = this.x + this.width / 2;
    const playerCenterY = this.y + this.height / 2;

    const playerTileX = Math.floor(playerCenterX / room.tileSize);
    const playerTileY = Math.floor(playerCenterY / room.tileSize);

    if (room.rewards && room.rewards[`${playerTileY}_${playerTileX}`]) {
      const rewardType = room.rewards[`${playerTileY}_${playerTileX}`];
      this.collectReward(rewardType);

      room.broadcast({
        type: "rewardCollected",
        position: {
          row: playerTileY,
          col: playerTileX,
        },
        playerId: this.id,
        rewardType: rewardType,
      });

      // Remove the reward from the map
      delete room.rewards[`${playerTileY}_${playerTileX}`];
    }
  }

  collectReward(rewardType) {
    const rewardMap = {
      "bomb": "bombs",
      "speed": "speed",
      "fire": "flames"
    };

    const powerUpType = rewardMap[rewardType];
    if (!powerUpType) {
      console.warn(`Unknown reward type: ${rewardType}`);
      return;
    }

    if (this.powerUps[powerUpType].level < this.powerUps[powerUpType].maxLevel) {
      this.powerUps[powerUpType].level++;
      this.updateDerivedStats(powerUpType);
    }

    this.sendPlayerStatsUpdate();
  }

  updateDerivedStats(powerUpType) {
    if (powerUpType === "bombs") {
      this.powerUps.bombs.numBomb += 1;
    } else if (powerUpType === "speed") {
      this.powerUps.speed.baseValue += 5;
    } else if (powerUpType === "flames") {
      this.powerUps.flames.baseValue += 1;
    }
  }

  sendPlayerStatsUpdate() {
    this.conn.send(
      JSON.stringify({
        type: "playerStatsUpdate",
        bombPower: this.powerUps.bombs.level,
        speed: this.powerUps.speed.level,
        fire: this.powerUps.flames.level,
      })
    );
  }
}