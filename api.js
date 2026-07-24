const API_ORIGIN = "http://127.0.0.1:8000";
const API_BASE = `${API_ORIGIN}/api`;

let accessToken = null;
let sessionPromise = null;

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

async function refreshAccessToken() {
  const response = await fetch(`${API_BASE}/auth/token/refresh/`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    accessToken = null;
    return false;
  }

  const body = await parseBody(response);
  accessToken = body?.access || null;
  return Boolean(accessToken);
}

export function restoreSession() {
  if (!sessionPromise) sessionPromise = refreshAccessToken();
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
  const response = await fetch(`${API_BASE}/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  const data = await parseBody(response);
  if (!response.ok) throw new ApiError(response.status, data);
  accessToken = data?.access || null;
  return data;
}

export async function logout() {
  await request("/auth/logout/", { method: "POST" }).catch(() => {});
  accessToken = null;
  sessionPromise = Promise.resolve(false);
}

async function request(path, { method = "GET", body, retry = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      credentials: "include",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new ApiError(0, { detail: "The request timed out. Check that the backend is running." });
    }
    throw new ApiError(0, { detail: "Couldn't reach the server. Check that the backend is running." });
  } finally {
    window.clearTimeout(timeout);
  }

  if (response.status === 401 && retry) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return request(path, { method, body, retry: false });
  }

  const data = await parseBody(response);
  if (!response.ok) throw new ApiError(response.status, data);
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  delete: (path) => request(path, { method: "DELETE" }),
};

function firstValue(value) {
  if (Array.isArray(value)) return value.length ? firstValue(value[0]) : "";
  if (value && typeof value === "object") {
    const first = Object.values(value)[0];
    return firstValue(first);
  }
  return value == null ? "" : String(value);
}

export function firstErrorMessage(error) {
  if (!(error instanceof ApiError)) return "Something went wrong. Try again.";
  const body = error.body || {};
  return firstValue(body.errors) || firstValue(body.detail) || "Something went wrong. Try again.";
}
