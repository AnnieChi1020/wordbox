// Generates the PWA and iOS icons (design §8.3): dark blue background, cream "W".
// The "W" is drawn with SVG paths, without relying on system fonts. Run: npm run icons
import { writeFile } from "node:fs/promises"

import sharp from "sharp"

const BRAND_900 = "#086288"
const CREAM = "#FFEFC4"

/**
 * @param {object} o
 * @param {number} o.radius corner radius (as a fraction of the side); 0 = full square
 * @param {number} o.scale  size of the "W"; maskable icons must fit in the central 80% safe zone
 */
function svg({ radius, scale }) {
  const r = radius * 100
  const c = 50
  // The "W" in 100×100 coordinates, scaled around the center
  const pts = [
    [22, 32],
    [36, 70],
    [50, 42],
    [64, 70],
    [78, 32],
  ]
    .map(([x, y]) => `${c + (x - c) * scale},${c + (y - c) * scale}`)
    .join(" ")
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="${r}" fill="${BRAND_900}"/>
  <polyline points="${pts}" fill="none" stroke="${CREAM}" stroke-width="${9 * scale}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`
}

const targets = [
  { file: "public/icons/icon-192.png", size: 192, radius: 0.22, scale: 1 },
  { file: "public/icons/icon-512.png", size: 512, radius: 0.22, scale: 1 },
  {
    file: "public/icons/icon-maskable-512.png",
    size: 512,
    radius: 0,
    scale: 0.75,
  },
  { file: "app/apple-icon.png", size: 180, radius: 0, scale: 0.9 },
]

for (const { file, size, ...shape } of targets) {
  await sharp(Buffer.from(svg(shape)))
    .resize(size, size)
    .png()
    .toFile(file)
  console.log(file)
}
await writeFile("app/icon.svg", svg({ radius: 0.22, scale: 1 }))
console.log("app/icon.svg")
