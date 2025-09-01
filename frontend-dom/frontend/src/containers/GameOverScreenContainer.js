import { store } from '../store.js';
import { GameOverScreen } from '../components/GameOverScreen.js';

export function GameOverScreenContainer() {
    const { winner } = store.getState();

    const handlePlayAgain = () => {
        window.location.reload();
    };

    return GameOverScreen({ winner, onPlayAgain: handlePlayAgain });
}
