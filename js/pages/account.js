import { api, firstErrorMessage, logout, requireAuth } from "../api.js";
import { renderFooter, renderNav } from "../nav.js";
import { focusAlert, setBusy } from "../reliability.js";
import { showToast } from "../toast.js";

renderNav();
renderFooter();

const profileSummary = document.getElementById("profile-summary");
const addressList = document.getElementById("address-list");
const passwordForm = document.getElementById("password-form");
const addressForm = document.getElementById("address-form");

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

async function loadAccount() {
  if (!(await requireAuth())) return;

  try {
    const [profile, addresses] = await Promise.all([
      api.get("/auth/profile/"),
      api.get("/orders/addresses/"),
    ]);

    const user = profile.user || {};
    profileSummary.innerHTML = `
      <dl class="account-details">
        <div><dt>Email</dt><dd>${escapeHtml(user.email || "")}</dd></div>
        <div><dt>Name</dt><dd>${escapeHtml([user.first_name, user.last_name].filter(Boolean).join(" ") || "Not provided")}</dd></div>
        <div><dt>Phone</dt><dd>${escapeHtml(profile.phone_number || "Not provided")}</dd></div>
      </dl>`;

    renderAddresses(addresses || []);
  } catch (error) {
    profileSummary.innerHTML = `<p class="form-error">${escapeHtml(firstErrorMessage(error))}</p>`;
    addressList.innerHTML = `<p class="form-error">${escapeHtml(firstErrorMessage(error))}</p>`;
  }
}

function renderAddresses(addresses) {
  if (!addresses.length) {
    addressList.innerHTML = `<p class="form-note">No saved addresses yet. Add one below or save an address during checkout.</p>`;
    return;
  }

  addressList.innerHTML = addresses.map((address) => `
    <article class="address-card" data-address-id="${address.id}">
      <div>
        <div class="address-card__head">
          <h3>${escapeHtml(address.label)}</h3>
          ${address.is_default ? '<span class="status-badge status-badge--placed">Default</span>' : ""}
        </div>
        <p><strong>${escapeHtml(address.full_name)}</strong></p>
        <p>${escapeHtml(address.address_line1)}${address.address_line2 ? `, ${escapeHtml(address.address_line2)}` : ""}</p>
        <p>${escapeHtml(address.city)}${address.province ? `, ${escapeHtml(address.province)}` : ""}, ${escapeHtml(address.postal_code)}</p>
        <p>${escapeHtml(address.country)}${address.phone_number ? ` · ${escapeHtml(address.phone_number)}` : ""}</p>
      </div>
      <div class="address-card__actions">
        ${address.is_default ? "" : `<button class="btn btn--ghost" type="button" data-default-address="${address.id}">Make default</button>`}
        <button class="btn btn--ghost" type="button" data-delete-address="${address.id}">Delete</button>
      </div>
    </article>`).join("");

  addressList.querySelectorAll("[data-default-address]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await api.patch(`/orders/addresses/${button.dataset.defaultAddress}/`, { is_default: true });
        showToast("Default address updated");
        await loadAccount();
      } catch (error) {
        showToast(firstErrorMessage(error), "error");
        button.disabled = false;
      }
    });
  });

  addressList.querySelectorAll("[data-delete-address]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!window.confirm("Delete this saved address?")) return;
      button.disabled = true;
      try {
        await api.delete(`/orders/addresses/${button.dataset.deleteAddress}/`);
        showToast("Address deleted");
        await loadAccount();
      } catch (error) {
        showToast(firstErrorMessage(error), "error");
        button.disabled = false;
      }
    });
  });
}

passwordForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const errorEl = document.getElementById("password-error");
  const button = document.getElementById("password-submit");
  errorEl.textContent = "";

  if (!passwordForm.checkValidity()) {
    passwordForm.reportValidity();
    return;
  }

  setBusy(button, true, "Changing…");
  try {
    const data = await api.post("/auth/password/change/", {
      old_password: passwordForm.old_password.value,
      new_password: passwordForm.new_password.value,
      new_password_confirm: passwordForm.new_password_confirm.value,
    });
    passwordForm.reset();
    showToast(data.detail || "Password changed");
  } catch (error) {
    errorEl.textContent = firstErrorMessage(error);
    focusAlert(errorEl);
  } finally {
    setBusy(button, false);
  }
});

addressForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const errorEl = document.getElementById("address-error");
  const button = document.getElementById("address-submit");
  errorEl.textContent = "";

  if (!addressForm.checkValidity()) {
    addressForm.reportValidity();
    return;
  }

  const values = Object.fromEntries(new FormData(addressForm).entries());
  setBusy(button, true, "Saving…");
  try {
    await api.post("/orders/addresses/", {
      label: String(values.label || "Home").trim(),
      full_name: String(values.full_name || "").trim(),
      address_line1: String(values.address_line1 || "").trim(),
      address_line2: String(values.address_line2 || "").trim(),
      city: String(values.city || "").trim(),
      province: String(values.province || "").trim(),
      postal_code: String(values.postal_code || "").trim(),
      country: String(values.country || "South Africa").trim(),
      phone_number: String(values.phone_number || "").trim(),
      is_default: values.is_default === "true",
    });
    addressForm.reset();
    addressForm.label.value = "Home";
    addressForm.country.value = "South Africa";
    showToast("Address saved");
    await loadAccount();
  } catch (error) {
    errorEl.textContent = firstErrorMessage(error);
    focusAlert(errorEl);
  } finally {
    setBusy(button, false);
  }
});

document.getElementById("logout-button")?.addEventListener("click", async () => {
  await logout();
  window.location.href = "/index.html";
});

loadAccount();
