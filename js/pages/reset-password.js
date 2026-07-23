import { api, firstErrorMessage } from "../api.js";
import { renderFooter, renderNav } from "../nav.js";
import { focusAlert, setBusy } from "../reliability.js";

renderNav();
renderFooter();

const params = new URLSearchParams(window.location.search);
const uid = params.get("uid");
const token = params.get("token");
const form = document.getElementById("reset-form");
const errorEl = document.getElementById("form-error");
const successEl = document.getElementById("success-message");
const submitButton = document.getElementById("submit-button");

if (!uid || !token) {
  errorEl.textContent = "This reset link is incomplete. Request a new password reset email.";
  submitButton.disabled = true;
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorEl.textContent = "";
  successEl.hidden = true;

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  setBusy(submitButton, true, "Updating…");
  try {
    const data = await api.post("/auth/password/reset/confirm/", {
      uid,
      token,
      new_password: form.new_password.value,
      new_password_confirm: form.new_password_confirm.value,
    });
    form.hidden = true;
    successEl.innerHTML = `${data.detail} <a href="/login.html">Log in with your new password</a>.`;
    successEl.hidden = false;
    focusAlert(successEl);
  } catch (error) {
    errorEl.textContent = firstErrorMessage(error);
    focusAlert(errorEl);
  } finally {
    setBusy(submitButton, false);
  }
});
