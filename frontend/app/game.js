// import { jsx } from '../mini-framework/render.js';
// import { Ref } from './config.js';

// export function GamePage() {
//     // Reset refs when mounting game page
//     Object.keys(Ref).forEach(key => {
//         Ref[key].current = null;
//     });

//     const header = jsx('header', { className: 'header' },
//         jsx('h1', { className: 'game-title' }, 'Bomber Man')
//     );

//     const notifications = [
//         jsx('div', { 
//             id: 'power-notifications', 
//             ref: Ref.notificationsRef,
//             style: 'position: absolute; top: 70px; right: 20px; z-index: 100; width: 250px;'
//         }),
//         jsx('div', { 
//             id: 'popup-msg',
//             ref: Ref.popupRef
//         })
//     ];
//     const mainContent = jsx('div', { className: 'content-container' },
//         jsx('main', { className: 'game-area' },
//             jsx('div', { className: 'game-container' },
//                 jsx('div', { className: 'game-canvas', id: "game", ref: Ref.gameCanvasRef })
//             )
//         ),
//         jsx('aside', { className: 'chat-sidebar' },
//             jsx('div', { className: 'message-container', ref: Ref.messagesRef }),
//             jsx('div', { className: 'chat-input-area' },
//                 jsx('input', {
//                     type: 'text',
//                     className: 'chat-input',
//                     placeholder: 'Type a message...',
//                     ref: Ref.chatRef
//                 }),
//                 jsx('button', { className: 'send-button', ref: Ref.buttonRef }, 'Send')
//             )
//         )
//     );

//     const footer = jsx('div', { className: 'footer' },
//         jsx('div', { className: 'footer-content' },
//             jsx('div', { className: 'footer-section lives-section' },
//                 jsx('div', { id: 'playerlives' },
//                     jsx('p', { id: 'lives', ref: Ref.livesRef }, "Lives :")
//                 ),
//                 jsx('div', { id: "hearts", ref: Ref.hearts },
//                     jsx('img', { src: '../images/heart.png', alt: 'Heart', className: 'heart-icon' }),
//                     jsx('img', { src: '../images/heart.png', alt: 'Heart', className: 'heart-icon' }),
//                     jsx('img', { src: '../images/heart.png', alt: 'Heart', className: 'heart-icon' })
//                 )
//             ),
//             jsx('div', { className: 'footer-section players-section', id: 'players', ref: Ref.playersRef }),
//             jsx('div', { className: 'footer-section status-section', ref: Ref.StatusRef },
//                 jsx('div', { className: "stella-status" },
//                     jsx('h3', { style: "color:rgb(0, 0, 0); margin-bottom: 8px;" }, "✨ Stella's Power Stats ✨"),
//                     jsx('div', { style: "list-style: none; padding: 0; margin: 0;" },
//                         jsx('p', {}, "💣 Bomb Power: 1"),
//                         jsx('p', {}, "⚡ Speed: 1"),
//                         jsx('p', {}, "🔥 Fire Range: 1")
//                     )
//                 )
//             )
//         )
//     );

//     return jsx('div', { className: 'game-wrapper', ref: Ref.gamePageRef },
//         header,
//         jsx('div', { className: 'notifications-container' }, ...notifications),
//         mainContent,
//         footer
//     );
// }
