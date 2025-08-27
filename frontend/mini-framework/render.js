// Simple and reliable renderer with diff system
// JSX-like VDOM creator
export function jsx(type, props, ...children) {
  // Flatten children array and filter out null/undefined
  const flatChildren = children
    .flat(Infinity)
    .filter(child => child != null)
    .map(child => typeof child === 'object' ? child : String(child));
    
  return { 
    type, 
    props: props || {}, 
    children: flatChildren
  };
}
let currentVDOM = null;
let rootElement = null;

function createElement(vnode) {
  if (typeof vnode === "string") {
    return document.createTextNode(vnode);
  }

  const el = document.createElement(vnode.type);

  // Apply props
  for (const [key, value] of Object.entries(vnode.props || {})) {
    if (key === "key") continue;
    
    if (key === "ref" && value) {
      value.current = el;
    } else if (key.startsWith("on")) {
      el[key.toLowerCase()] = value;
    } else if (key === "class") {
      el.className = value || "";
    } else if (key === "id") {
      el.id = value || "";
    } else if (key in el) {
      el[key] = value;
    } else {
      if (value != null && value !== false) {
        el.setAttribute(key, value === true ? "" : value);
      }
    }
  }

  // Children
  (vnode.children || []).forEach((child) => {
    el.appendChild(createElement(child));
  });

  return el;
}

function isSameType(oldNode, newNode) {
  if (typeof oldNode !== typeof newNode) return false;
  if (typeof oldNode === "string") return true;
  return oldNode.type === newNode.type;
}

function getKey(node) {
  return typeof node === "string" ? null : node.props?.key;
}

function updateProps(element, newProps, oldProps) {
  const allProps = { ...oldProps, ...newProps };
  
  for (const key in allProps) {
    const newValue = newProps[key];
    const oldValue = oldProps[key];
    
    if (key === "key") continue;
    if (key.startsWith("on")) {
     
      element[key.toLowerCase()] = newValue || null;
    } else if (key === "class") {
      element.className = newValue || "";
    } else if (key === "id") {
      element.id = newValue || "";
    } else if (key === "value") {
      if (element.value !== newValue) {
        const isActive = element === document.activeElement;
        const start = isActive ? element.selectionStart : null;
        const end = isActive ? element.selectionEnd : null;
        element.value = newValue || "";
        if (isActive && start !== null && end !== null) {
          element.setSelectionRange(start, end);
        }
      }


    } else if (key in element) {
      element[key] = newValue;
    } else {
      if (newValue != null && newValue !== false) {
        element.setAttribute(key, newValue === true ? "" : newValue);
      } else if (oldValue != null) {
        element.removeAttribute(key);
      }
    }
  }
}

function diffChildren(parentElement, newChildren, oldChildren) {
  // For better list diffing, check if we're dealing with keyed children
  const hasKeys = newChildren.some(child => getKey(child) != null) || 
                  oldChildren.some(child => getKey(child) != null);
  
  if (hasKeys) {
    // Use keyed diffing for lists
    diffKeyedChildren(parentElement, newChildren, oldChildren);
  } else {
    // Use simple position-based diffing
    diffSimpleChildren(parentElement, newChildren, oldChildren);
  }
}

function diffKeyedChildren(parentElement, newChildren, oldChildren) {
  const oldKeyToIndex = {};
  const oldElements = Array.from(parentElement.childNodes);
  
  // Build old key map
  oldChildren.forEach((child, index) => {
    const key = getKey(child);
    if (key != null) {
      oldKeyToIndex[key] = index;
    }
  });
  
  // Process new children

  for (let newIndex = 0; newIndex < newChildren.length; newIndex++) {
    const newChild = newChildren[newIndex];
    const newKey = getKey(newChild);
    
    if (newKey != null && oldKeyToIndex.hasOwnProperty(newKey)) {
      // Found matching key - reuse existing element
      const oldElementIndex = oldKeyToIndex[newKey];
      const oldElement = oldElements[oldElementIndex];
      const oldChild = oldChildren[oldElementIndex];
      
      // Move element to correct position if needed
      if (parentElement.childNodes[newIndex] !== oldElement) {
        parentElement.insertBefore(oldElement, parentElement.childNodes[newIndex] || null);
      }
      
      // Update the element
      if (typeof newChild !== "string") {
        updateProps(oldElement, newChild.props || {}, oldChild.props || {});
        diffChildren(oldElement, newChild.children || [], oldChild.children || []);
      }
    } else {
      // New element - create and insert
      const newElement = createElement(newChild);
      parentElement.insertBefore(newElement, parentElement.childNodes[newIndex] || null);
    }
  }
  
  // Remove any remaining old elements
  while (parentElement.childNodes.length > newChildren.length) {
    parentElement.removeChild(parentElement.lastChild);
  }
}

function diffSimpleChildren(parentElement, newChildren, oldChildren) {
  // Handle removals first (from end to start to avoid index issues)
  for (let i = oldChildren.length - 1; i >= newChildren.length; i--) {
    if (parentElement.childNodes[i]) {
      parentElement.removeChild(parentElement.childNodes[i]);
    }
  }
  
  // Handle updates and additions
  for (let i = 0; i < newChildren.length; i++) {
    const newChild = newChildren[i];
    const oldChild = oldChildren[i];
    const childElement = parentElement.childNodes[i];
    
    if (!oldChild) {
      // Add new child
      parentElement.appendChild(createElement(newChild));
    } else if (childElement) {
      if (isSameType(oldChild, newChild)) {
        // Update existing child
        if (typeof newChild === "string") {
          if (newChild !== oldChild) {
            childElement.textContent = newChild;
          }
        } else {
          updateProps(childElement, newChild.props || {}, oldChild.props || {});
          diffChildren(childElement, newChild.children || [], oldChild.children || []);
        }
      } else {
        // Replace child
        parentElement.replaceChild(createElement(newChild), childElement);
      }
    }
  }
}

export function renderApp(component, appContainer) {
  const newVDOM = component();

  if (!currentVDOM || !rootElement) {
    // First render
    appContainer.innerHTML = "";
    rootElement = createElement(newVDOM);
    appContainer.appendChild(rootElement);
  } else {
    // Diff and update
    if (isSameType(currentVDOM, newVDOM)) {
      updateProps(rootElement, newVDOM.props || {}, currentVDOM.props || {});
      diffChildren(rootElement, newVDOM.children || [], currentVDOM.children || []);
    } else {
      // Replace entire root
      const newRoot = createElement(newVDOM);
      appContainer.replaceChild(newRoot, rootElement);
      rootElement = newRoot;
    }
  }
  
  currentVDOM = newVDOM;
}
