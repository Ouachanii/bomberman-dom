// Simple hash-based router
let currentRoute = window.location.hash.slice(1) || "/";
let listeners = [];
let previousHash = window.location.hash;

export function useRoute() {
  return currentRoute;
}

export function onRouteChange(listener) {
  listeners.push(listener);
}

export function navigate(path) {
  if (path !== currentRoute) {
    window.location.hash = path;
    currentRoute = path;
    listeners.forEach((fn) => fn(currentRoute));
  }
}

export function initRouter() {
  // Use event listener instead of polling
  window.addEventListener('hashchange', () => {
    const newHash = window.location.hash;
    if (newHash !== previousHash) {
      previousHash = newHash;
      currentRoute = newHash.slice(1) || "/";
      listeners.forEach((fn) => fn(currentRoute));
    }
  });
  
  // Initial route
  currentRoute = window.location.hash.slice(1) || "/";
  listeners.forEach((fn) => fn(currentRoute));
}

export class Router {
  constructor(routes = {}) {
    this.routes = routes;
    this._started = false;
  }

  init() {
    if (this._started) return;
    this._started = true;

    initRouter();
    onRouteChange((path) => {
      const view = this.routes[path];
      if (typeof view === "function") {
        view();
      }
    });

    // Run initial route
    const current = useRoute();
    const view = this.routes[current];
    if (typeof view === "function") {
      view();
    }
  }

  navigate(path) {
    navigate(path);
  }
}

