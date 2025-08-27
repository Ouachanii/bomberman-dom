import { OfflinePlayer, socket, theWinnerIs } from "./index.js";

export const playersElement = new Map();
export default class Game {
  constructor(tileSize, data) {
    this.tileSize = tileSize;
    this.players = data.players.length;
    this.wall = this.#image("wallBlack.png");
    this.bombs = [];
    this.MyId = data.MyId;
    this.map = data.map;
    this.canvas = null;
    this.controlsInitialized = false;
    this.keydownHandler = null;
    this.keyupHandler = null;
  }

  #image(fileName) {
    const img = new Image();
    img.src = `../images/${fileName}`;
    return img;
  }

  drawGame(canvas, data) {
    if (!canvas) {
      console.error('Canvas element not found');
      return;
    }

    this.canvas = canvas;
    this.#clearCanvas(canvas);
    this.#setCanvasSize(canvas);
    this.#draw(canvas, data);
    
    if (!this.controlsInitialized) {
      this.#setupPlayerControls();
      this.controlsInitialized = true;
    }
  }

  #clearCanvas(canvas) {
    while (canvas.firstChild) {
      canvas.removeChild(canvas.firstChild);
    }
  }

  #draw(canvas, data) {
    if (OfflinePlayer?.length === 3) {
      data = {
        name: 'You'
      }
      theWinnerIs(data);
      socket.close();
      return;
    }

    const rows = this.map.length;
    const columns = this.map[0].length;

    canvas.innerHTML = "";
    canvas.style.display = "grid";
    canvas.style.gridTemplateRows = `repeat(${rows}, ${this.tileSize}px)`;
    canvas.style.gridTemplateColumns = `repeat(${columns}, ${this.tileSize}px)`;
    canvas.style.alignContent = "center";
    canvas.style.justifyContent = "center";
    canvas.style.position = "relative"; // FIX: Add position relative to allow absolute positioning of children

    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const tile = this.map[row][column];
        const imgProps = {};
        let divStyle = ""; // for inline styles
        let classname = "";
        let divId = "";
        let initialX = 0;
        let initialY = 0;

        switch (tile) {
          case 1:
          case 4:
            imgProps.src = "../images/wallBlack.png";
            divId = "wallfix";
            classname = "tile";
            break;
          case 2:
            imgProps.src = "../images/tree.png";
            divId = "WallBreak";
            classname = "tile";
            break;
          case 3:
            imgProps.src = "../images/wall.png";
            divId = "WallBreak";
            classname = "tile";
            break;
          case 0:
            classname = "tile";
            break;
          case 5:
            initialX = column * this.tileSize;
            initialY = row * this.tileSize;
            break;
          case 6:
            initialX = column * this.tileSize;
            initialY = row * this.tileSize;
            break;
          case 7:
            initialX = column * this.tileSize;
            initialY = row * this.tileSize;
            break;
          case 8:
            initialX = column * this.tileSize;
            initialY = row * this.tileSize;
            break;
          default:
            classname = "tile";
            break;
        }

        const imgnode = imgProps.src ? jsx("img", imgProps) : [];
        const divnode = jsx(
          "div",
          {
            className: classname,
            "data-row": row,
            "data-column": column,
            id: divId || `tile_${row}_${column}`,
            style: divStyle ? `background-image: ${divStyle}` : "",
            "data-initial-x": initialX,
            "data-initial-y": initialY,
          },
          imgnode
        );

        const div = createElement(divnode);
        canvas.appendChild(div);

        if (tile >= 5 && tile <= 8) {
          const playerIndex = tile - 5;
          const playerStyles = [
            "url('../images/playerStyle.png')",
            "url('../images/playerRed.png')",
            "url('../images/playerGreen.png')",
            "url('../images/playerYallow.png')",
          ];
          if (!OfflinePlayer?.includes(data.players[playerIndex].id)) {
            const playerVNode = jsx(
              "div",
              {
                className: "player",
                id: `player_${data.players[playerIndex].id}`,
                style: `
                background-image: ${playerStyles[playerIndex]};
                width: 27px;
                height: 40px;
                position: absolute;
                z-index: 10;
                transform: translate(${initialX}px, ${initialY}px);
              `
              }
            );
            const playerDiv = createElement(playerVNode);
            playersElement.set(data.players[playerIndex].id, playerDiv);
            canvas.appendChild(playerDiv);
          }
        }
      }
    }
  }

  #setCanvasSize(canvas) {
    canvas.style.height = `${this.map.length * this.tileSize}px`;
    canvas.style.width = `${this.map[0].length * this.tileSize}px`;
  }

  #setupPlayerControls() {
    if (this.controlsInitialized) {
      console.log("Controls are already initialized, using existing handlers");
      return;
    }

    let keysPressed = {};
    let lastUpdateTime = Date.now();
    let lastSendTime = 0;
    const updateInterval = 50;
    this.keydownHandler = (e) => {
      if (e.target.tagName == "INPUT" || e.target.tagName == "TEXTAREA") return;
      keysPressed[e.key.toLowerCase()] = true;

      if ((e.key === "b" || e.key === "B") && !e.repeat) {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(
            JSON.stringify({
              type: "placeBomb",
            })
          );
        }
      }
    };

    this.keyupHandler = (e) => {
      keysPressed[e.key.toLowerCase()] = false;
    };

    MyEventSystem.addEventListener(window, "keydown", this.keydownHandler);
    MyEventSystem.addEventListener(window, "keyup", this.keyupHandler);
    MyEventSystem.addEventListener(window, 'blur', () => {
      Object.keys(keysPressed).forEach(key => keysPressed[key] = false);
    });
    const updatePlayerMovement = () => {
      if (!this.controlsInitialized) {
        console.log("Controls are not initialized, skipping update");
        return;
      }

      const now = Date.now();
      lastUpdateTime = now;

      let direction;
      if (keysPressed["w"] || keysPressed["W"]) {
        direction = "up";
      }
      if (keysPressed["d"] || keysPressed["D"]) {
        direction = "right";
      }
      if (keysPressed["s"] || keysPressed["S"]) {
        direction = "down";
      }
      if (keysPressed["a"] || keysPressed["A"]) {
        direction = "left";
      }

      if (now - lastSendTime > updateInterval) {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(
            JSON.stringify({
              type: "playerMove",
              direction: direction,
            })
          );
          lastSendTime = now;
        }
      }

      if (this.controlsInitialized) {
        requestAnimationFrame(updatePlayerMovement);
      }
    };

    this.controlsInitialized = true;
    updatePlayerMovement();
  }
  cleanup() {
    this.controlsInitialized = false;
    console.log("TileMap controls cleaned up");
  }
}
