
import { ApiError, api, firstErrorMessage, formatCurrency, getAccessToken, resolveMediaUrl, restoreSession } from "../api.js";
import { addGuestItem, guestCartCount } from "../guest-cart.js";
import { renderFooter, renderNav } from "../nav.js";
import { rememberRecentProduct } from "../recent.js";
import { setState } from "../state.js";
import { showToast } from "../toast.js";

renderNav(); renderFooter();
const container = document.getElementById("product-container");
const relatedContainer = document.getElementById("related-products");
let productState = null; let addInFlight = false;
function escapeHtml(value) { const div = document.createElement("div"); div.textContent = value ?? ""; return div.innerHTML; }
function slugFromUrl() { return new URLSearchParams(location.search).get("slug"); }
function categoryInfo(product) { const c = product.category; return c && typeof c === "object" ? {name:c.name||"Collection", slug:c.slug||""} : {name:String(c||"Collection").replace(/-/g," "), slug:String(c||"")}; }
function imagesFor(product) { const values = Array.isArray(product.images) ? product.images : []; const seen = new Set(); return values.map((entry)=>({url:resolveMediaUrl(typeof entry === "string" ? entry : entry?.image), alt:typeof entry === "string" ? product.name : entry?.alt_text || product.name})).filter((entry)=>entry.url && !seen.has(entry.url) && seen.add(entry.url)); }
function stars(value) { const rating = Math.max(0, Math.min(5, Number(value || 0))); return "★★★★★".split("").map((star,index)=>`<span class="${index < Math.round(rating) ? "is-filled" : ""}">${star}</span>`).join(""); }
function primaryImage(product) { return imagesFor(product)[0]?.url || ""; }

async function load() {
  const slug = slugFromUrl(); relatedContainer.hidden = true;
  if (!slug) return renderError("No product selected", "Return to the shop and choose a product.", false);
  container.innerHTML = '<div class="product-skeleton"><div class="skeleton product-skeleton__media"></div><div class="product-skeleton__info"><div class="skeleton"></div><div class="skeleton"></div></div></div>';
  try {
    const product = await api.get(`/catalog/products/${encodeURIComponent(slug)}/`); productState = product; renderProduct(product);
    rememberRecentProduct({ id:product.id, slug:product.slug, name:product.name, price:product.price, category:product.category, primary_image:primaryImage(product), in_stock:product.in_stock, has_variants:product.has_variants, available_stock:product.available_stock, average_rating:product.average_rating, review_count:product.review_count });
    await restoreSession(); if (getAccessToken()) api.post(`/catalog/products/${encodeURIComponent(slug)}/view/`, {}).catch(()=>{});
    loadReviews(product); loadRelated(product);
  } catch (error) { const missing = error instanceof ApiError && error.status === 404; renderError(missing ? "Product not found" : "Couldn't load this product", missing ? "It may have been removed." : firstErrorMessage(error), !missing); }
}
function renderError(title, copy, retry=true) { container.innerHTML = `<div class="state-message"><div class="state-message__inner"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(copy)}</p>${retry?'<button class="btn btn--primary" id="retry-product">Try again</button>':""}<a class="btn btn--secondary" href="/index.html">Return to shop</a></div></div>`; document.getElementById("retry-product")?.addEventListener("click", load); }

function renderProduct(product) {
  const category = categoryInfo(product); const images = imagesFor(product); const main = images[0];
  const gallery = `<div class="product-gallery${images.length > 1 ? "" : " product-gallery--single"}">${images.length > 1 ? `<div class="product-gallery__thumbs">${images.map((image,index)=>`<button class="product-gallery__thumb" aria-current="${index===0}" data-image-index="${index}"><img src="${escapeHtml(image.url)}" alt=""></button>`).join("")}</div>`:""}<div class="product-gallery__main${main?"":" product-visual--empty"}" id="main-product-image-wrap" data-label="${escapeHtml(category.name)}">${main?`<img id="main-product-image" src="${escapeHtml(main.url)}" alt="${escapeHtml(main.alt)}">`:""}</div></div>`;
  container.innerHTML = `<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/index.html">Shop</a><span class="breadcrumbs__sep"></span><a href="/index.html?category=${encodeURIComponent(category.slug)}">${escapeHtml(category.name)}</a><span class="breadcrumbs__sep"></span><span>${escapeHtml(product.name)}</span></nav>
  <div class="product-detail">${gallery}<section class="product-info">
    <div class="product-title-row"><div><p class="product-info__category">${escapeHtml(category.name)}</p><h1 class="product-info__title">${escapeHtml(product.name)}</h1></div><button class="wishlist-toggle${product.is_wishlisted ? " is-active" : ""}" id="wishlist-toggle" type="button" aria-label="${product.is_wishlisted ? "Remove from" : "Add to"} wishlist">♡</button></div>
    <div class="product-rating"><span class="stars">${stars(product.average_rating)}</span><a href="#reviews">${product.review_count || 0} review${product.review_count===1?"":"s"}</a></div>
    <p class="product-info__price" id="product-price">${formatCurrency(product.price)}</p><p class="product-info__status ${product.in_stock?"":"product-info__status--out"}" id="product-stock">${product.in_stock ? `${product.available_stock} available` : "Out of stock"}</p>
    <p class="product-info__description">${escapeHtml(product.description || "A considered AMBLE essential made for everyday wear.")}</p>
    <div class="product-buybox"><div id="variant-fields"></div><p class="product-buybox__label">Quantity</p><div class="product-buybox__row" id="actions"></div><p class="form-error" id="add-error" role="alert"></p></div>
    <div class="product-accordions"><details><summary>Delivery &amp; payment</summary><p>Delivery is calculated at checkout. PayShap payments are verified by the backend before an order is marked paid.</p></details><details><summary>Care guide</summary><p>Keep leather goods dry and wipe gently with a soft cloth.</p></details></div>
  </section></div>
  <section class="reviews-section" id="reviews"><div class="section-head"><div><p class="eyebrow">Customer feedback</p><h2 class="section-title">Reviews & ratings</h2></div></div><div id="reviews-content"><div class="skeleton skeleton-line"></div></div></section>`;
  wireGallery(images); renderActions(product); document.getElementById("wishlist-toggle")?.addEventListener("click", toggleWishlist);
}

function wireGallery(images) { const image = document.getElementById("main-product-image"); container.querySelectorAll("[data-image-index]").forEach((button)=>button.addEventListener("click",()=>{ const next=images[Number(button.dataset.imageIndex)]; if (!next||!image) return; image.src=next.url; image.alt=next.alt; container.querySelectorAll("[data-image-index]").forEach((item)=>item.setAttribute("aria-current",String(item===button))); })); }

function renderActions(product) {
  const variants = Array.isArray(product.variants) ? product.variants : []; const variantFields = document.getElementById("variant-fields"); const actions = document.getElementById("actions");
  if (!product.in_stock) { actions.innerHTML='<button class="btn btn--primary" disabled>Out of stock</button>'; return; }
  if (variants.length) {
    variantFields.innerHTML = `<div class="form-field"><label for="variant-select">Size / colour</label><select id="variant-select"><option value="">Choose an option</option>${variants.map((v)=>`<option value="${v.id}" data-price="${v.price}" data-stock="${v.stock_quantity}" ${v.in_stock?"":"disabled"}>${escapeHtml(v.label)}${v.in_stock?` — ${v.stock_quantity} left`:" — sold out"}</option>`).join("")}</select></div>`;
    document.getElementById("variant-select").addEventListener("change", (event)=>{ const option=event.target.selectedOptions[0]; document.getElementById("product-price").textContent=formatCurrency(option?.dataset.price || product.price); document.getElementById("product-stock").textContent=option?.value ? `${option.dataset.stock} available` : `${product.available_stock} available`; });
  }
  actions.innerHTML = `<div class="stepper"><button type="button" id="qty-minus">−</button><input type="number" id="quantity" value="1" min="1" max="${product.available_stock || 1}" inputmode="numeric"><button type="button" id="qty-plus">+</button></div><button class="btn btn--primary" id="add-to-cart" type="button">Add to cart</button>`;
  const qty=document.getElementById("quantity"); document.getElementById("qty-minus").addEventListener("click",()=>qty.value=String(Math.max(1,Number(qty.value)-1))); document.getElementById("qty-plus").addEventListener("click",()=>qty.value=String(Math.min(Number(qty.max),Number(qty.value)+1))); document.getElementById("add-to-cart").addEventListener("click",addToCart);
}

async function addToCart() {
  if (addInFlight) return; const product=productState; const variantId=Number(document.getElementById("variant-select")?.value || 0) || null; const variant=variantId ? product.variants.find((item)=>item.id===variantId) : null; const error=document.getElementById("add-error");
  if (product.has_variants && !variant) { error.textContent="Choose a size or colour first."; return; }
  const quantity=Math.max(1,Number(document.getElementById("quantity")?.value||1)); addInFlight=true; const button=document.getElementById("add-to-cart"); button.disabled=true; button.textContent="Adding…";
  try {
    await restoreSession();
    if (getAccessToken()) { await api.post("/cart/items/", {product:product.id, variant:variantId, quantity}); const cart=await api.get("/cart/"); setState({cartCount:Number(cart.item_count||0)}); }
    else { addGuestItem({product:product.id, variant:variantId, product_slug:product.slug, product_name:product.name, product_category:categoryInfo(product).name, product_image:primaryImage(product), variant_label:variant?.label||"", variant_sku:variant?.sku||"", unit_price:variant?.price||product.price, available_stock:variant?.stock_quantity||product.available_stock, quantity}); setState({cartCount:guestCartCount()}); }
    showToast(`${product.name} added to your cart`); button.textContent="Added ✓";
  } catch (e) { error.textContent=firstErrorMessage(e); button.textContent="Add to cart"; button.disabled=false; addInFlight=false; return; }
  setTimeout(()=>{ button.textContent="Add to cart"; button.disabled=false; addInFlight=false; },1000);
}

async function toggleWishlist() {
  await restoreSession(); if (!getAccessToken()) { location.href=`/login.html?next=${encodeURIComponent(location.pathname+location.search)}`; return; }
  const button=document.getElementById("wishlist-toggle"); button.disabled=true;
  try { if (productState.is_wishlisted) { await api.delete(`/catalog/wishlist/${productState.id}/`); productState.is_wishlisted=false; } else { await api.post("/catalog/wishlist/", {product_id:productState.id}); productState.is_wishlisted=true; } button.classList.toggle("is-active",productState.is_wishlisted); button.textContent=productState.is_wishlisted?"♥":"♡"; showToast(productState.is_wishlisted?"Saved to wishlist":"Removed from wishlist"); } catch(e){showToast(firstErrorMessage(e),"error");} finally{button.disabled=false;}
}

async function loadReviews(product) {
  const root=document.getElementById("reviews-content"); if (!root) return;
  try { const reviews=await api.get(`/catalog/products/${encodeURIComponent(product.slug)}/reviews/`); await restoreSession(); root.innerHTML=`${getAccessToken()?`<form class="review-form" id="review-form"><div class="form-field"><label for="rating">Rating</label><select id="rating" name="rating"><option value="5">5 — Excellent</option><option value="4">4 — Good</option><option value="3">3 — Average</option><option value="2">2 — Poor</option><option value="1">1 — Very poor</option></select></div><div class="form-field"><label for="review-title">Title</label><input id="review-title" name="title" maxlength="120"></div><div class="form-field"><label for="review-comment">Review</label><textarea id="review-comment" name="comment" maxlength="2000" required></textarea></div><p class="form-error" id="review-error"></p><button class="btn btn--primary">Submit review</button></form>`:'<p class="form-note"><a href="/login.html">Log in</a> to leave a review.</p>'}<div class="review-list">${reviews.length?reviews.map(reviewTemplate).join(""):'<p class="state-message__copy">No reviews yet. Be the first to share feedback.</p>'}</div>`; document.getElementById("review-form")?.addEventListener("submit",submitReview); } catch(e){root.innerHTML=`<p class="form-error">${escapeHtml(firstErrorMessage(e))}</p>`;}
}
function reviewTemplate(review){return `<article class="review-card"><div><span class="stars">${stars(review.rating)}</span><strong>${escapeHtml(review.title||`${review.rating}/5`)}</strong></div><p>${escapeHtml(review.comment)}</p><small>${escapeHtml(review.reviewer_name)} · ${new Date(review.created_at).toLocaleDateString()}</small></article>`;}
async function submitReview(event){event.preventDefault(); const data=Object.fromEntries(new FormData(event.currentTarget)); const error=document.getElementById("review-error"); try{await api.post(`/catalog/products/${encodeURIComponent(productState.slug)}/reviews/`,{rating:Number(data.rating),title:data.title,comment:data.comment}); showToast("Review submitted"); loadReviews(productState);}catch(e){error.textContent=firstErrorMessage(e);}}

async function loadRelated(product){try{const products=await api.get(`/catalog/products/${encodeURIComponent(product.slug)}/related/`); if(!products.length)return; relatedContainer.querySelector("[data-related-grid]").innerHTML=products.map((item)=>`<article class="product-card"><a class="product-card__media" href="/product.html?slug=${encodeURIComponent(item.slug)}">${item.primary_image?`<img src="${escapeHtml(resolveMediaUrl(item.primary_image))}" alt="${escapeHtml(item.name)}">`:""}</a><a class="product-card__body" href="/product.html?slug=${encodeURIComponent(item.slug)}"><h3>${escapeHtml(item.name)}</h3><p>${formatCurrency(item.price)}</p></a></article>`).join(""); relatedContainer.hidden=false;}catch{/* optional */}}
load();
