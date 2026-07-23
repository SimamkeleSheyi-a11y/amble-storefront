import { api, firstErrorMessage } from "../api.js";
import { renderFooter, renderNav } from "../nav.js";
import { focusAlert, setBusy } from "../reliability.js";

renderNav();
renderFooter();

const form = document.getElementById("forgot-form");
const errorEl = document.getElementById("form-error");
const successEl = document.getElementById("success-message");
const submitButton = document.getElementById("submit-button");

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorEl.textContent = "";
  successEl.hidden = true;

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  setBusy(submitButton, true, "Sending…");
  try {
    const data = await api.post("/auth/password/reset/request/", {
      email: form.email.value.trim(),
    });
    successEl.textContent = data.detail;
    successEl.hidden = false;
    focusAlert(successEl);
    form.reset();
  } catch (error) {
    errorEl.textContent = firstErrorMessage(error);
    focusAlert(errorEl);
  } finally {
    setBusy(submitButton, false);
  }
});
