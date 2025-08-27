import { jsx } from '../mini-framework/render.js';
import { getGameState, updateGameState } from './store.js';
import { connectToGameServer } from '../game/index.js';
import { Ref } from './config.js';

// Login input form component
function LoginInput({ onInput, onClick }) {
    const state = getGameState();
    return jsx('div', { id: 'input' },
        jsx('input', {
            type: 'text',
            id: 'name',
            placeholder: 'Enter your Name',
            value: state.name || '',
            onInput: onInput
        }),
        jsx('button', {
            id: 'NameBut',
            onClick: onClick,
            className: 'login-button'
        }, 'Join Game')
    );
}

// Waiting room component
function WaitingRoom({ state }) {
    return jsx('div', { className: 'content-container' },
        jsx('div', { id: 'playercount' }, `Players: ${state.playerCount || 0}/4`),
        jsx('div', { className: 'waiting-animation' },
            jsx('img', {
                src: '../images/bomberman3d.gif',
                alt: 'Waiting...',
                style: 'margin-top: 10px;'
            }),
            jsx('p', {}, state.progressText || '')
        ),
        jsx('aside', { className: 'chat-sidebar-loby' },
            jsx('div', { className: 'message-container', ref: Ref.messagesRef }),
            jsx('div', { className: 'chat-input-area' },
                jsx('input', {
                    type: 'text',
                    className: 'chat-input',
                    placeholder: 'Type a message...',
                    ref: Ref.chatRef
                }),
                jsx('button', { 
                    className: 'send-button', 
                    ref: Ref.buttonRef 
                }, 'Send')
            )
        )
    );
}

// Main login page component
export function LoginPage() {
    const state = getGameState();
    
    function handleNameInput(event) {
        // Update state using updateGameState from store
        updateGameState({
            name: event.target.value
        });
    }

    function handleLogin(event) {
        const name = state.name && state.name.trim();
        if (name) {
            connectToGameServer(name);
        }
    }

    // If game has started, don't show login
    if (state.gameStarted) {
        router.navigate("/game");
        return null;
    }

    // Determine which content to show
    const content = state.waitingContent && state.waitingContent.showAnimation
        ? WaitingRoom({ state })
        : LoginInput({ onInput: handleNameInput, onClick: handleLogin });

    return jsx('div', {ref: Ref.loginRef}, 
        jsx('div', { id: 'login' },
            jsx('h1', {}, 'bomberMan'),
            jsx('p', { id: 'cont' }, state.progressText || ''),
            content
        )
    );
}
