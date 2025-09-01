let ws;

export function initWebSocket(store, router) {
    ws = new WebSocket('ws://localhost:8080');

    ws.onopen = () => {
        console.log('Connected to the server');
    };

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        store.dispatch({ type: message.type, payload: message.payload });

        // Navigate based on server messages
        if (message.type === 'UPDATE_LOBBY_STATE') {
            router.navigate('#/lobby');
        } else if (message.type === 'START_GAME') {
            router.navigate('#/game');
        } else if (message.type === 'GAME_OVER') {
            router.navigate('#/gameover');
        }
    };

    ws.onclose = () => {
        console.log('Disconnected from the server');
    };

    ws.onerror = (error) => {
        console.error('WebSocket Error:', error);
    };
}

export function send(message) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    }
}
