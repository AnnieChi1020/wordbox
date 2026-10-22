// Wordbox service worker（R9.2；design §8.2、D19）
// 只快取靜態資源與離線頁；頁面、RSC、Server Actions 與 Supabase 一律走網路。
// 修改快取規則時遞增 VERSION，activate 時會刪除舊快取。

const VERSION = "v1"
const CACHE = `wordbox-static-${VERSION}`
const OFFLINE_URL = "/offline"
const ICONS = ["/icons/icon-192.png", "/icons/icon-512.png"]

const isStatic = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  url.pathname.startsWith("/icons/")

/** 快取離線頁，以及它引用的 /_next/static 資源，離線時才能完整顯示。 */
async function precache() {
  const cache = await caches.open(CACHE)
  const res = await fetch(OFFLINE_URL, { cache: "reload" })
  if (!res.ok) throw new Error(`failed to fetch ${OFFLINE_URL}`)
  const html = await res.clone().text()
  await cache.put(OFFLINE_URL, res)
  const assets = new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) ?? [])
  await cache.addAll([...ICONS, ...assets])
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()))
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("wordbox-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // 頁面導覽：一律走網路，失敗時顯示離線頁
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const offline = await caches.match(OFFLINE_URL)
        return offline ?? Response.error()
      }),
    )
    return
  }

  // 檔名含 hash 的靜態資源：cache-first
  if (isStatic(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(CACHE).then((cache) => cache.put(request, copy))
            }
            return res
          }),
      ),
    )
  }
  // 其他請求不攔截
})
