let networkBanner;
let onlineTimer;

function ensureNetworkBanner() {
  if (networkBanner) return networkBanner;

  networkBanner = document.createElement("div");
  networkBanner.className = "network-banner";
  networkBanner.setAttribute("role", "status");
  networkBanner.setAttribute("aria-live", "polite");
  networkBanner.hidden = true;
  document.body.prepend(networkBanner);
  return networkBanner;
}

function showNetworkState(online, announceRecovery = false) {
  const banner = ensureNetworkBanner();
  window.clearTimeout(onlineTimer);

  document.documentElement.classList.toggle("is-offline", !online);
  banner.classList.toggle("network-banner--offline", !online);
  banner.classList.toggle("network-banner--online", online);

  if (!online) {
    banner.textContent = "You’re offline. Check your connection before trying again.";
    banner.hidden = false;
    return;
  }

  if (announceRecovery) {
    banner.textContent = "Back online.";
    banner.hidden = false;
    onlineTimer = window.setTimeout(() => {
      banner.hidden = true;
    }, 2200);
    return;
  }

  banner.hidden = true;
}

export function initNetworkStatus() {
  showNetworkState(navigator.onLine);
  window.addEventListener("offline", () => showNetworkState(false));
  window.addEventListener("online", () => showNetworkState(true, true));
}

export function setBusy(button, busy, busyLabel) {
  if (!button) return;

  if (busy) {
    if (!button.dataset.idleLabel) button.dataset.idleLabel = button.textContent || "Submit";
    button.disabled = true;
    button.classList.add("is-busy");
    button.setAttribute("aria-busy", "true");
    if (busyLabel) button.textContent = busyLabel;
    return;
  }

  button.disabled = false;
  button.classList.remove("is-busy");
  button.removeAttribute("aria-busy");
  if (button.dataset.idleLabel) button.textContent = button.dataset.idleLabel;
}

export function focusAlert(element) {
  if (!element) return;
  element.setAttribute("tabindex", "-1");
  element.focus({ preventScroll: true });
  element.scrollIntoView({ behavior: "smooth", block: "center" });
}

export function stockMayHaveChanged(error) {
  const message = String(error?.message || "") + " " + JSON.stringify(error?.body || {});
  return error?.status === 409 || (error?.status === 400 && /stock|available|unavailable|quantity|sold out/i.test(message));
}
