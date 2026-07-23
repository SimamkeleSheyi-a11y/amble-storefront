import { api, firstErrorMessage, formatCurrency } from "../api.js";
import { renderFooter, renderNav } from "../nav.js";

renderNav();
renderFooter();

const root = document.getElementById("guest-order-result");
const token = new URLSearchParams(location.search).get("token");

function escapeHtml(value) {
  const element = document.createElement("div");
  element.textContent = value ?? "";
  return element.innerHTML;
}

function line(item) {
  const option = item.variant_label ? ` <small>(${escapeHtml(item.variant_label)})</small>` : "";
  return `<div class="order-line"><span>${item.quantity} × ${escapeHtml(item.product_name)}${option}</span><span>${formatCurrency(item.subtotal)}</span></div>`;
}

async function load() {
  if (!token) {
    root.innerHTML = '<h1>Order link is incomplete</h1><p>Use the secure link from your AMBLE receipt.</p>';
    return;
  }
  try {
    const order = await api.get(`/orders/guest/${encodeURIComponent(token)}/`);
    root.innerHTML = `<p class="eyebrow">Guest order</p><h1 class="confirmation-card__title">Order #${order.id}</h1><div class="order-badges"><span class="status-badge status-badge--${escapeHtml(order.status)}">${escapeHtml(order.status_label)}</span><span class="status-badge status-badge--payment">${escapeHtml(order.payment_status_label)}</span></div><div class="order-lines">${order.items.map(line).join("")}</div><div class="order-costs"><div class="summary-row"><span>Subtotal</span><span>${formatCurrency(order.subtotal_amount)}</span></div>${Number(order.discount_amount) ? `<div class="summary-row"><span>Discount ${escapeHtml(order.coupon_code)}</span><span>−${formatCurrency(order.discount_amount)}</span></div>` : ""}<div class="summary-row"><span>Delivery</span><span>${formatCurrency(order.shipping_fee)}</span></div><div class="summary-row summary-row--total"><span>Total</span><span>${formatCurrency(order.total_amount)}</span></div></div><p><strong>Delivery to:</strong> ${escapeHtml(order.shipping_full_name)}, ${escapeHtml(order.shipping_address_line1)}, ${escapeHtml(order.shipping_city)}, ${escapeHtml(order.shipping_postal_code)}</p><p>${escapeHtml(order.estimated_delivery_days || "")}</p><div class="confirmation-card__actions"><a class="btn btn--primary" href="/index.html">Continue shopping</a></div>`;
  } catch (error) {
    root.innerHTML = `<h1>Couldn't load this order</h1><p>${escapeHtml(firstErrorMessage(error))}</p><button class="btn btn--primary" id="retry">Try again</button>`;
    document.getElementById("retry")?.addEventListener("click", load);
  }
}

load();
