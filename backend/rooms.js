import WebSocket, { WebSocketServer } from "ws";

export default class Room {
  constructor(id) {
    this.id = id;
    this.players = new Map();
    this.started = false;
    this.rewards = {};
    this.countInterval = null;
    this.countP = null;
    this.ChatHistory = [];
  }

  addPlayer(player) {
    this.players.set(player.id, player);
  }
  addchat(nickname, messageText) {
    this.ChatHistory.push({ nickname, messageText });
  }
  removePlayer(playerID) {
    this.players.delete(playerID);
    if (this.started === true) {
      const playersArray = Array.from(this.players.values());
      this.broadcast({
        type: "removePlayer",
        id: playerID,
        players: playersArray,
      });
      for (let player of this.players.values()) {
        player.checkPlayerwin(this, Array.from(this.players));
      }
      if (this.players.size === 1) {        
        this.broadcast({
          type: "theWinnerIs",
          name: this.players.values().next().value.nickname
        });
      } else if (this.players.size === 0) {
        this.ChatHistory = [];
        this.started = false;
      }
    }
  }

  safeStringify(obj) {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) {
          return; // Skip circular reference
        }
        seen.add(value);
      }
      return value;
    });
  }

  broadcast(data) {
    for (const player of this.players.values()) {
      if (player.conn.readyState === WebSocket.OPEN) {
        player.conn.send(this.safeStringify(data));
      }
    }
  }
  getAllPlayerIDs() {
    return [...this.players.keys()];
  }

  setMapData(map, tileSize) {
    this.map = map;
    this.tileSize = tileSize;
  }

  addReward(row, col, index) {
    const powerUpTypes = ["bomb", "speed", "fire"];
    const rewardType = powerUpTypes[index];
    this.rewards[`${row}_${col}`] = rewardType;

    this.broadcast({
      type: "rewardAdded",
      position: {
        row: row,
        col: col
      },
      rewardType: rewardType
    });
  }

  // Remove a reward from the map (when collected)
  removeReward(row, col) {
    delete this.rewards[`${row}_${col}`];
  }
}
