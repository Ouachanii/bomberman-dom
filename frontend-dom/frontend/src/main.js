import FacileJS from '../framework/index.js';
import { store } from './store.js';
import { router } from './router.js';
import { initWebSocket } from './ws.js';
import { handleKeyDown, handleKeyUp, handleKeyPress } from './game/input.js';
import { boardManager } from './game/boardManager.js';
import { NicknameScreenContainer } from './containers/NicknameScreenContainer.js';
import { LobbyScreenContainer } from './containers/LobbyScreenContainer.js';
import { GameScreenContainer } from './containers/GameScreenContainer.js';
import { GameOverScreenContainer } from './containers/GameOverScreenContainer.js';

function App() {
    const state = store.getState();
    let screenComponent;

    // Route guard
    if (!state.nickname && state.screen !== 'nickname') {
        router.navigate('#/nickname');
        screenComponent = NicknameScreenContainer(); // Render nickname screen while navigating
    } else {
        switch (state.screen) {
            case 'lobby': screenComponent = LobbyScreenContainer(); break;
            case 'game': screenComponent = GameScreenContainer(); break;
            case 'gameover': screenComponent = GameOverScreenContainer(); break;
            default: screenComponent = NicknameScreenContainer(); break;
        }
    }
    return FacileJS.createElement('div', { class: 'app-container', tabindex: '0', autofocus: true, onkeydown: handleKeyDown, onkeyup: handleKeyUp, onkeypress: handleKeyPress, }, screenComponent);
}

// The game loop is now only for animation, not for sending input.
function gameLoop() {
    requestAnimationFrame(gameLoop);
}

// --- App Initialization ---
const rootElement = document.getElementById('root');
const update = FacileJS.createApp(App, rootElement);

store.subscribe(() => {
    const state = store.getState();
    update(); // Always run the framework's update for static UI and screen transitions
    if (state.screen === 'game' && state.gameState.map.length > 0) {
        boardManager.update(state.gameState);
    } else {
        boardManager.reset();
    }
});

initWebSocket(store, router);
requestAnimationFrame(gameLoop);
