import FacileJS from '../../framework/index.js';
import { boardManager } from '../game/boardManager.js';

function BoardRendererComponent({ map }) {
    boardManager.reset();
    return boardManager.createBoard(map);
}

function PlayerStatus({ players }) {
    return FacileJS.createElement('div', { class: 'player-status-container' },
        ...players.map(p => {
            const lifeIcons = Array.from({ length: p.lives }, () =>
                FacileJS.createElement('div', { class: 'life-icon' })
            );

            return FacileJS.createElement('div', { class: `player-status player-${p.id} ${p.isAlive ? '' : 'dead'}` },
                FacileJS.createElement('div', { class: 'player-icon' }),
                FacileJS.createElement('span', { class: 'nickname' }, p.nickname),
                FacileJS.createElement('div', { class: 'lives-container' }, ...lifeIcons)
            );
        })
    );
}

export function GameScreen({ gameState, chatMessages, onSendMessage }) {
    const { map, players } = gameState;
    if (!map || map.length === 0) {
        return FacileJS.createElement('div', {}, 'Loading game...');
    }
    return FacileJS.createElement('div', { class: 'game-container' },
        PlayerStatus({ players }),
        BoardRendererComponent({ map })   
    );
}
