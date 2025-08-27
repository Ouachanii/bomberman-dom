import http from "http";
import { WebSocketServer } from "ws";
import Player from "./player.js";
import Room from "./rooms.js";

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("WebSocket game server is running.");
});

const wss = new WebSocketServer({ server });

let nextRoomID = 1;
const rooms = new Map();
// Store timeouts at room level
const roomTimeouts = new Map();

function findAvailableRoom() {
  for (const room of rooms.values()) {
    if (!room.started && room.players.size < 4) {
      return room;
    }
  }
  const room = new Room(nextRoomID++);
  rooms.set(room.id, room);
  return room;
}

function startRoom(room) {
  // Prevent multiple calls to startRoom for the same room
  if (room.started) {
    console.log(
      `Room ${room.id} is already started, ignoring duplicate start request`
    );
    return;
  }

  room.started = true;
  console.log(`Starting game in room ${room.id}`);

  if (roomTimeouts.has(room.id)) {
    clearTimeout(roomTimeouts.get(room.id));
    roomTimeouts.delete(room.id);
  }

  let map = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 3, 3, 3, 3, 3, 3, 3, 3, 3, 0, 0, 0, 1],
    [1, 0, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 0, 1],
    [1, 0, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 0, 1],
    [1, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    [1, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 1],
    [1, 3, 3, 3, 3, 3, 3, 3, 3,3, 3, 3, 3, 3, 3, 3, 1],
    [1, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 1],
    [1, 0, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 0, 1],
    [1, 0, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 0, 1],
    [1, 0, 0, 0, 3, 3, 3, 3, 3, 3, 3, 3, 3, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  ];

  const positionPlayers = [
    [1, 1], // Player 1
    [15, 15], // Player 2
    [1, 15], // Player 3
    [15, 1], // Player 4
  ];
  const playersArray = Array.from(room.players.values());



  for (let row = 0; row < map.length; row++) {
    for (let col = 0; col < map[row].length; col++) {
      if (map[row][col] === 3) {
        map[row][col] = Math.random() < 0.8 ? 3 : 0
      }
    }
  }
  for (let i = 0; i < playersArray.length; i++) {
    const pos = positionPlayers[i];
    const player = playersArray[i];
    if (pos) {
      const [row, col] = pos;
      map[row][col] = 5 + i;
      player.x = col * 40;
      player.y = row * 40;
    }
  }

  for (const player of playersArray) {
    console.log(`Player ${player.nickname} in room ${room.id}`);
    startGameForPlayer(player, room, playersArray, map);
  }
}

function startGameForPlayer(player, room, playersArray, map) {
  player.conn.send(
    JSON.stringify({
      type: "startGame",
      nickname: player.nickname,
      lives: player.lives,
      players: playersArray,
      MyId: player.id,
      map: map,
    })
  );
  room.setMapData(map, 40);

  player.conn.on("message", (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (err) {
      console.error("Invalid message:", err);
      return;
    }

    if (data.type === "loseLife") {
      player.loseLife(); // Decrease lives
    }
  });

  player.conn.on("close", () => {
    console.log(`Player ${player.nickname} disconnected`);
    room.removePlayer(player.id);
    if (room.players.size === 0) {
      rooms.delete(room.id);
    }
    if (!room.started) {
      room.broadcast({
        type: "updatePlayers",
        playerCount: room.players.size,
        playerId: player.id,
      });
    }
  });
}
wss.on("connection", (ws) => {
  let currentPlayer;
  let currentRoom;

  ws.on("message", (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (err) {
      console.error("Bad message format:", err);
      return;
    }

    switch (data.type) {
      case "newPlayer":
        const id = Date.now() + Math.floor(Math.random() * 1000);
        currentPlayer = new Player(data.nickname, id, ws);
        currentRoom = findAvailableRoom();
        currentRoom.addPlayer(currentPlayer);

        currentRoom.broadcast({
          type: "updatePlayers",
          playerCount: currentRoom.players.size,
        });

        currentPlayer.conn.send(
          JSON.stringify({
            type: "getname",
            nickname: data.nickname
          })
        );

        sendhistorichat(currentRoom, currentPlayer)
        console.log(`Player ${data.nickname} joined Room ${currentRoom.id}`);

        // // Handle game start conditions
        if (
          (currentRoom.players.size == 2 || currentRoom.players.size == 3) &&
          !currentRoom.started
        ) {
        if (!roomTimeouts.has(currentRoom.id)) {
          clearTimeout(roomTimeouts.get(currentRoom.id));
          let timeout = setTimeout(() => {
        startRoom(currentRoom);
         }, 20000);
          roomTimeouts.set(currentRoom.id, timeout);
        }
        /******************************* */
        if (!currentRoom.countInterval) {
          currentRoom.countP = 0;
          currentRoom.countInterval = setInterval(() => {
            currentRoom.countP++;
            currentRoom.broadcast({
              type: "updatePlayers",
              playerCount: currentRoom.players.size,
              countP: currentRoom.countP,
            });
            if (currentRoom.countP >= 20) {
              clearInterval(currentRoom.countInterval);
              currentRoom.countInterval = null;
            }
          }, 1000);
        }
        } else if (currentRoom.players.size == 4 && !currentRoom.started) {
          // Clear existing timeout if any
          if (roomTimeouts.has(currentRoom.id)) {
            clearTimeout(roomTimeouts.get(currentRoom.id));
            roomTimeouts.delete(currentRoom.id);
          }
          // Start immediately
          clearInterval(currentRoom.countInterval);
          currentRoom.countInterval = null;
          startRoom(currentRoom);
        }

        break;
      case "playerMove":
        currentPlayer.Updatemove(data, currentRoom);
        break;
      case "placeBomb":
        currentPlayer.placebomb(currentRoom);
        break;
      case "HitByExplosion":
        currentPlayer.isPlayerHitByExplosion(data, currentRoom);
        break;
      case "chatMsg":
        currentRoom.addchat(currentPlayer.nickname, data.messageText || "");
        currentRoom.broadcast({
          type: "chatMsg",
          nickname: currentPlayer.nickname,
          messageText: data.messageText || "",
        });
        break;
      case "gethistory":
        sendhistorichat(currentRoom, currentPlayer)
        break
      default:
        break
    }
  });

  ws.on("close", () => {
    if (currentRoom && currentPlayer) {
      currentRoom.removePlayer(currentPlayer.id);
      if (currentRoom.players.size === 1) {
        currentRoom.started = false;
        clearTimeout(roomTimeouts.get(currentRoom.id));
        roomTimeouts.delete(currentRoom.id);
        currentRoom.countP = 0;
        clearInterval(currentRoom.countInterval);
        currentRoom.countInterval = null;
      }
      currentRoom.broadcast({
        type: "updatePlayers",
        playerCount: currentRoom.players.size,
      });
    }
  });
});


function sendhistorichat(room, player) {
  if (room.ChatHistory.length > 0) {
    for (const msg of room.ChatHistory) {
      player.conn.send(
        JSON.stringify({
          type: "chatMsg",
          nickname: msg.nickname,
          messageText: msg.messageText,
        })
      )
    }
  }
}

// Start server
server.listen(8080, () => {
  console.log("Server is running at http://localhost:8080");
});
