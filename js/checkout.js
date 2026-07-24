import { api, firstErrorMessage, requireAuth, resolveMediaUrl } from "../api.js";
import { renderFooter, renderNav } from "../nav.js";
import { setState } from "../state.js";

renderNav();
renderFooter();

const container = document.getElementById("checkout-container");

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

function itemImage(item) {
  return resolveMediaUrl(item.product_image || item.primary_image || item.image || item.product?.primary_image);
}

function checkoutItem(item) {
  const image = itemImage(item);
  return `
    <div class="checkout-item">
      <div class="checkout-item__image${image ? "" : " product-visual--empty"}" data-label="AMBLE">
        ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(item.product_name)}" />` : ""}
      </div>
      <div>
        <p class="checkout-item__name">${escapeHtml(item.product_name)}</p>
        <p class="checkout-item__meta">Quantity ${item.quantity}</p>
      </div>
      <p class="checkout-item__price">$${escapeHtml(item.subtotal)}</p>
    </div>`;
}

async function load() {
  if (!(await requireAuth())) return;

  try {
    const cart = await api.get("/cart/");
    if (!cart.items?.length) {
      renderEmpty();
      return;
    }
    renderForm(cart);
  } catch (error) {
    renderError(firstErrorMessage(error));
  }
}

function renderEmpty() {
  container.innerHTML = `
    <div class="state-message">
      <div class="state-message__inner">
        <div class="state-message__icon" aria-hidden="true">⌁</div>
        <h1 class="state-message__title">Your cart is empty</h1>
        <p class="state-message__copy">Add an item before heading to checkout.</p>
        <div class="state-message__actions"><a class="btn btn--primary" href="/index.html#collection">Browse products</a></div>
      </div>
    </div>`;
}

function renderError(message) {
  container.innerHTML = `
    <div class="state-message">
      <div class="state-message__inner">
        <div class="state-message__icon" aria-hidden="true">!</div>
        <h1 class="state-message__title">Couldn't load checkout</h1>
        <p class="state-message__copy">${escapeHtml(message)}</p>
        <div class="state-message__actions"><button class="btn btn--primary" type="button" id="retry-checkout">Try again</button></div>
      </div>
    </div>`;
  document.getElementById("retry-checkout")?.addEventListener("click", load);
}

function renderForm(cart) {
  const count = Number(cart.item_count || 0);
  container.innerHTML = `
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="/index.html">Shop</a><span class="breadcrumbs__sep"></span>
      <a href="/cart.html">Cart</a><span class="breadcrumbs__sep"></span>
      <span aria-current="page">Checkout</span>
    </nav>
    <div class="page-heading">
      <div>
        <p class="page-heading__eyebrow">Final step</p>
        <h1 class="page-title">Checkout</h1>
      </div>
      <p class="page-subtitle">Enter a delivery address to create the order. This demo does not process a real payment.</p>
    </div>
    <div class="checkout-layout">
      <section class="checkout-card" aria-labelledby="shipping-title">
        <div class="checkout-card__head">
          <span class="checkout-card__step">01</span>
          <h2 class="checkout-card__title" id="shipping-title">Delivery details</h2>
        </div>
        <form class="form" id="checkout-form">
          <div class="form-field">
            <label for="shipping_full_name">Full name</label>
            <input type="text" id="shipping_full_name" name="shipping_full_name" autocomplete="name" required />
          </div>
          <div class="form-field">
            <label for="shipping_address_line1">Street address</label>
            <input type="text" id="shipping_address_line1" name="shipping_address_line1" autocomplete="address-line1" required />
          </div>
          <div class="form-field">
            <label for="shipping_address_line2">Apartment, suite or unit <span style="font-weight:400;color:var(--text-muted)">(optional)</span></label>
            <input type="text" id="shipping_address_line2" name="shipping_address_line2" autocomplete="address-line2" />
          </div>
          <div class="form-field form-field--split">
            <div class="form-field">
              <label for="shipping_city">City</label>
              <input type="text" id="shipping_city" name="shipping_city" autocomplete="address-level2" required />
            </div>
            <div class="form-field">
              <label for="shipping_postal_code">Postal code</label>
              <input type="text" id="shipping_postal_code" name="shipping_postal_code" autocomplete="postal-code" required />
            </div>
          </div>
          <div class="form-field">
            <label for="shipping_country">Country</label>
            <input type="text" id="shipping_country" name="shipping_country" autocomplete="country-name" value="South Africa" required />
          </div>
          <p class="form-error" id="form-error" role="alert"></p>
          <button type="submit" class="btn btn--primary btn--block" id="submit-button">Place demo order · $${escapeHtml(cart.total)}</button>
        </form>
      </section>
      <aside class="order-summary" aria-labelledby="checkout-summary-title">
        <h2 class="order-summary__title" id="checkout-summary-title">Your order</h2>
        <div class="checkout-items">${cart.items.map(checkoutItem).join("")}</div>
        <div class="summary-row"><span>Subtotal (${count} item${count === 1 ? "" : "s"})</span><span>$${escapeHtml(cart.total)}</span></div>
        <div class="summary-row"><span>Delivery</span><span>Free</span></div>
        <div class="summary-row summary-row--total"><span>Total</span><span>$${escapeHtml(cart.total)}</span></div>
        <p class="secure-note">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
          <span>No card details are collected. The backend creates a demo order only.</span>
        </p>
      </aside>
    </div>`;

  document.getElementById("checkout-form")?.addEventListener("submit", handleSubmit);
}

async function handleSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const errorEl = document.getElementById("form-error");
  const submitButton = document.getElementById("submit-button");
  errorEl.textContent = "";

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  submitButton.disabled = true;
  const previousLabel = submitButton.textContent;
  submitButton.textContent = "Placing your order…";

  const payload = {
    shipping_full_name: form.shipping_full_name.value.trim(),
    shipping_address_line1: form.shipping_address_line1.value.trim(),
    shipping_address_line2: form.shipping_address_line2.value.trim(),
    shipping_city: form.shipping_city.value.trim(),
    shipping_postal_code: form.shipping_postal_code.value.trim(),
    shipping_country: form.shipping_country.value.trim(),
  };

  let order;
  try {
    order = await api.post("/orders/checkout/", payload);
  } catch (error) {
    errorEl.textContent = firstErrorMessage(error);
    submitButton.disabled = false;
    submitButton.textContent = previousLabel;
    return;
  }

  setState({ cartCount: 0 });
  renderConfirmation(order);
}

function renderConfirmation(order) {
  container.innerHTML = `
    <div class="confirmation-card">
      <div class="confirmation-card__icon" aria-hidden="true">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m5 12 4 4L19 6"/></svg>
      </div>
      <p class="eyebrow" style="justify-content:center">Order confirmed</p>
      <h1 class="confirmation-card__title">Thank you. Your order is in.</h1>
      <p class="confirmation-card__copy">The order was created successfully and can now be viewed in your order history.</p>
      <p class="confirmation-card__number">Order #${escapeHtml(order.id)} · $${escapeHtml(order.total_amount)}</p>
      <div class="confirmation-card__actions">
        <a class="btn btn--primary" href="/orders.html">View order history</a>
        <a class="btn btn--secondary" href="/index.html">Continue shopping</a>
      </div>
    </div>`;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

load();
