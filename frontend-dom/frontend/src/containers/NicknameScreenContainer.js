import { store } from '../store.js';
import { send } from '../ws.js';
import { router } from '../router.js';
import { NicknameScreen } from '../components/NicknameScreen.js';

export function NicknameScreenContainer() {
    const handleJoin = (nickname) => {
        store.dispatch({ type: 'SET_NICKNAME', payload: nickname });
        send({ type: 'JOIN_GAME', payload: { nickname } });
    };

    return NicknameScreen({ onJoin: handleJoin });
}
