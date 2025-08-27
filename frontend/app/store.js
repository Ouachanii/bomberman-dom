import { useState } from '../mini-framework/state.js';
import { renderApp } from '../mini-framework/render.js';

// Global state
export const [getGameState, setGameState] = useState('gameState', {
    playerCount: 0,
    playerId: null,
    countP: 0,
    name: '',
    nickname: '',
    messages: [],
    gameStarted: false,
    countdown: null,
    waitingContent: null
});

// Re-render function
let appContainer = null;
let currentView = null;

export function initializeStore(container, view) {
    appContainer = container;
    currentView = view;
}

// Update functions that trigger re-renders
export function updateGameState(newState) {
    setGameState({ ...getGameState(), ...newState });
    if (appContainer && currentView) {
        renderApp(() => currentView(), appContainer);
    }
}

export function updatePlayerCount(count, playerId, countP) {
    updateGameState({
        playerCount: count,
        playerId: playerId,
        countP: countP
    });
}

export function addMessage(message) {
    const currentState = getGameState();
    updateGameState({
        messages: [...currentState.messages, message]
    });
}

export function setNickname(nickname) {
    updateGameState({ nickname });
}

export function startGameCountdown() {
    let count = 10;
    updateGameState({ gameStarted: false, countdown: count });
    const interval = setInterval(() => {
        count--;
        if (count >= 0) {
            updateGameState({ countdown: count });
        } else {
            clearInterval(interval);
            updateGameState({ 
                gameStarted: true, 
                countdown: null,
                waitingContent: null 
            });
        }
    }, 1000);
}
