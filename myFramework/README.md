
---

# 🖼️ Mini Virtual DOM Renderer (`render.js`)

This file implements a **simple but reliable Virtual DOM renderer** with a diffing system.
It powers the UI updates of your mini-framework (similar to React’s reconciliation but much smaller).

---

## ✨ Features

* Converts **VDOM objects → real DOM** (`createElement`).
* Efficient **diffing**:

  * Updates only changed props and attributes.
  * Handles `value`, `checked`, `class`, `htmlFor` specially.
  * Preserves event listeners.
* Supports **children diffing**:

  * **Keyed diffing** for lists (stable reordering).
  * **Simple position-based diffing** for static trees.
* Text node updates without re-rendering the whole DOM.

---

## 📂 Main Functions

* **`createElement(vnode)`** → Builds a real DOM element from a VDOM node.
* **`updateProps(el, newProps, oldProps)`** → Applies only changed props/events.
* **`diffChildren(parent, newChildren, oldChildren)`** → Updates children efficiently:

  * `diffKeyedChildren` for keyed lists (`{ key: ... }`).
  * `diffSimpleChildren` for non-keyed.
* **`renderApp(component, container)`** → Entry point:

  1. On first render → mounts full DOM.
  2. On updates → diffs new VDOM against old and patches DOM.

---

## 🛠️ Usage

```js
import { renderApp } from "./framework/render.js";
import App from "./src.js"; // your root component

const root = document.getElementById("app");
renderApp(App, root);
```

Your components should return a **VDOM object**:

```js
{
  type: "button",
  props: { onclick: () => alert("Hi!") },
  children: ["Click me"]
}
```

---

## ⚡ Notes

* Always provide **keys** for dynamic lists to ensure efficient reordering:

  ```js
  children: tasks.map(t => ({ type: "li", props: { key: t.id }, children: [t.text] }))
  ```
* Controlled inputs (`value`, `checked`) are synced via `updateProps` so state always drives UI.
* If the root component type changes, the entire tree is re-rendered.

---


# 🌍 Mini Router (`router.js`)

This file implements a **very simple hash-based router** for single-page apps.
It keeps track of the current route (`#/`, `#/active`, `#/completed`) and lets components react when the route changes.

---

## ✨ Features

* **Hash-based navigation**: Uses `window.location.hash` to define routes.
* **Current route access**: `useRoute()` returns the active route.
* **Reactive listeners**: `onRouteChange(fn)` lets you re-render or update state when route changes.
* **Programmatic navigation**: `navigate(path)` updates the route in code.
* **Automatic sync**: `initRouter()` listens for browser `hashchange` events.

---

## 📂 Main Functions

* **`useRoute()`** → Returns the current route string.
  Example: `"/"`, `"/active"`, `"/completed"`.

* **`onRouteChange(listener)`** → Subscribe to route changes.
  Example:

  ```js
  onRouteChange((route) => {
    console.log("Now at:", route);
    renderApp(App, appContainer);
  });
  ```

* **`navigate(path)`** → Change route programmatically (also updates hash).
  Example:

  ```js
  navigate("/completed");
  ```

* **`initRouter()`** → Starts listening to `hashchange` events.
  Must be called **once at app startup**.

---

## 🛠️ Usage

```js
import { initRouter, onRouteChange, useRoute, navigate } from "./framework/router.js";

initRouter();

onRouteChange(() => {
  renderApp(App, document.getElementById("app"));
});

function App() {
  const route = useRoute();
  return {
    type: "div",
    props: {},
    children: [`Current route: ${route}`]
  };
}
```

---

## ⚡ Notes

* Routes are simple **hash fragments** (e.g. `#/active`), so no server config is needed.
* Default route is `"/"`.
* Works well for small apps like TodoMVC where filters (`all`, `active`, `completed`) are just different views of the same data.

---

## state.js

---

# 🗄️ Mini State Manager (`state.js`)

This file implements a **very simple global state system** inspired by React’s `useState`.
It lets you store values, read them with getters, and update them with setters.

---

## ✨ Features

* **Global state store**: All states live in a shared `stateStore` object.
* **One-time initialization**: A key is initialized only on first call.
* **Getter + Setter pair**: Returned just like `[state, setState]` in React.
* **Persistent across renders**: State survives re-renders because it’s stored globally.

---

## 📂 Main Function

### `useState(key, initialValue)`

Creates or retrieves a piece of state.

* `key`: A unique identifier string for this state (e.g. `"tasks"`, `"input"`).
* `initialValue`: The value to use the first time the state is created.

Returns:

```js
[getter, setter]
```

* **`getter()`** → Returns the current value.
* **`setter(newValue)`** → Updates the value.

---

## 🛠️ Usage

```js
import { useState } from "./framework/state.js";

// Define state
const [getInput, setInput] = useState("taskInput", "");
const [getTasks, setTasks] = useState("tasks", []);

// Use state in components
function App() {
  return {
    type: "div",
    props: {},
    children: [
      {
        type: "input",
        props: {
          value: getInput(),
          oninput: (e) => setInput(e.target.value),
        },
        children: []
      },
      {
        type: "button",
        props: {
          onclick: () => setTasks([...getTasks(), getInput()])
        },
        children: ["Add Task"]
      }
    ]
  };
}
```

---

## ⚡ Notes

* State is **global by key** — if two components use `"tasks"`, they share the same data.
* To trigger a re-render, you must call your renderer manually (e.g. `renderApp(App, container)`).
* This design is minimal and predictable, but not reactive by itself — it’s the renderer that makes updates visible.

---

