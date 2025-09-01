import FacileJS from '../../framework/index.js';
import { ChatComponent } from './Chat.js';

export function LobbyScreen({ lobby, chatMessages, onSendMessage }) {
    const { players, countdown, status } = lobby;
    const timerText = countdown !== null ? `Game starts in: ${countdown}s` : 'Waiting...';

    return FacileJS.createElement('div', { class: 'container lobby-screen' },
        FacileJS.createElement('h1', {}, 'Lobby'),
        FacileJS.createElement('p', {}, `Players: ${players.length}/4`),
        FacileJS.createElement('ul', { class: 'player-list' },
            ...players.map(p => FacileJS.createElement('li', {}, p.nickname))
        ),
        FacileJS.createElement('p', { class: 'timer' }, status === 'countdown' ? timerText : 'Waiting for more players...'),
        ChatComponent({ messages: chatMessages, onSendMessage })
    );
}
