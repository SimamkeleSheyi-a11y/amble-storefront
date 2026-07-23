import { ApiError, firstErrorMessage, getAccessToken, login, restoreSession } from "../api.js";
import { renderFooter, renderNav } from "../nav.js";
import { focusAlert, setBusy } from "../reliability.js";

renderNav();
renderFooter();

const form = document.getElementById("login-form");
const errorEl = document.getElementById("form-error");
const submitButton = document.getElementById("submit-button");
let submitInFlight = false;

function getNextUrl() {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/index.html";
}

function wirePasswordToggle() {
  const button = document.querySelector("[data-password-toggle]");
  const input = document.getElementById(button?.dataset.passwordToggle || "");
  if (!button || !input) return;

  button.addEventListener("click", () => {
    const visible = input.type === "text";
    input.type = visible ? "password" : "text";
    button.setAttribute("aria-label", visible ? "Show password" : "Hide password");
    button.textContent = visible ? "Show" : "Hide";
  });
}

restoreSession().then(() => {
  if (getAccessToken()) window.location.replace(getNextUrl());
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (submitInFlight) return;
  errorEl.textContent = "";

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  submitInFlight = true;
  form.setAttribute("aria-busy", "true");
  setBusy(submitButton, true, "Logging in…");

  try {
    await login(form.email.value.trim(), form.password.value);
    window.location.replace(getNextUrl());
  } catch (error) {
    errorEl.textContent = error instanceof ApiError && error.status === 401
      ? "Incorrect email or password. Check both fields and try again."
      : firstErrorMessage(error);
    focusAlert(errorEl);
    submitInFlight = false;
    form.removeAttribute("aria-busy");
    setBusy(submitButton, false);
  }
});

wirePasswordToggle();
