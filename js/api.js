const configuredApiOrigin = window.AMBLE_CONFIG?.API_ORIGIN?.trim();
const API_ORIGIN = (
  configuredApiOrigin ||
  (["127.0.0.1", "localhost"].includes(window.location.hostname)
    ? "http://127.0.0.1:8000"
    : window.location.origin)
).replace(/\/$/, "");
const API_BASE = `${API_ORIGIN}/api`;
const DEFAULT_TIMEOUT_MS = 15000;

let accessToken = null;
let sessionPromise = null;
let refreshPromise = null;

export function getAccessToken() {
  return accessToken;
}

export function resolveMediaUrl(value) {
  if (!value) return "";
  try {
    return new URL(value, API_ORIGIN).href;
  } catch {
    return String(value);
  }
}

/** Format backend decimal values as South African rand.
 * This changes presentation only; it does not apply an exchange-rate conversion. */
const zarFormatter = new Intl.NumberFormat("en-ZA", {
  style: "currency",
  currency: "ZAR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? zarFormatter.format(amount) : zarFormatter.format(0);
}

export class ApiError extends Error {
  constructor(status, body) {
    super((body && body.detail) || "Request failed");
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function parseBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { detail: text };
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new ApiError(0, { detail: "The request timed out. Check that the backend is running, then try again." });
    }
    throw new ApiError(0, {
      detail: navigator.onLine
        ? "Couldn’t reach the server. Check that the Django backend is running."
        : "You appear to be offline. Reconnect and try again.",
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function performRefresh() {
  let response;
  try {
    response = await fetchWithTimeout(`${API_BASE}/auth/token/refresh/`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    accessToken = null;
    return false;
  }

  if (!response.ok) {
    accessToken = null;
    return false;
  }

  const body = await parseBody(response);
  accessToken = body?.access || null;
  return Boolean(accessToken);
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export function restoreSession({ force = false } = {}) {
  if (force) sessionPromise = null;
  if (!sessionPromise) {
    sessionPromise = refreshAccessToken().then((restored) => {
      if (!restored) sessionPromise = null;
      return restored;
    });
  }
  return sessionPromise;
}

export async function requireAuth() {
  await restoreSession();
  if (getAccessToken()) return true;

  const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.href = `/login.html?next=${returnTo}`;
  return false;
}

export async function login(email, password) {
  const response = await fetchWithTimeout(`${API_BASE}/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  const data = await parseBody(response);
  if (!response.ok) throw new ApiError(response.status, data);
  accessToken = data?.access || null;
  sessionPromise = Promise.resolve(Boolean(accessToken));
  return data;
}

export async function logout() {
  await request("/auth/logout/", { method: "POST" }).catch(() => {});
  accessToken = null;
  sessionPromise = null;
}

async function request(path, { method = "GET", body, retry = true, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const response = await fetchWithTimeout(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }, timeoutMs);

  if (response.status === 401 && retry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return request(path, { method, body, retry: false, timeoutMs });
  }

  const data = await parseBody(response);
  if (!response.ok) throw new ApiError(response.status, data);
  return data;
}

export const api = {
  get: (path, options) => request(path, options),
  post: (path, body, options) => request(path, { ...options, method: "POST", body }),
  patch: (path, body, options) => request(path, { ...options, method: "PATCH", body }),
  delete: (path, options) => request(path, { ...options, method: "DELETE" }),
};

function firstValue(value) {
  if (Array.isArray(value)) return value.length ? firstValue(value[0]) : "";
  if (value && typeof value === "object") {
    const preferredKeys = ["non_field_errors", "errors", "detail", "message"];
    for (const key of preferredKeys) {
      if (key in value) {
        const preferred = firstValue(value[key]);
        if (preferred) return preferred;
      }
    }
    const first = Object.values(value)[0];
    return firstValue(first);
  }
  return value == null ? "" : String(value);
}

export function firstErrorMessage(error) {
  if (!(error instanceof ApiError)) return "Something went wrong. Try again.";

  const bodyMessage = firstValue(error.body);
  if (bodyMessage) return bodyMessage;
  if (error.status === 0) return navigator.onLine
    ? "Couldn’t reach the server. Check that the backend is running."
    : "You’re offline. Reconnect and try again.";
  if (error.status === 403) return "You don’t have permission to do that.";
  if (error.status === 404) return "The requested item could not be found.";
  if (error.status === 429) return "Too many attempts. Wait a moment and try again.";
  if (error.status >= 500) return "The server had a problem. Please try again shortly.";
  return "Something went wrong. Try again.";
}
