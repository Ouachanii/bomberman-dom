// Simple state storage
const stateStore = {};

export function useState(key, initialValue) {
  if (!(key in stateStore)) {
    stateStore[key] = initialValue;
  }

  const getter = () => stateStore[key];
  const setter = (newValue) => {
    stateStore[key] = newValue;
  };

  return [getter, setter];
}