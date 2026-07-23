// Deliberately small: a plain object plus subscribe/publish. There's no
// framework here to justify anything heavier — see ARCHITECTURE.md.

const state = {
  user: null,
  cartCount: 0,
};

const listeners = new Set();

export function getState() {
  return state;
}

export function setState(partial) {
  Object.assign(state, partial);
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
