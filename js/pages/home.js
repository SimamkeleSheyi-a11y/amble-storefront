
import { api, firstErrorMessage, formatCurrency, getAccessToken, resolveMediaUrl, restoreSession } from "../api.js";
import { addGuestItem, guestCartCount } from "../guest-cart.js";
import { renderFooter, renderNav } from "../nav.js";
import { getLocalRecentProducts } from "../recent.js";
import { setState } from "../state.js";
import { showToast } from "../toast.js";

renderNav("shop");
renderFooter();

const gridContainer = document.getElementById("product-grid-container");
const chipsContainer = document.getElementById("category-chips");
const searchInput = document.getElementById("search-input");
const sortSelect = document.getElementById("sort-select");
const productCount = document.getElementById("product-count");
let activeCategory = new URLSearchParams(window.location.search).get("category") || "";
let activeSearch = "";
let activeSort = "featured";
let requestSequence = 0;
const quickAddsInFlight = new Set();

const ICON_CART = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3h2l2.2 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.7L20.5 7H6"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>';
function escapeHtml(value) { const div = document.createElement("div"); div.textContent = value ?? ""; return div.innerHTML; }
function prettifySlug(slug) { return String(slug ?? "").replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function categoryName(product) { const category = product?.category; return category && typeof category === "object" ? category.name || prettifySlug(category.slug) : prettifySlug(category); }
function productImage(product) { const first = Array.isArray(product.images) ? product.images[0] : null; return resolveMediaUrl(product.primary_image || product.image || (typeof first === "string" ? first : first?.image)); }
function stars(product) { const value = Number(product.average_rating || 0); return product.review_count ? `<span class="rating-inline" aria-label="${value} out of 5 stars">★ ${value.toFixed(1)} <small>(${product.review_count})</small></span>` : ""; }

function productCard(product, index = 0) {
  const imageUrl = productImage(product);
  const category = categoryName(product) || "AMBLE";
  const badge = !product.in_stock ? "Sold out" : index < 2 ? "New" : "";
  return `<article class="product-card" data-product-id="${product.id}" data-product-slug="${escapeHtml(product.slug)}" data-product-name="${escapeHtml(product.name)}" data-product-price="${product.price}" data-product-stock="${product.available_stock || 0}" data-product-image="${escapeHtml(imageUrl)}" data-product-category="${escapeHtml(category)}" data-has-variants="${Boolean(product.has_variants)}">
    <div class="product-card__media${imageUrl ? "" : " product-visual--empty"}" data-label="${escapeHtml(category)}">
      <a class="product-card__media-link" href="/product.html?slug=${encodeURIComponent(product.slug)}" aria-label="View ${escapeHtml(product.name)}">${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(product.name)}" loading="lazy" data-product-image-el />` : ""}</a>
      ${badge ? `<span class="product-card__badge">${badge}</span>` : ""}
      <button class="product-card__quick" type="button" ${product.in_stock ? "" : "disabled"} data-quick-add>${product.in_stock ? (product.has_variants ? "<span>Choose options</span>" : `${ICON_CART}<span>Quick add</span>`) : "Unavailable"}</button>
    </div>
    <a class="product-card__body" href="/product.html?slug=${encodeURIComponent(product.slug)}"><p class="product-card__category">${escapeHtml(category)}</p><div class="product-card__topline"><h3 class="product-card__name">${escapeHtml(product.name)}</h3><p class="product-card__price">${formatCurrency(product.price)}</p></div>${stars(product)}<p class="product-card__stock ${product.in_stock ? "" : "product-card__stock--out"}">${product.in_stock ? "In stock" : "Currently unavailable"}</p></a>
  </article>`;
}
function skeletonGrid(count = 8) { return `<div class="product-grid">${'<div class="product-card"><div class="skeleton skeleton-card__image"></div><div class="skeleton skeleton-line"></div></div>'.repeat(count)}</div>`; }
function sortProducts(products) { const copy = [...products]; if (activeSort === "price-low") copy.sort((a,b)=>Number(a.price)-Number(b.price)); if (activeSort === "price-high") copy.sort((a,b)=>Number(b.price)-Number(a.price)); if (activeSort === "name") copy.sort((a,b)=>String(a.name).localeCompare(String(b.name))); return copy; }
function updateAddressBar() { const url = new URL(window.location.href); activeCategory ? url.searchParams.set("category", activeCategory) : url.searchParams.delete("category"); window.history.replaceState({}, "", url); }

async function loadCategories() {
  try {
    const response = await api.get("/catalog/categories/");
    for (const category of response.results ?? response) {
      const chip = document.createElement("button"); chip.type = "button"; chip.className = "chip"; chip.textContent = category.name; chip.dataset.category = category.slug; chip.setAttribute("aria-pressed", String(category.slug === activeCategory));
      chip.addEventListener("click", () => selectCategory(category.slug, chip)); chipsContainer.appendChild(chip);
    }
    chipsContainer.querySelector('[data-category=""]')?.setAttribute("aria-pressed", String(!activeCategory));
  } catch { /* catalog still works */ }
}
function selectCategory(slug, chip) { activeCategory = slug; chipsContainer.querySelectorAll(".chip").forEach((item)=>item.setAttribute("aria-pressed", String(item === chip))); updateAddressBar(); loadProducts(); }
chipsContainer?.addEventListener("click", (event) => { const chip = event.target.closest(".chip"); if (chip?.dataset.category === "") selectCategory("", chip); });
let searchTimer;
searchInput?.addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(()=>{ activeSearch = searchInput.value.trim(); loadProducts(); }, 280); });
sortSelect?.addEventListener("change", () => { activeSort = sortSelect.value; loadProducts(); });

async function quickAdd(button) {
  if (quickAddsInFlight.has(button)) return;
  quickAddsInFlight.add(button);
  const card = button.closest(".product-card");
  const hasVariants = card?.dataset.hasVariants === "true";
  const slug = card?.dataset.productSlug || "";
  if (hasVariants) { window.location.href = `/product.html?slug=${encodeURIComponent(slug)}`; return; }
  const original = button.innerHTML; button.disabled = true; button.textContent = "Adding…";
  try {
    await restoreSession();
    if (getAccessToken()) {
      await api.post("/cart/items/", { product: Number(card.dataset.productId), quantity: 1 });
      const cart = await api.get("/cart/"); setState({ cartCount: Number(cart.item_count || 0) });
    } else {
      addGuestItem({ product: Number(card.dataset.productId), variant: null, product_slug: slug, product_name: card.dataset.productName, product_category: card.dataset.productCategory, product_image: card.dataset.productImage, unit_price: card.dataset.productPrice, available_stock: Number(card.dataset.productStock || 99), quantity: 1 });
      setState({ cartCount: guestCartCount() });
    }
    showToast(`${card.dataset.productName} added to your cart`); button.textContent = "Added ✓";
  } catch (error) { showToast(firstErrorMessage(error), "error"); button.innerHTML = original; button.disabled = false; quickAddsInFlight.delete(button); return; }
  setTimeout(()=>{ button.innerHTML = original; button.disabled = false; quickAddsInFlight.delete(button); }, 1100);
}
gridContainer?.addEventListener("click", (event)=>{ const button = event.target.closest("[data-quick-add]"); if (button) quickAdd(button); });

async function loadProducts() {
  const sequence = ++requestSequence; gridContainer.setAttribute("aria-busy", "true"); gridContainer.innerHTML = skeletonGrid(); if (productCount) productCount.textContent = "Loading…";
  const params = new URLSearchParams(); if (activeCategory) params.set("category", activeCategory); if (activeSearch) params.set("search", activeSearch);
  try {
    const response = await api.get(`/catalog/products/${params.size ? `?${params}` : ""}`); if (sequence !== requestSequence) return;
    const products = sortProducts(response.results ?? response); if (productCount) productCount.textContent = `${products.length} product${products.length === 1 ? "" : "s"}`;
    gridContainer.innerHTML = products.length ? `<div class="product-grid">${products.map(productCard).join("")}</div>` : `<div class="state-message"><div class="state-message__inner"><h2 class="state-message__title">Nothing matched</h2><p class="state-message__copy">Try another category or search term.</p></div></div>`;
  } catch (error) {
    if (sequence !== requestSequence) return; if (productCount) productCount.textContent = "Unavailable";
    gridContainer.innerHTML = `<div class="state-message"><div class="state-message__inner"><h2 class="state-message__title">Couldn't load products</h2><p class="state-message__copy">${escapeHtml(firstErrorMessage(error))}</p><button class="btn btn--primary" id="retry-products">Try again</button></div></div>`;
    document.getElementById("retry-products")?.addEventListener("click", loadProducts);
  } finally { if (sequence === requestSequence) gridContainer.removeAttribute("aria-busy"); }
}

async function loadRecent() {
  const section = document.getElementById("recent-section"); const grid = document.getElementById("recent-grid"); if (!section || !grid) return;
  await restoreSession();
  let products = [];
  if (getAccessToken()) {
    try { const response = await api.get("/catalog/recently-viewed/"); products = (response.results ?? response).map((entry)=>entry.product); } catch { products = []; }
  } else products = getLocalRecentProducts();
  if (!products.length) return;
  grid.innerHTML = products.slice(0, 4).map(productCard).join(""); section.hidden = false;
}

loadCategories(); loadProducts(); loadRecent();
