// Import all framework features
import { default as events } from './events.js';
import { useState } from './state.js';
import { useRoute, onRouteChange, navigate, initRouter } from './router.js';
import { createStore } from './store.js';
import { createElement, updateProps, diffChildren } from './render.js';

// Re-export framework features
export { events, useState, useRoute, onRouteChange, navigate, initRouter, createStore };

let currentVDOM = null;
let rootElement = null;

export function h(type, props = {}, ...children) {
  return {
    type,
    props: props || {},
    children: children.flat()
  };
}

export function mount(vnode, container) {
  const newElement = createElement(vnode);
  container.replaceChildren(newElement);
  currentVDOM = vnode;
  rootElement = newElement;
  return newElement;
}

// Export as window.miniFW for auto-detection
window.miniFW = {
  h,
  mount,
  createStore
};
