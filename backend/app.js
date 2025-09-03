// app.js
const http = require('http');
const socketIo = require('socket.io');
const setupHttpServer = require('./http-server'); // Import the HTTP server setup
const { initializeGame, gameState, activeNicknames, resetGame } = require('./game-state'); // Import game state and utils
const setupSocketHandlers = require('./socket-handlers'); // Import socket handlers

const server = http.createServer(setupHttpServer); // Create HTTP server and pass the handler

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Initialize game state at startup
initializeGame();

// Setup all Socket.IO event handlers
setupSocketHandlers(io, gameState, activeNicknames, resetGame);

const PORT = 3000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});