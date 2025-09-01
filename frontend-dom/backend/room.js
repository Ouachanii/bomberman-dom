const { createInitialGameState, handlePlayerStartMoving, handlePlayerStopMoving, updatePlayerPosition, handlePlaceBomb, handleExplosions } = require('./game.js');

const LOBBY_WAIT_TIME = 20000;
const COUNTDOWN_TIME = 10;
const GAME_TICK_RATE = 1000 / 60;

class Room {
    constructor(roomId) {
        this.roomId = roomId;
        this.lobbyState = {
            status: 'waiting',
            players: [],
            lobbyTimer: null,
            countdownTimer: null,
        };
        this.mainGameState = null;
        this.gameLoopInterval = null;
        this.nextPlayerId = 1;
    }

    // --- Public Methods ---
    addPlayer(ws, nickname) {
        if (this.lobbyState.players.length >= 4 || this.lobbyState.status === 'inprogress') {
            // Room is full or in progress, notify the user
            ws.send(JSON.stringify({ type: 'ERROR', payload: 'Room is full or game is in progress.' }));
            return;
        }

        const newPlayer = {
            id: this.nextPlayerId++,
            ws: ws,
            nickname: nickname,
            isAlive: true,
        };
        this.lobbyState.players.push(newPlayer);
        ws.playerId = newPlayer.id; // Associate ws connection with a player ID
        ws.roomId = this.roomId;   // Associate ws connection with this room

        this.broadcastLobbyState();

        if (this.lobbyState.players.length >= 2 && this.lobbyState.status === 'waiting' && !this.lobbyState.lobbyTimer) {
            console.log(`[Room ${this.roomId}] Setting 20-second lobby timer...`);
            this.lobbyState.lobbyTimer = setTimeout(() => this.startGameCountdown(), LOBBY_WAIT_TIME);
        }
        if (this.lobbyState.players.length === 4 && this.lobbyState.status === 'waiting') {
            console.log(`[Room ${this.roomId}] Four players have joined. Starting countdown immediately.`);
            this.startGameCountdown();
        }
    }

    handleMessage(ws, data) {
        const player = this.lobbyState.players.find(p => p.ws === ws);
        if (!player) {
            console.log(`[Room ${this.roomId}] Message from unknown player ignored`);
            return;
        }

        switch (data.type) {
            case 'SEND_CHAT_MESSAGE':
                this.broadcast({ type: 'NEW_CHAT_MESSAGE', payload: { nickname: player.nickname, message: data.payload.message } });
                break;
            case 'START_MOVING':
                if (this.mainGameState) {
                    const gamePlayer = this.mainGameState.players.find(p => p.id === player.id);
                    if (gamePlayer) handlePlayerStartMoving(gamePlayer, data.payload);
                }
                break;
            case 'STOP_MOVING':
                if (this.mainGameState) {
                    const gamePlayer = this.mainGameState.players.find(p => p.id === player.id);
                    if (gamePlayer) handlePlayerStopMoving(gamePlayer, data.payload);
                }
                break;
            case 'PLACE_BOMB':
                if (this.mainGameState) {
                    const gamePlayer = this.mainGameState.players.find(p => p.id === player.id);
                    if (gamePlayer) handlePlaceBomb(gamePlayer, this.mainGameState);
                }
                break;
        }
    }

    removePlayer(ws) {
        const playerIndex = this.lobbyState.players.findIndex(p => p.ws === ws);
        if (playerIndex === -1) return;

        const player = this.lobbyState.players[playerIndex];
        console.log(`[Room ${this.roomId}] Player ${player.nickname} disconnected`);
        this.lobbyState.players.splice(playerIndex, 1);

        if (this.lobbyState.status !== 'inprogress') {
            // If game hasn't started, update lobby
            if (this.lobbyState.players.length < 2) {
                clearTimeout(this.lobbyState.lobbyTimer);
                this.lobbyState.lobbyTimer = null;
            }
            if (this.lobbyState.status === 'countdown') {
                clearInterval(this.lobbyState.countdownTimer.interval);
                this.lobbyState.status = 'waiting';
            }
            this.broadcastLobbyState();
        } else if (this.mainGameState) {
            // If game is in progress, mark player as dead or remove.
            const gamePlayer = this.mainGameState.players.find(p => p.id === player.id);
            if (gamePlayer) {
                gamePlayer.isAlive = false; // Or simply remove them.
                 this.mainGameState.changes.push({ type: 'PLAYER_DIED', payload: { id: player.id } });
            }
        }
    }


    // --- Internal Game Logic ---

    broadcast(data) {
        const message = JSON.stringify(data);
        this.lobbyState.players.forEach(player => {
            if (player.ws.readyState === require('ws').OPEN) {
                player.ws.send(message);
            }
        });
    }

    resetLobby() {
        console.log(`[Room ${this.roomId}] Resetting lobby.`);
        this.lobbyState = {
            status: 'waiting',
            players: [],
            lobbyTimer: null,
            countdownTimer: null,
        };
        this.nextPlayerId = 1;
        // Optional: Inform clients that the lobby has reset
        // this.broadcast({ type: 'LOBBY_RESET' });
    }

    broadcastLobbyState() {
        this.broadcast({
            type: 'UPDATE_LOBBY_STATE',
            payload: {
                status: this.lobbyState.status,
                players: this.lobbyState.players.map(p => ({ id: p.id, nickname: p.nickname })),
                countdown: this.lobbyState.countdownTimer ? this.lobbyState.countdownTimer.remaining : null,
            }
        });
    }

    startGame() {
        console.log(`[Room ${this.roomId}] Game starting!`);
        this.lobbyState.status = 'inprogress';
        this.mainGameState = createInitialGameState(this.lobbyState.players);
        this.gameLoopInterval = setInterval(() => this.gameTick(), GAME_TICK_RATE);
        this.broadcast({ type: 'START_GAME', payload: this.mainGameState });
    }

    gameTick() {
        if (!this.mainGameState) return;

        // 1. Update positions
        this.mainGameState.players.forEach(player => {
            updatePlayerPosition(player, this.mainGameState);
        });

        // 2. Bomb timers
        this.mainGameState.bombs.forEach(bomb => bomb.timer -= GAME_TICK_RATE / 1000);

        // 3. Handle explosions
        handleExplosions(this.mainGameState);

        // 4. Explosion effect timers
        const initialExplosionCount = this.mainGameState.explosions.length;
        this.mainGameState.explosions.forEach(exp => exp.timer -= GAME_TICK_RATE / 1000);
        this.mainGameState.explosions = this.mainGameState.explosions.filter(exp => exp.timer > 0);
        if (this.mainGameState.explosions.length < initialExplosionCount) {
            this.mainGameState.changes.push({ type: 'EXPLOSIONS_CLEARED', payload: { explosions: this.mainGameState.explosions } });
        }

        // 5. Broadcast diffs
        if (this.mainGameState.changes.length > 0) {
            this.broadcast({ type: 'GAME_STATE_DIFF', payload: this.mainGameState.changes });
            this.mainGameState.changes = [];
        }

        // 6. Check for win condition
        const alivePlayers = this.mainGameState.players.filter(p => p.isAlive);
        if (alivePlayers.length <= 1) {
            clearInterval(this.gameLoopInterval);
            const winner = alivePlayers.length === 1 ? alivePlayers[0] : null;
            console.log(`[Room ${this.roomId}] Game Over! Winner:`, winner ? winner.nickname : 'Draw');
            this.broadcast({
                type: 'GAME_OVER',
                payload: {
                    winner: winner ? { id: winner.id, nickname: winner.nickname } : null
                }
            });
            this.mainGameState = null;
            // The room will be destroyed by the server, which will handle cleanup.
        }
    }

    startGameCountdown() {
        if (this.lobbyState.status === 'countdown') return;
        clearTimeout(this.lobbyState.lobbyTimer);
        this.lobbyState.lobbyTimer = null;
        this.lobbyState.status = 'countdown';
        let remaining = COUNTDOWN_TIME;
        this.lobbyState.countdownTimer = {
            interval: setInterval(() => {
                remaining--;
                this.broadcast({ type: 'UPDATE_COUNTDOWN', payload: remaining });
                if (remaining <= 0) {
                    clearInterval(this.lobbyState.countdownTimer.interval);
                    this.startGame();
                }
            }, 1000),
            remaining: remaining
        };
        this.broadcastLobbyState();
        console.log(`[Room ${this.roomId}] Starting 10-second countdown...`);
    }
}

module.exports = Room;
