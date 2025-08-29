// import { LoginPage } from './login.js';
// import { GamePage } from './game.js';

// export { LoginPage, GamePage };
import { jsx } from '../mini-framework/render.js';
export const Ref = {
    gameCanvasRef: { current: null },
    livesRef: { current: null },
    playersRef: { current: null },
    chatRef: { current: null },
    inputRef: { current: null },
    buttonRef: { current: null },
    messagesRef: { current: null },
    hearts: { current: null },
    StatusRef: { current: null },
    notificationsRef: { current: null },
    popupRef: { current: null },
    gamePageRef: { current: null },
    loginRef: { current: null }
};
export function GamePage() {
    return jsx(
        'div', { ref: Ref.gamePageRef },
        // Header
        jsx('header', { className: 'header' },
            jsx('h1', { className: 'game-title' }, 'Bomber Man')
        ),

        jsx('div', { 
            id: 'power-notifications', 
            ref: Ref.notificationsRef,
            style: 'position: absolute; top: 70px; right: 20px; z-index: 100; width: 250px;'
        }),

        jsx('div', { 
            id: 'popup-msg',
            ref: Ref.popupRef,
            // style: 'position: absolute; top: 70px; right: 20px; z-index: 100; width: 250px;'
        }),

        // Content Container
        jsx('div', { className: 'content-container' },
            // Main Game Area
            jsx('main', { className: 'game-area' },
                jsx('div', { className: 'game-container' }, // Added game-container wrapper
                    jsx('div', { className: 'game-canvas', id: "game", ref: Ref.gameCanvasRef })
                )
            ),
            // Sidebar Chat Area
            jsx('aside', { className: 'chat-sidebar' },
                // Message Container
                jsx('div', { className: 'message-container' , ref : Ref.messagesRef}),
                // Chat Input Area
                jsx('div', { className: 'chat-input-area' },
                    jsx('input', {
                        type: 'text',
                        className: 'chat-input',
                        placeholder: 'Type a message...',
                        ref: Ref.chatRef,
                    }),
                    jsx('button', { className: 'send-button', ref: Ref.buttonRef}, 'Send')
                )
            )
        ),
        // Footer
        jsx('div', { className: 'footer' },
            jsx('div', { className: 'footer-content' },
                jsx('div', { className: 'footer-section lives-section' },
                    jsx('div', { id: 'playerlives' },
                        jsx('p', { id: 'lives', ref: Ref.livesRef }, "Lives :"),
                    ),
                    jsx('div', { id: "hearts", ref: Ref.hearts},
                        jsx('img', { src: '../images/heart.png', alt: 'Heart', className: 'heart-icon' }),
                        jsx('img', { src: '../images/heart.png', alt: 'Heart', className: 'heart-icon' }),
                        jsx('img', { src: '../images/heart.png', alt: 'Heart', className: 'heart-icon' }),
                    )
                ),
                jsx('div', { className: 'footer-section players-section', id: 'players', ref: Ref.playersRef },
                ),
                jsx('div', { className: 'footer-section status-section', ref: Ref.StatusRef },
                    jsx("div", { className: "stella-status" },
                        jsx("h3", { style: "color:rgb(0, 0, 0); margin-bottom: 8px;" }, "✨ Stella's Power Stats ✨"),
                        jsx("div", { style: "list-style: none; padding: 0; margin: 0;" },
                          jsx("p", {}, "💣 Bomb Power: 1", ),
                          jsx("p", {}, "⚡ Speed: 1", ),
                          jsx("p", {}, "🔥 Fire Range: 1",)
                        )
                      )
                )
            ),
        )
    );
}

// Game state variable
export let gameState = {
    name: "",
    playerCount: 0,
};


// LoginPage component
export function LoginPage() {
    function handleNameInput(event) {
        gameState.name = event.target.value;
    }

    function handleLogin(event) {

        if (gameState.name.trim()) {
            connectToGameServer(gameState.name);
         }
    }

    return jsx('div',{ref : Ref.loginRef},jsx(
        'div', { id: 'login',  },
        jsx('h1', {}, 'bomberMan'),
        jsx('p', { id: 'cont' }),
        jsx('div', { id: 'input' },
            jsx('input', {
                type: 'text',
                id: 'name',
                placeholder: 'Enter your Name',
                onInput: handleNameInput
            }),
            jsx("button", {
                id: "NameBut",
                onClick: handleLogin,
                className: "login-button"
            }, "Join Game")
        )
    ));
}