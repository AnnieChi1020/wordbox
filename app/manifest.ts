import type { MetadataRoute } from "next"

/** R9.1：Web App Manifest（design §8.2、§8.3）。 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wordbox 英文單字本",
    short_name: "Wordbox",
    description: "用 AI 生成解釋、以 Leitner 盒子複習的英文單字本",
    lang: "zh-Hant",
    start_url: "/words",
    scope: "/",
    display: "standalone",
    theme_color: "#086288",
    background_color: "#FFEFC4",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
