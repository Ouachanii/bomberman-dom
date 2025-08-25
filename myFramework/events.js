const events = {
  on(element, eventName, handler) {
    if (!eventName.startsWith('on')) {
      eventName = 'on' + eventName;
    }
    element[eventName.toLowerCase()] = (event) => {
      handler.call(element, event);
    };
  },

  off(element, eventName) {
    if (!eventName.startsWith('on')) {
      eventName = 'on' + eventName;
    }
    element[eventName.toLowerCase()] = null;
  }
};

export default events;
