import { store } from '../store.js';
import { send } from '../ws.js';
import { LobbyScreen } from '../components/LobbyScreen.js';

export function LobbyScreenContainer() {
    const { lobby, chatMessages } = store.getState();

    const handleSendMessage = (message) => {
        send({ type: 'SEND_CHAT_MESSAGE', payload: { message } });
    };

    return LobbyScreen({ lobby, chatMessages, onSendMessage: handleSendMessage });
}
