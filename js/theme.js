// Theme persistence lives here. The *initial* application of the theme
// on each page happens via a tiny inline script in <head> instead (see
// any page's HTML) — it has to run before first paint to avoid a flash
// of the wrong theme, which means it can't wait for a module import.
// This file is for changing it after the page has loaded.

const STORAGE_KEY = "amble-theme";

export function getTheme() {
  return document.documentElement.getAttribute("data-theme") || "light";
}

export function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(STORAGE_KEY, theme);
}

export function toggleTheme() {
  setTheme(getTheme() === "dark" ? "light" : "dark");
}
