let container = null;

function getContainer() {
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    container.setAttribute("aria-live", "polite");
    container.setAttribute("aria-atomic", "false");
    document.body.appendChild(container);
  }
  return container;
}

export function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.setAttribute("role", type === "error" ? "alert" : "status");
  toast.textContent = message;
  getContainer().appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("toast--visible"));

  window.setTimeout(() => {
    toast.classList.remove("toast--visible");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
    window.setTimeout(() => toast.remove(), 350);
  }, 3000);
}
