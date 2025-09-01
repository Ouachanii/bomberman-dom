import { send } from '../ws.js';
import { store } from '../store.js';

const keyboardState = {}; // Tracks which keys are currently held down
const keyMap = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
};

export const handleKeyDown = (e) => {
    const direction = keyMap[e.code];
    if (direction && !keyboardState[e.code]) {
        keyboardState[e.code] = true;
        send({ type: 'START_MOVING', payload: direction });
    }
};

export const handleKeyUp = (e) => {
    const direction = keyMap[e.code];
    if (direction) {
        keyboardState[e.code] = false;
        send({ type: 'STOP_MOVING', payload: direction });
    }
};

export const handleKeyPress = (e) => {
    if (e.code === 'Space' && store.getState().screen === 'game') {
        e.preventDefault();
        send({ type: 'PLACE_BOMB' });
    }
};
