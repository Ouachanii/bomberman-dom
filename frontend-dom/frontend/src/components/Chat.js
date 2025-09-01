import FacileJS from '../../framework/index.js';

export function ChatComponent({ messages, onSendMessage }) {
    let currentMessage = '';

    const handleInput = (e) => {
        currentMessage = e.target.value;
    };

    const handleSendMessage = () => {
        if (currentMessage.trim().length > 0) {
            onSendMessage(currentMessage);
        }
    };

    return FacileJS.createElement('div', { class: 'chat-container' },
        FacileJS.createElement('div', { class: 'messages' },
            ...messages.map(msg =>
                FacileJS.createElement('p', { class: 'message' },
                    FacileJS.createElement('strong', {}, `${msg.nickname}: `),
                    msg.message
                )
            )
        ),
        FacileJS.createElement('input', {
            type: 'text',
            placeholder: 'Type a message...',
            oninput: handleInput,
            onkeyup: (e) => {
                if (e.keyCode === 13) {
                    handleSendMessage();
                    e.target.value = '';
                }
            }
        })
    );
}
