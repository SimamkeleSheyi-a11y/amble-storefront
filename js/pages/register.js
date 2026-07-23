import { firstErrorMessage, getAccessToken, login, restoreSession, api } from "../api.js";
import { renderFooter, renderNav } from "../nav.js";
import { focusAlert, setBusy } from "../reliability.js";

renderNav();
renderFooter();

const form = document.getElementById("register-form");
const errorEl = document.getElementById("form-error");
const submitButton = document.getElementById("submit-button");
let submitInFlight = false;

function wirePasswordToggles() {
  document.querySelectorAll("[data-password-toggle]").forEach((button) => {
    const input = document.getElementById(button.dataset.passwordToggle);
    if (!input) return;
    button.addEventListener("click", () => {
      const visible = input.type === "text";
      input.type = visible ? "password" : "text";
      button.textContent = visible ? "Show" : "Hide";
      button.setAttribute("aria-label", visible ? "Show password" : "Hide password");
    });
  });
}

restoreSession().then(() => {
  if (getAccessToken()) window.location.replace("/index.html");
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (submitInFlight) return;
  errorEl.textContent = "";

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  if (form.password.value !== form.password_confirm.value) {
    errorEl.textContent = "The passwords do not match.";
    focusAlert(errorEl);
    form.password_confirm.focus();
    return;
  }

  const email = form.email.value.trim();
  const password = form.password.value;
  submitInFlight = true;
  form.setAttribute("aria-busy", "true");
  setBusy(submitButton, true, "Creating account…");

  try {
    await api.post("/auth/register/", {
      email,
      password,
      password_confirm: form.password_confirm.value,
      first_name: form.first_name.value.trim(),
      last_name: form.last_name.value.trim(),
    });

    try {
      await login(email, password);
      window.location.replace("/index.html");
    } catch {
      window.location.replace(`/login.html?email=${encodeURIComponent(email)}`);
    }
  } catch (error) {
    errorEl.textContent = firstErrorMessage(error);
    focusAlert(errorEl);
    submitInFlight = false;
    form.removeAttribute("aria-busy");
    setBusy(submitButton, false);
  }
});

wirePasswordToggles();
