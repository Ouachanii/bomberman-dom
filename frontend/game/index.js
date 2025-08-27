import { LoginPage, GamePage, Ref } from "../app/config.js";
import { Router } from "../mini-framework/router.js";
import { useRoute, onRouteChange, initRouter } from "../mini-framework/router.js";
import { jsx, renderApp } from "../mini-framework/render.js";
import { updatePlayerCount, addMessage, setNickname, startGameCountdown, initializeStore, getGameState, updateGameState } from "../app/store.js";
import TileMap from "./tileMap.js";
import { playersElement } from "./tileMap.js";

// Create app container
const appContainer = document.createElement('div');
appContainer.id = 'app';
document.body.appendChild(appContainer);

const router = new Router({
  "/": () => {
    // Initialize store and render login page
    initializeStore(appContainer, LoginPage);
    renderApp(() => LoginPage(), appContainer);
  },
  "/game": () => {
    initializeStore(appContainer, GamePage);
    renderApp(() => GamePage(), appContainer);
  }
});

router.init();



export function waiting() {
  const waitingContent = jsx(
    "div",
    null,
    jsx("p", { id: "playercount" }, `Players: ${gameState.playerCount}/4`),
    jsx(
      "div",
      { className: "waiting-animation" },
      jsx("img", {
        src: "../images/bomberman3d.gif",
        alt: "Waiting...",
        style: "margin-top: 10px;"
      }),
      jsx("p", null, "Looking for a match...")
    )
  );

  render(waitingContent, Ref.loginRef.current);
}

export let socket;
export function connectToGameServer(name) {
  const host = window.location.hostname;
  socket = new WebSocket(`ws://${host}:8080`);
  socket.onopen = () => {
    console.log("Connected to WebSocket server");
    updateGameState({
      waitingContent: { showAnimation: true },
      progressText: 'Looking for a match...',
      name: name
    });
    socket.send(
      JSON.stringify({
        type: "newPlayer",
        nickname: name,
      })
    );
  };
  socket.onmessage = (message) => {
    const data = JSON.parse(message.data);
    // console.log(data);
    handleServerMessages(data);
  };

  socket.onclose = () => {
    console.log("Disconnected from WebSocket server");
  };
}
let tileMap;
function handleServerMessages(data) {
  const tileSize = 40;
  if (data.type == "startGame") {
    tileMap = new TileMap(tileSize, data);
  }
  
  switch (data.type) {
    case "updatePlayers":
      updateGameState({
        playerCount: data.playerCount,
        playerId: data.playerId,
        countP: data.countP,
        progressText: `Players: ${data.playerCount}/4`
      });
      break;
    case "getname":
      updateGameState({
        username: data.nickname
      });
      break;
    case "startGame":
      // Navigate to game route before starting countdown
      router.navigate("/game");
      updateGameState({
        waitingContent: null,
        progressText: 'Starting game...',
        gameStarted: true
      });
      startGameCountdown();
      break;
    case "chatMsg":
      addMessage(data);
      break;
    case "playerMove":
      updateOtherPlayerPosition(data);
      break;
    case "drawBomb":
      drawBomb(data.position.row, data.position.col);
      break;
    case "removeBomb":
      removeBomb(data.position.row, data.position.col);
      break;
    case "destroyWall":
      destroyWall(
        data.position.row,
        data.position.col,
        data.gift,
        data.index,
        data.frames
      );
      break;
    case "drawExplosion":
      drawExplosion(data.position.row, data.position.col, data.frames);
      break;
    case "HitByExplosion":
      socket.send(JSON.stringify(data));
      break;
    case "playerDead":
      animationPlayerDead(data);
      break;
    case "hearts":
      hearts(data);
      break;
    case "rewardCollected":
      rewardCollected(data);
      break;
    case "playerStatsUpdate":
      updatePlayerStats(data);
      notificationPower(data);
      break;
    case "brodcastplayerinfo":
      broadcastPlayerInfo(data);
      break;
    case "theWinnerIs":
      theWinnerIs(data);
      socket.close();
      OfflinePlayer = null;
      break;
    case "removePlayer":
      console.log("Player removed:", data.id);
      removePlayer(data.id);
      broadcastPlayerInfo(data);
      break;
    default:
      break;
  }
}

export let OfflinePlayer = [];

function removePlayer(id) {
  const playerElement = playersElement.get(id);
  if (playerElement) {
    playerElement.remove();
    playersElement.delete(id);
  } else {
    if (!OfflinePlayer?.includes(id)) {
      OfflinePlayer.push(id)
    }
  }
}
export function theWinnerIs(data) {
  let gamepage = Ref.gamePageRef.current;
  const winScreen = jsx(
    "div",
    { id: "popup-msg", className: "popup", ref: Ref.popupRef },
    jsx("h2", {}, `🎉 The winner is: ${data.name} 🎉`),
    jsx(
      "button",
      {
        className: "play-again-btn",
        onclick: (e) => {
          gameState.name = "";
          e.preventDefault();
          router.navigate("/");
        },
      },
      "Play Again"
    )
  );
  render(winScreen, gamepage);
  
}

function notificationPower(data) {
  let notificationsEle = Ref.notificationsRef.current;
  if (!notificationsEle) return;

  // let notification = jsx("div", { className: "power-notification"})

  if (data.bombPower) {
    notificationsEle.innerHTML = "💣 Bomb Power increased!";
    notificationsEle.style.borderLeft = "4px solid #ff6b6b";
  } else if (data.speed) {
    notificationsEle.innerHTML = "⚡ Speed boost activated!";
    notificationsEle.style.borderLeft = "4px solid #4ecdc4";
  } else if (data.fire) {
    notificationsEle.innerHTML = "🔥 Fire Range increased!";
    notificationsEle.style.borderLeft = "4px solid #ffa502";
  } else {
    return;
  }

  setTimeout(() => {
    notificationsEle.innerHTML = "";
  }, 3000);
}

function updatePlayerStats(data) {
  const status = Ref.StatusRef.current;
  const statsNode = jsx(
    "div",
    { className: "stella-status" },
    jsx(
      "h3",
      { style: "color:rgb(0, 0, 0); margin-bottom: 8px;" },
      "✨ Stella's Power Stats ✨"
    ),
    jsx(
      "div",
      { style: "list-style: none; padding: 0; margin: 0;" },
      jsx("p", {}, `💣 Bomb Power: ${data.bombPower}`),
      jsx("p", {}, `⚡ Speed: ${data.speed}`),
      jsx("p", {}, `🔥 Fire Range: ${data.fire}`)
    )
  );
  updateRender(statsNode, status);
}

function rewardCollected(data) {
  const canvas = Ref.gameCanvasRef.current;
  const tileElement = Selectbyrowcol(
    canvas,
    data.position.row,
    data.position.col
  );
  if (tileElement) {
    tileElement.innerHTML = "";
  }
}

function hearts(data) {
  const hearts = Ref.hearts.current;
  if (hearts.lastElementChild) {
    hearts.lastElementChild.remove();
  }

}

function animationPlayerDead(data) {
  let playerElement = playersElement.get(data.Id);
  playerElement.style.backgroundImage = `url('../images/player_dead.png')`;

  if (!playerElement) {
    return;
  }

  const deathFrames = [
    { x: -17, y: 1 }, // Frame 1
    { x: -55, y: 1 }, // Frame 2
    { x: -91, y: 1 }, // Frame 3
    { x: -126, y: 1 }, // Frame 4
    { x: -162, y: 1 }, // Frame 5
    { x: -198, y: 1 }, // Frame 6
    { x: -235, y: 1 }, // Frame 7
  ];

  let currentFrame = 0;
  const frameDuration = 100;

  const animateDeath = () => {
    if (currentFrame >= deathFrames.length) {
      playerElement.remove();
      return;
    }

    playerElement.style.backgroundPositionX = `${deathFrames[currentFrame].x}px`;
    playerElement.style.backgroundPositionY = `${deathFrames[currentFrame].y}px`;
    currentFrame++;

    setTimeout(animateDeath, frameDuration);
  };

  animateDeath();
}

function updateOtherPlayerPosition(data) {
  let playerElement = playersElement.get(data.Id);
  if (!playerElement) {
    console.log("player not found", data.Id);
    return;
  }
  playerElement.style.backgroundPositionY = data.position.spriteY + "px";
  playerElement.style.backgroundPositionX = data.position.spriteX + "px";
  playerElement.style.transform = `translate(${data.position.x}px, ${data.position.y}px)`;
}

function updateCountDisplay(count, playerId, countP) {
  // Calculate the progress text based on countP
  const progressText = countP === null ? "Game..." : 
                      countP < 20 ? `Game starting soon... ${countP}s` : 
                      "Game starting soon...";
  
  // Update the global state with all necessary information
  updateGameState({
    playerCount: count,
    playerId: playerId,
    countP: countP,
    progressText: progressText,
    waitingContent: {
      playerCount: count,
      showAnimation: true
    }
  });
  
  // Re-render the current view - this will use the updated state
  renderApp(() => LoginPage(), appContainer);

}
function startGame(data, tileMap) {
  let count = 10;
  const interval = setInterval(() => {
    const updatedWaitingContent = jsx(
      'div', { className: 'content-container' },
      jsx(
        "div", { id: 'login' },
        jsx("p", { id: "playercount" }, `start Game in : ${count}s`),
        jsx(
          "div",
          { className: "waiting-animation" },
          jsx("img", {
            src: "/images/bomberman3d.gif",
            alt: "Waiting...",
            style: "margin-top: 10px;",
          })
        )
      ),
      jsx("aside", { className: "chat-sidebar-loby" },
        jsx("div", { className: "message-container", ref: Ref.messagesRef }),
        jsx(
          "div",
          { className: "chat-input-area" },
          jsx("input", {
            type: "text",
            className: "chat-input",
            placeholder: "Type a message...",
            ref: Ref.chatRef,
          }),
          jsx("button", { className: "send-button", ref: Ref.buttonRef }, "Send")
        )
      )
    )
    
    updateRender(updatedWaitingContent,Ref.loginRef.current);
    
    count--;
    if (count == 0) {
      GoToGame(data, tileMap);
      clearInterval(interval);
    }
  }, 1000);
}
let currentTileMap = null;

function GoToGame(data, tileMap) {
  if (currentTileMap) {
    currentTileMap.cleanup();
  }

  // Force a re-render of the game page first
  const appContainer = document.getElementById('app');
  if (!appContainer) {
    console.error('App container not found');
    return;
  }

  // Clear the container and render the game page
  appContainer.innerHTML = '';
  const gamePage = GamePage();
  renderApp(() => gamePage, appContainer);

  // Initialize game after DOM update
  setTimeout(() => {
    let game = Ref.gameCanvasRef.current;
    if (!game) {
      console.error('Game canvas not found');
      return;
    }

    // Initialize game
    currentTileMap = tileMap;
    tileMap.drawGame(game, data);

    // Start game loop
    function gameLoop() {
      if (game && currentTileMap) {
        currentTileMap.drawGame(game, data);
        requestAnimationFrame(gameLoop);
      }
    }
    requestAnimationFrame(gameLoop);

    // Initialize chat system
    initializeChat(data.nickname);

    // Update player info
    broadcastPlayerInfo(data);
  }, 100);
}


function initializeChat(nickname) {
  // Wait for chat elements to be available
  let attempts = 0;
  const maxAttempts = 10;

  function tryInitChat() {
    const sendButton = Ref.buttonRef.current;
    const chatInput = Ref.chatRef.current;
    const messageContainer = Ref.messagesRef.current;
    
    if (!sendButton || !chatInput || !messageContainer) {
      attempts++;
      if (attempts < maxAttempts) {
        setTimeout(tryInitChat, 100);
      } else {
        console.error('Failed to initialize chat - elements not found');
      }
      return;
    }

    // Clear any existing event listeners
    const newSendButton = sendButton.cloneNode(true);
    sendButton.parentNode.replaceChild(newSendButton, sendButton);
    Ref.buttonRef.current = newSendButton;
    
    // Add click listener
    newSendButton.addEventListener("click", () => sendMessage(nickname));
    
    // Add enter key listener
    chatInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        sendMessage(nickname);
      }
    });

    // Initialize chat history
    gethistorichat();
  }

  tryInitChat();
}

export function sendMessage(nickname) {
  const chatInput = Ref.chatRef.current;
  if (!chatInput) return;
  
  const messageText = chatInput.value.trim();
  if (messageText !== "") {
    socket.send(
      JSON.stringify({
        type: "chatMsg",
        nickname: nickname,
        messageText: messageText,
      })
    );
    chatInput.value = "";
  }
}

function displayMsg(data) {
  const messageContainer = Ref.messagesRef.current;

  const newMessage = jsx(
    "div",
    { className: "message" },
    jsx("div", { className: "player-name" }, data.nickname),
    jsx("div", { className: "message-text" }, data.messageText)
  );
  messageContainer.appendChild(createElement(newMessage));
  messageContainer.scrollTop = messageContainer.scrollHeight;
}

////////////////////////////////////////////////////bombs

function drawBomb(row, col) {
  const canvas = Ref.gameCanvasRef.current;
  const tileElement = Selectbyrowcol(canvas, row, col);
  if (tileElement && !hasclass(tileElement, "bomb")) {
    const bombDiv = jsx("div", {
      className: "bomb",
      style:
        "background-image: url('../images/bomb.png'); width: 38px; height: 38px; z-index: 5; left: 50%; top: 50%;",
    });
    const bombElement = createElement(bombDiv);
    tileElement.appendChild(bombElement);
  }
}

function removeBomb(row, col) {
  const canvas = Ref.gameCanvasRef.current;
  const tileElement = Selectbyrowcol(canvas, row, col);
  const bombImg = hasclass(tileElement, "bomb");
  if (bombImg) {
    tileElement.innerHTML = "";
  }
}

function destroyWall(row, col, gift, index, frames) {
  const canvas = Ref.gameCanvasRef.current;
  const tileElement = Selectbyrowcol(canvas, row, col);
  if (tileElement) {
    if (gift) {
      const power = [
        "../images/spoil_tileset.webp",
        "../images/speed.webp",
        "../images/bombing.webp",
      ];
      tileElement.innerHTML =
        '<img src="' +
        power[index] +
        '" style="width: 38px; height: 38px; position: absolute; top: 0; left: 0;">';
      //gift = false;
    } else {
      tileElement.innerHTML = "";
      drawExplosion(row, col, frames);
    }
  }
}

function drawExplosion(row, col, frames) {
  const canvas = Ref.gameCanvasRef.current;
  const tileElement = Selectbyrowcol(canvas, row, col);

  let currentFrame = 0;
  const frameDuration = 75;

  const explosionDiv = jsx("div", {
    className: "damage",
    style: `background-position: ${frames[0].x}px ${frames[0].y}px;
          background-image: url('../images/explosion.png');
          width: 38px;
          height: 38px;
          z-index: 6;
          left: 50%;
          top: 50%;`,
  });

  const explosionElement = createElement(explosionDiv);
  tileElement.appendChild(explosionElement);

  const animate = () => {
    if (currentFrame >= frames.length) {
      explosionElement.remove();
      return;
    }

    explosionElement.style.backgroundPosition = `${frames[currentFrame].x}px ${frames[currentFrame].y}px`;
    currentFrame++;

    setTimeout(animate, frameDuration);
  };

  animate();
}

// Helper function to check if a child has a .bomb div
function hasclass(tile, className) {
  for (let i = 0; i < tile.children.length; i++) {
    if (tile.children[i].classList.contains(className)) {
      return true;
    }
  }
  return false;
}
function Selectbyrowcol(canvas, row, col) {
  let tileElement = null;
  for (let i = 0; i < canvas.children.length; i++) {
    const child = canvas.children[i];

    // Make sure dataset exists and compare row/column
    if (
      child.dataset &&
      child.dataset.row === String(row) &&
      child.dataset.column === String(col)
    ) {
      tileElement = child;
      break;
    }
  }
  return tileElement;
}

function broadcastPlayerInfo(data) {
  const playersElement = Ref.playersRef.current;
  const images = [
    "../images/bluecaracter.png",
    "../images/redcaracter.png",
    "../images/greencaracter.png",
    "../images/yellowcaracter.png",
  ];

  const playerList = data.players.map((player, index) => {
    return jsx(
      "li",
      { id: `${player.id}` },
      `${player.nickname} - Lives: ${player.lives == 0 ? "dead" : player.lives
      }`,
      jsx("img", {
        src: images[index],
        alt: "player",
        style: `width: 30px; height: 30px; margin-left: 10px;`,
      })
    );
  });
  const showPlayersTitle = jsx("p", {}, "Players:");

  const playerListContainer = jsx(
    "ul",
    { className: "connected-players" },
    ...playerList
  );

  const wrapper = jsx("div", {}, showPlayersTitle, playerListContainer);
  updateRender(wrapper, playersElement);

  //   updateRender(playerList, playersElement);
}

////////////////////////////////////////////////////////


function gethistorichat(){
  socket.send(
      JSON.stringify({
        type: "gethistory",
      })
    );
}