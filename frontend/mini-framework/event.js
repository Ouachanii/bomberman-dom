export const MyEventSystem = {
    listeners: new Map(),

    addEventListener(domElement, eventType, callback) {
        if (!this.listeners.has(domElement)) {
            this.listeners.set(domElement, {});
        }
        
        const elementListeners = this.listeners.get(domElement);

        if (!elementListeners[eventType]) {
            elementListeners[eventType] = [];
            domElement[`on${eventType}`] = (nativeEvent) => {
                this.dispatchEvent(domElement, eventType, nativeEvent);
            };
        }
        elementListeners[eventType].push({ callback });
    },

    dispatchEvent(domElement, eventType, nativeEvent) {
        const elementListeners = this.listeners.get(domElement);

        if (!elementListeners || !elementListeners[eventType]) {
            return;
        }

        elementListeners[eventType].forEach((listener) => {
            listener.callback(nativeEvent);

        });
    },
};