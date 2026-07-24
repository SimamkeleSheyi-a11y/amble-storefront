import { api, firstErrorMessage, requireAuth, resolveMediaUrl } from "../api.js";
import { renderFooter, renderNav } from "../nav.js";
import { setState } from "../state.js";
import { showToast } from "../toast.js";

renderNav();
renderFooter();

const container = document.getElementById("cart-container");

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

function itemImage(item) {
  return resolveMediaUrl(
    item.product_image ||
    item.primary_image ||
    item.image ||
    item.product?.primary_image ||
    item.product?.images?.[0]?.image
  );
}

function itemCategory(item) {
  const value = item.product_category || item.category || item.product?.category;
  if (value && typeof value === "object") return value.name || value.slug || "AMBLE";
  return String(value || "AMBLE").replace(/-/g, " ");
}

function lineTemplate(item) {
  const image = itemImage(item);
  const category = itemCategory(item);
  const slug = item.product_slug || item.product?.slug || "";
  const productLink = slug ? `/product.html?slug=${encodeURIComponent(slug)}` : "/index.html";

  return `
    <article class="cart-line" data-item-id="${item.id}">
      <a href="${productLink}" class="cart-line__image${image ? "" : " product-visual--empty"}" data-label="${escapeHtml(category)}">
        ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(item.product_name)}" data-cart-image />` : ""}
      </a>
      <div class="cart-line__body">
        <p class="cart-line__category">${escapeHtml(category)}</p>
        <a href="${productLink}" class="cart-line__name">${escapeHtml(item.product_name)}</a>
        <p class="cart-line__price">$${escapeHtml(item.unit_price)} each</p>
        <div class="cart-line__controls">
          <div class="stepper">
            <button type="button" class="qty-minus" aria-label="Decrease ${escapeHtml(item.product_name)} quantity">−</button>
            <input type="number" class="qty-input" value="${item.quantity}" min="1" inputmode="numeric" aria-label="${escapeHtml(item.product_name)} quantity" />
            <button type="button" class="qty-plus" aria-label="Increase ${escapeHtml(item.product_name)} quantity">+</button>
          </div>
          <button type="button" class="cart-line__remove">Remove</button>
        </div>
      </div>
      <p class="cart-line__subtotal">$${escapeHtml(item.subtotal)}</p>
    </article>`;
}

function emptyState() {
  container.innerHTML = `
    <div class="state-message">
      <div class="state-message__inner">
        <div class="state-message__icon" aria-hidden="true">
          <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 3h2l2.2 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.7L20.5 7H6"/><circle cx="10" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg>
        </div>
        <h2 class="state-message__title">Your cart is waiting</h2>
        <p class="state-message__copy">Add something from the collection and it will appear here.</p>
        <div class="state-message__actions"><a class="btn btn--primary" href="/index.html#collection">Browse the collection</a></div>
      </div>
    </div>`;
}

async function load() {
  if (!(await requireAuth())) return;

  try {
    const cart = await api.get("/cart/");
    render(cart);
  } catch (error) {
    container.innerHTML = `
      <div class="state-message">
        <div class="state-message__inner">
          <div class="state-message__icon" aria-hidden="true">!</div>
          <h2 class="state-message__title">Couldn't load your cart</h2>
          <p class="state-message__copy">${escapeHtml(firstErrorMessage(error))}</p>
          <div class="state-message__actions"><button class="btn btn--primary" id="retry-cart" type="button">Try again</button></div>
        </div>
      </div>`;
    document.getElementById("retry-cart")?.addEventListener("click", load);
  }
}

function render(cart) {
  if (!cart.items?.length) {
    emptyState();
    setState({ cartCount: 0 });
    return;
  }

  const count = Number(cart.item_count || 0);
  container.innerHTML = `
    <div class="cart-layout">
      <section aria-label="Cart items">
        <div class="cart-lines">${cart.items.map(lineTemplate).join("")}</div>
        <p class="form-error" id="cart-error" role="alert"></p>
      </section>
      <aside class="order-summary" aria-labelledby="summary-title">
        <h2 class="order-summary__title" id="summary-title">Order summary</h2>
        <div class="summary-row"><span>Subtotal (${count} item${count === 1 ? "" : "s"})</span><span>$${escapeHtml(cart.total)}</span></div>
        <div class="summary-row"><span>Delivery</span><span>Free</span></div>
        <div class="summary-row summary-row--total"><span>Total</span><span>$${escapeHtml(cart.total)}</span></div>
        <div class="summary-note">
          <strong>Free delivery unlocked</strong>
          <div class="progress" aria-hidden="true"><div class="progress__bar"></div></div>
        </div>
        <a href="/checkout.html" class="btn btn--primary btn--block">Continue to checkout</a>
        <a href="/index.html#collection" class="btn btn--ghost btn--block">Keep shopping</a>
      </aside>
    </div>`;

  setState({ cartCount: count });
  wireLines();
  wireImageFallbacks();
}

function wireImageFallbacks() {
  container.querySelectorAll("[data-cart-image]").forEach((image) => {
    image.addEventListener("error", () => {
      const wrap = image.closest(".cart-line__image");
      image.remove();
      wrap?.classList.add("product-visual--empty");
    }, { once: true });
  });
}

function wireLines() {
  container.querySelectorAll(".cart-line").forEach((line) => {
    const itemId = line.dataset.itemId;
    const qtyInput = line.querySelector(".qty-input");

    const setQuantity = (next) => {
      const quantity = Math.max(1, Number(next) || 1);
      qtyInput.value = String(quantity);
      updateQuantity(itemId, quantity, line);
    };

    line.querySelector(".qty-minus")?.addEventListener("click", () => setQuantity(Number(qtyInput.value) - 1));
    line.querySelector(".qty-plus")?.addEventListener("click", () => setQuantity(Number(qtyInput.value) + 1));
    qtyInput.addEventListener("change", () => setQuantity(qtyInput.value));
    line.querySelector(".cart-line__remove")?.addEventListener("click", () => removeItem(itemId, line));
  });
}

function setLineBusy(line, busy) {
  line.querySelectorAll("button, input").forEach((control) => {
    control.disabled = busy;
  });
  line.style.opacity = busy ? "0.62" : "";
}

async function updateQuantity(itemId, quantity, line) {
  setLineBusy(line, true);
  try {
    await api.patch(`/cart/items/${itemId}/`, { quantity });
    await load();
  } catch (error) {
    const message = firstErrorMessage(error);
    await load();
    const errorEl = document.getElementById("cart-error");
    if (errorEl) errorEl.textContent = message;
    showToast(message, "error");
  }
}

async function removeItem(itemId, line) {
  setLineBusy(line, true);
  try {
    await api.delete(`/cart/items/${itemId}/`);
    showToast("Removed from your cart");
    await load();
  } catch (error) {
    setLineBusy(line, false);
    showToast(firstErrorMessage(error), "error");
  }
}

load();
