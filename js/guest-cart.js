
const CART_KEY = "amble-guest-cart-v1";

function read() {
  try {
    const value = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function write(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("amble:guest-cart", { detail: { items } }));
  return items;
}

function keyFor(productId, variantId) {
  return `${productId}:${variantId || "base"}`;
}

export function getGuestCartItems() {
  return read();
}

export function guestCartCount() {
  return read().reduce((total, item) => total + Number(item.quantity || 0), 0);
}

export function addGuestItem(item) {
  const items = read();
  const key = keyFor(item.product, item.variant);
  const existing = items.find((entry) => entry.key === key);
  const max = Number(item.available_stock || 99);
  if (existing) {
    existing.quantity = Math.min(max, Number(existing.quantity || 0) + Number(item.quantity || 1));
  } else {
    items.push({ ...item, key, quantity: Math.min(max, Number(item.quantity || 1)) });
  }
  write(items);
  return items;
}

export function updateGuestItem(key, quantity) {
  const items = read();
  const item = items.find((entry) => entry.key === key);
  if (!item) return items;
  const max = Number(item.available_stock || 99);
  item.quantity = Math.max(1, Math.min(max, Number(quantity || 1)));
  write(items);
  return items;
}

export function removeGuestItem(key) {
  return write(read().filter((item) => item.key !== key));
}

export function clearGuestCart() {
  write([]);
}
