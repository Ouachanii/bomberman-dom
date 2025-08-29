import { jsx } from '../mini-framework/render.js';
import { getGameState, updateGameState } from './store.js';
import { connectToGameServer } from '../game/index.js';
import { Ref } from './config.js';

// Player avatar component
function PlayerAvatar({ playerName, isActive = false }) {
    return jsx('div', { 
        className: `player-avatar ${isActive ? 'active' : ''}` 
    },
        jsx('div', { className: 'avatar-circle' }, 
            jsx('span', { className: 'avatar-initial' }, 
                playerName ? playerName.charAt(0).toUpperCase() : '?'
            )
        ),
        jsx('span', { className: 'player-name-label' }, playerName || 'Waiting...')
    );
}

// Login form card
function LoginCard({ onInput, onClick }) {
    const state = getGameState();
    return jsx('div', { className: 'login-card' },
        jsx('div', { className: 'card-header' },
            jsx('h2', { className: 'card-title' }, '🎮 Join BomberMan'),
            jsx('p', { className: 'card-subtitle' }, 'Enter your name to start playing')
        ),
        jsx('div', { className: 'card-body' },
            jsx('div', { className: 'input-group' },
                jsx('input', {
                    type: 'text',
                    className: 'game-input',
                    placeholder: 'Your warrior name...',
                    value: state.name || '',
                    onInput: onInput,
                    maxLength: 12
                }),
                jsx('button', {
                    className: 'join-btn',
                    onClick: onClick,
                    disabled: !state.name || state.name.trim().length < 2
                }, 
                    jsx('span', { className: 'btn-text' }, 'Join Battle'),
                    jsx('span', { className: 'btn-icon' }, '⚡')
                )
            )
        )
    );
}

// Waiting room card
function WaitingCard({ state }) {
    const players = state.players || [];
    const playerCount = state.playerCount || 1;
    
    return jsx('div', { className: 'waiting-card' },
        jsx('div', { className: 'card-header' },
            jsx('h2', { className: 'card-title' }, '⏳ Preparing Battle'),
            jsx('div', { className: 'status-indicator' },
                jsx('span', { className: 'pulse-dot' }),
                jsx('span', { className: 'status-text' }, `${playerCount}/4 Warriors Ready`)
            )
        ),
        jsx('div', { className: 'card-body' },
            jsx('div', { className: 'players-grid' },
                // Player slot 1
                jsx('div', { 
                    className: `player-slot ${0 < playerCount ? 'occupied' : 'empty'}`
                },
                    0 < playerCount 
                        ? PlayerAvatar({ 
                            playerName: players[0]?.name || `Player 1`, 
                            isActive: true 
                        })
                        : jsx('div', { className: 'empty-slot' },
                            jsx('span', { className: 'slot-icon' }, '👤'),
                            jsx('span', { className: 'slot-text' }, 'Waiting...')
                        )
                ),
                // Player slot 2
                jsx('div', { 
                    className: `player-slot ${1 < playerCount ? 'occupied' : 'empty'}`
                },
                    1 < playerCount 
                        ? PlayerAvatar({ 
                            playerName: players[1]?.name || `Player 2`, 
                            isActive: true 
                        })
                        : jsx('div', { className: 'empty-slot' },
                            jsx('span', { className: 'slot-icon' }, '👤'),
                            jsx('span', { className: 'slot-text' }, 'Waiting...')
                        )
                ),
                // Player slot 3
                jsx('div', { 
                    className: `player-slot ${2 < playerCount ? 'occupied' : 'empty'}`
                },
                    2 < playerCount 
                        ? PlayerAvatar({ 
                            playerName: players[2]?.name || `Player 3`, 
                            isActive: true 
                        })
                        : jsx('div', { className: 'empty-slot' },
                            jsx('span', { className: 'slot-icon' }, '👤'),
                            jsx('span', { className: 'slot-text' }, 'Waiting...')
                        )
                ),
                // Player slot 4
                jsx('div', { 
                    className: `player-slot ${3 < playerCount ? 'occupied' : 'empty'}`
                },
                    3 < playerCount 
                        ? PlayerAvatar({ 
                            playerName: players[3]?.name || `Player 4`, 
                            isActive: true 
                        })
                        : jsx('div', { className: 'empty-slot' },
                            jsx('span', { className: 'slot-icon' }, '👤'),
                            jsx('span', { className: 'slot-text' }, 'Waiting...')
                        )
                )
            ),
            jsx('div', { className: 'battle-preview' },
                jsx('img', {
                    src: '../images/bomberman3d.gif',
                    alt: 'Battle Preview',
                    className: 'battle-gif'
                }),
                jsx('p', { className: 'battle-text' }, 'Get ready for explosive action!')
            )
        )
    );
}

// Chat card component
function ChatCard({ state }) {
    return jsx('div', { className: 'chat-card' },
        jsx('div', { className: 'card-header' },
            jsx('h3', { className: 'card-title small' }, '💬 Battle Chat'),
            jsx('span', { className: 'online-count' }, `${state.playerCount || 1} online`)
        ),
        jsx('div', { className: 'card-body' },
            jsx('div', { 
                className: 'messages-area',
                ref: Ref.messagesRef 
            },
                jsx('div', { className: 'welcome-message' },
                    jsx('span', { className: 'welcome-icon' }, '🎯'),
                    jsx('span', {}, 'Welcome to the battle lobby!')
                )
            ),
            jsx('div', { className: 'chat-input-section' },
                jsx('div', { className: 'input-wrapper' },
                    jsx('input', {
                        type: 'text',
                        className: 'chat-input',
                        placeholder: 'Send a message...',
                        ref: Ref.chatRef,
                        maxLength: 100
                    }),
                    jsx('button', { 
                        className: 'send-btn',
                        ref: Ref.buttonRef
                    }, 
                        jsx('span', { className: 'send-icon' }, '🚀')
                    )
                )
            )
        )
    );
}

// Main app component
export function LoginPage() {
    const state = getGameState();
    
    function handleNameInput(event) {
        updateGameState({
            name: event.target.value
        });
    }
    
    function handleJoinGame(event) {
        const name = state.name && state.name.trim();
        if (name && name.length >= 2) {
            updateGameState({
                isConnecting: true
            });
            connectToGameServer(name);
        }
    }
    
    // Show different layouts based on state
    const isWaiting = state.waitingContent && state.waitingContent.showAnimation;
    
    return jsx('div', { className: 'bomber-app' },
        jsx('div', { className: 'app-background' }),
        jsx('header', { className: 'app-header' },
            jsx('h1', { className: 'app-title' }, '💣 BOMBERMAN ARENA'),
            jsx('div', { className: 'header-decoration' })
        ),
        jsx('main', { className: 'app-main' },
            isWaiting 
                ? jsx('div', { className: 'lobby-layout' },
                    jsx('div', { className: 'main-content' },
                        WaitingCard({ state })
                    ),
                    jsx('div', { className: 'side-content' },
                        ChatCard({ state })
                    )
                )
                : jsx('div', { className: 'login-layout' },
                    LoginCard({ 
                        onInput: handleNameInput, 
                        onClick: handleJoinGame 
                    })
                )
        ),
        jsx('footer', { className: 'app-footer' },
            jsx('div', { className: 'footer-content' },
                jsx('span', {}, '🎮 Ready for explosive battles?'),
                jsx('div', { className: 'connection-status' },
                    jsx('span', { 
                        className: `status-dot ${state.isConnecting ? 'connecting' : 'ready'}` 
                    }),
                    jsx('span', {}, state.isConnecting ? 'Connecting...' : 'Ready to play')
                )
            )
        )
    );
}