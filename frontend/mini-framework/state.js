// Enhanced state storage with subscriptions
const stateStore = {};
const subscribers = new Map();

export function useState(key, initialValue) {
  if (!(key in stateStore)) {
    stateStore[key] = initialValue;
  }

  const getter = () => stateStore[key];
  const setter = (newValue) => {
    const oldValue = stateStore[key];
    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      stateStore[key] = newValue;
      if (subscribers.has(key)) {
        subscribers.get(key).forEach(callback => callback(newValue, oldValue));
      }
    }
  };

  return [getter, setter];
}

export function subscribe(key, callback) {
  if (!subscribers.has(key)) {
    subscribers.set(key, new Set());
  }
  subscribers.get(key).add(callback);
  return () => subscribers.get(key).delete(callback);
}

export function getState(key) {
  return stateStore[key];
}

export function resetState(key) {
  if (key) {
    delete stateStore[key];
  } else {
    Object.keys(stateStore).forEach(k => delete stateStore[k]);
  }
}