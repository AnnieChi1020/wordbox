/** The localStorage key for the appearance setting; the value is "light" or "dark", and no value means never switched manually (R10.1, R10.2). */
export const THEME_STORAGE_KEY = "theme"

/**
 * R10.3: apply the appearance before the first paint; placed in the root layout's <head> (design §8.4, D23).
 * Until the user switches manually, the system setting at load time decides.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;var e=document.documentElement;e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light"}catch(_){}})()`

/** Applies and stores the appearance. */
export function setTheme(dark: boolean) {
  const root = document.documentElement
  root.classList.toggle("dark", dark)
  root.style.colorScheme = dark ? "dark" : "light"
  try {
    localStorage.setItem(THEME_STORAGE_KEY, dark ? "dark" : "light")
  } catch {
    // When it cannot be stored (e.g. private browsing), apply it to the current page only
  }
}
