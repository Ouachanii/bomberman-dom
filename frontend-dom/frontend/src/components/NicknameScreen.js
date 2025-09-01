import FacileJS from '../../framework/index.js';

export function NicknameScreen({ onJoin }) {
    let nickname = '';

    const handleInput = (e) => {
        nickname = e.target.value;
    };

    const handleJoin = () => {
        if (nickname.trim().length > 0) {
            onJoin(nickname);
        }
    };

    return FacileJS.createElement('div', { class: 'container nickname-screen' },
        FacileJS.createElement('h1', {}, 'Bomberman-DOM'),
        FacileJS.createElement('input', {
            type: 'text',
            placeholder: 'Enter your nickname',
            oninput: handleInput,
            onkeyup: (e) => e.keyCode === 13 && handleJoin()
        }),
        FacileJS.createElement('button', { onclick: handleJoin }, 'Join Game')
    );
}
