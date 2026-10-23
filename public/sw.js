// Wordbox service worker（R9.2；design §8.2、D19）
// Caches only static assets and the offline page; pages, RSC, Server Actions, and Supabase always go to the network.
// Bump VERSION when changing the caching rules; old caches are deleted on activate.

const VERSION = "v1"
const CACHE = `wordbox-static-${VERSION}`
const OFFLINE_URL = "/offline"
const ICONS = ["/icons/icon-192.png", "/icons/icon-512.png"]

const isStatic = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  url.pathname.startsWith("/icons/")

/** Caches the offline page and the /_next/static assets it references, so it displays fully while offline. */
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

  // Page navigations: always network, showing the offline page on failure
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const offline = await caches.match(OFFLINE_URL)
        return offline ?? Response.error()
      }),
    )
    return
  }

  // Static assets with hashed file names: cache-first
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
  // Other requests are not intercepted
})
