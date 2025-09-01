import FacileJS from '../../framework/index.js';

export function GameOverScreen({ winner, onPlayAgain }) {
    const message = winner ? `${winner.nickname} Wins!` : "It's a Draw!";

    return FacileJS.createElement('div', { class: 'container game-over-screen' },
        FacileJS.createElement('h1', {}, 'Game Over'),
        FacileJS.createElement('h2', {}, message),
        FacileJS.createElement('button', { onclick: onPlayAgain }, 'Play Again')
    );
}
