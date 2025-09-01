const WebSocket = require('ws');
const Room = require('./room.js');

const wss = new WebSocket.Server({ port: 8080 });
console.log('Server started on port 8080');

const rooms = new Map();

function findOrCreateRoom() {
    let room = null;
    // Find a room that is waiting for players
    for (const r of rooms.values()) {
        if (r.lobbyState.status === 'waiting' && r.lobbyState.players.length < 4) {
            room = r;
            break;
        }
    }
    // If no waiting room is found, create a new one
    if (!room) {
        const roomId = `room-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        room = new Room(roomId);
        rooms.set(roomId, room);
        console.log(`Created new room: ${roomId}`);
    }
    return room;
}

wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', (rawMessage) => {
        try {
            const data = JSON.parse(rawMessage);

            if (data.type === 'JOIN_GAME') {
                // For a new player, we find or create a room and add them.
                const room = findOrCreateRoom();
                room.addPlayer(ws, data.payload.nickname);
            } else {
                // For existing players, their messages are handled by their room.
                const roomId = ws.roomId;
                const room = rooms.get(roomId);
                if (room) {
                    room.handleMessage(ws, data);
                } else {
                    console.log(`Message from player in non-existent room ${roomId}`);
                }
            }
        } catch (error) {
            console.error('Failed to parse message or handle client request:', error);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        const roomId = ws.roomId;
        if (roomId) {
            const room = rooms.get(roomId);
            if (room) {
                room.removePlayer(ws);
                // If the room becomes empty, we can choose to remove it.
                if (room.lobbyState.players.length === 0) {
                    rooms.delete(roomId);
                    console.log(`Room ${roomId} is empty and has been removed.`);
                }
            }
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});