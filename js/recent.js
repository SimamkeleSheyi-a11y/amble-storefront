
const KEY = "amble-recent-products-v1";

export function rememberRecentProduct(product) {
  try {
    const current = JSON.parse(localStorage.getItem(KEY) || "[]");
    const items = Array.isArray(current) ? current : [];
    const next = [product, ...items.filter((item) => item.slug !== product.slug)].slice(0, 8);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Browsing still works when storage is unavailable.
  }
}

export function getLocalRecentProducts() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
