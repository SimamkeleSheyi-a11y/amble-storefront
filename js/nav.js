
import { api, getAccessToken, restoreSession } from "./api.js";
import { guestCartCount } from "./guest-cart.js";
import { subscribe, setState } from "./state.js";
import { getTheme, toggleTheme } from "./theme.js";
import { initNetworkStatus } from "./reliability.js";

initNetworkStatus();

const ICONS = {
  sun: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/></svg>',
  moon: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  cart: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 3h2l2.2 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.7L20.5 7H6"/><circle cx="10" cy="20" r="1.2"/><circle cx="18" cy="20" r="1.2"/></svg>',
  orders: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/></svg>',
  heart: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>',
  menu: '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  close: '<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  arrow: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m9 18 6-6-6-6"/></svg>',
};

function updateCartBadge(count) {
  const badge = document.getElementById("cart-count");
  if (!badge) return;
  badge.textContent = String(count);
  badge.hidden = Number(count) === 0;
}

export async function renderNav(activePage) {
  const root = document.getElementById("site-nav");
  if (!root) return;
  root.className = "site-header";
  root.innerHTML = `
    <div class="announcement"><div class="container announcement__inner"><span class="announcement__dot"></span><span>PayShap-ready checkout · Local simulator active</span></div></div>
    <div class="nav"><div class="container nav__inner">
      <div class="nav__left"><button class="menu-button" type="button" id="menu-open" aria-label="Open menu">${ICONS.menu}</button>
        <ul class="nav__links" aria-label="Primary navigation"><li><a href="/index.html" ${activePage === "shop" ? 'aria-current="page"' : ""}>Shop</a></li><li><a href="/index.html#collection">New arrivals</a></li></ul>
      </div>
      <a href="/index.html" class="nav__wordmark" aria-label="AMBLE home">AMBLE</a>
      <div class="nav__actions">
        <a href="/login.html" class="nav__account" id="nav-account-link">Log in</a>
        <button type="button" class="icon-button" id="theme-toggle" aria-label="Switch color theme">${getTheme() === "dark" ? ICONS.sun : ICONS.moon}</button>
        <a href="/wishlist.html" class="icon-button" aria-label="Wishlist">${ICONS.heart}</a>
        <a href="/orders.html" class="icon-button nav__orders" aria-label="Order history">${ICONS.orders}</a>
        <a href="/cart.html" class="icon-button" aria-label="Cart">${ICONS.cart}<span class="cart-count" id="cart-count" hidden>0</span></a>
      </div>
    </div></div>
    <div class="mobile-menu" id="mobile-menu" aria-hidden="true">
      <button class="mobile-menu__backdrop" type="button" aria-label="Close menu" data-close-menu></button>
      <div class="mobile-menu__panel" role="dialog" aria-modal="true" aria-label="Navigation menu">
        <div class="mobile-menu__head"><span class="nav__wordmark">AMBLE</span><button class="icon-button" type="button" aria-label="Close menu" data-close-menu>${ICONS.close}</button></div>
        <nav class="mobile-menu__links">
          <a href="/index.html"><span>Shop</span>${ICONS.arrow}</a><a href="/wishlist.html"><span>Wishlist</span>${ICONS.arrow}</a>
          <a href="/orders.html"><span>Order history</span>${ICONS.arrow}</a><a href="/cart.html"><span>Your cart</span>${ICONS.arrow}</a>
          <a href="/login.html" id="mobile-account-link"><span>Log in</span>${ICONS.arrow}</a>
        </nav>
      </div>
    </div>`;

  const themeButton = document.getElementById("theme-toggle");
  themeButton?.addEventListener("click", () => { toggleTheme(); themeButton.innerHTML = getTheme() === "dark" ? ICONS.sun : ICONS.moon; });
  const menu = document.getElementById("mobile-menu");
  const openMenu = () => { menu?.setAttribute("aria-hidden", "false"); document.body.classList.add("menu-open"); };
  const closeMenu = () => { menu?.setAttribute("aria-hidden", "true"); document.body.classList.remove("menu-open"); };
  document.getElementById("menu-open")?.addEventListener("click", openMenu);
  root.querySelectorAll("[data-close-menu]").forEach((button) => button.addEventListener("click", closeMenu));
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeMenu(); });

  subscribe((state) => updateCartBadge(state.cartCount));
  window.addEventListener("amble:guest-cart", () => { if (!getAccessToken()) updateCartBadge(guestCartCount()); });

  await restoreSession();
  if (!getAccessToken()) {
    setState({ cartCount: guestCartCount() });
    return;
  }

  const accountLink = document.getElementById("nav-account-link");
  const mobileAccountLink = document.getElementById("mobile-account-link");
  if (accountLink) { accountLink.textContent = "Account"; accountLink.href = "/account.html"; }
  if (mobileAccountLink) { mobileAccountLink.innerHTML = `<span>Account settings</span>${ICONS.arrow}`; mobileAccountLink.href = "/account.html"; }
  try {
    const cart = await api.get("/cart/");
    setState({ cartCount: Number(cart.item_count || 0) });
  } catch { /* non-critical */ }
}

export function renderFooter() {
  const root = document.getElementById("site-footer");
  if (!root) return;
  root.className = "footer";
  root.innerHTML = `
    <div class="container footer__grid">
      <div><a class="footer__brand" href="/index.html">AMBLE</a><p class="footer__copy">Thoughtful footwear and leather goods with a warm, lived-in character.</p></div>
      <div><h2 class="footer__title">Shop</h2><ul class="footer__links"><li><a href="/index.html">All products</a></li><li><a href="/wishlist.html">Wishlist</a></li><li><a href="/cart.html">Your cart</a></li></ul></div>
      <div><h2 class="footer__title">Account</h2><ul class="footer__links"><li><a href="/account.html">Account settings</a></li><li><a href="/orders.html">Order history</a></li><li><a href="/forgot-password.html">Reset password</a></li></ul></div>
      <div><h2 class="footer__title">About</h2><ul class="footer__links"><li><a href="/index.html#story">Our approach</a></li><li><a href="mailto:hello@amble.example">Contact</a></li><li><span>PayShap-ready demo store</span></li></ul></div>
    </div>
    <div class="container footer__bottom"><span>© ${new Date().getFullYear()} AMBLE</span><span>Created by S.Sheyi</span></div>`;
}
