/** 外觀設定在 localStorage 的 key；值為 "light" 或 "dark"，沒有值代表尚未手動切換（R10.1、R10.2）。 */
export const THEME_STORAGE_KEY = "theme"

/**
 * R10.3：在畫面繪製前套用外觀，放在根 layout 的 <head>（design §8.4、D23）。
 * 尚未手動切換時，依載入當下的系統設定決定。
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;var e=document.documentElement;e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light"}catch(_){}})()`

/** 套用並儲存外觀。 */
export function setTheme(dark: boolean) {
  const root = document.documentElement
  root.classList.toggle("dark", dark)
  root.style.colorScheme = dark ? "dark" : "light"
  try {
    localStorage.setItem(THEME_STORAGE_KEY, dark ? "dark" : "light")
  } catch {
    // 無法儲存（例如私密瀏覽）時只套用到目前頁面
  }
}
