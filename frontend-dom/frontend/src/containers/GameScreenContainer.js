import { store } from '../store.js';
import { send } from '../ws.js';
import { GameScreen } from '../components/GameScreen.js';

export function GameScreenContainer() {
    const { gameState, chatMessages } = store.getState();

    const handleSendMessage = (message) => {
        send({ type: 'SEND_CHAT_MESSAGE', payload: { message } });
    };

    return GameScreen({ gameState, chatMessages, onSendMessage: handleSendMessage });
}
