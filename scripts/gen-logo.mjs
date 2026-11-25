// Génère public/logo.svg : une testicule poilue, aux couleurs GlaGla.
import { writeFileSync } from 'node:fs'

let seed = 7
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

const cx = 100, cy = 112, rx = 52, ry = 64
const hairs = []
// poils qui dépassent du contour
for (let i = 0; i < 46; i++) {
  const a = rnd() * Math.PI * 2
  const x = cx + Math.cos(a) * (rx - 2), y = cy + Math.sin(a) * (ry - 2)
  const len = 14 + rnd() * 20
  const ox = Math.cos(a), oy = Math.sin(a)
  const curl = (rnd() - 0.5) * 22
  const ex = x + ox * len + -oy * curl, ey = y + oy * len + ox * curl
  const mx = x + ox * len * 0.5 + -oy * curl * 1.8, my = y + oy * len * 0.5 + ox * curl * 1.8
  hairs.push(`<path d="M${x.toFixed(1)} ${y.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}"/>`)
}
// poils sur le corps (courts, bouclés)
const inner = []
for (let i = 0; i < 38; i++) {
  const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 0.86
  const x = cx + Math.cos(a) * rx * r, y = cy + Math.sin(a) * ry * r
  if (Math.abs(x - cx) < 5) continue // on laisse la couture tranquille
  const len = 8 + rnd() * 9, dir = rnd() * Math.PI * 2
  const ex = x + Math.cos(dir) * len, ey = y + Math.sin(dir) * len
  const mx = x + Math.cos(dir + 1.2) * len * 0.8, my = y + Math.sin(dir + 1.2) * len * 0.8
  inner.push(`<path d="M${x.toFixed(1)} ${y.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}"/>`)
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 224" role="img" aria-label="GlaGla Jeux">
  <defs>
    <radialGradient id="skin" cx="38%" cy="30%" r="80%">
      <stop offset="0" stop-color="#F5BB00"/>
      <stop offset=".45" stop-color="#EC9F05"/>
      <stop offset="1" stop-color="#D76A03"/>
    </radialGradient>
  </defs>
  <g fill="none" stroke="#7A2000" stroke-width="3.4" stroke-linecap="round">${hairs.join('')}</g>
  <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#skin)" stroke="#BF3100" stroke-width="4"/>
  <path d="M${cx} ${cy - ry + 6} C ${cx - 9} ${cy - 24}, ${cx + 9} ${cy + 22}, ${cx} ${cy + ry - 6}" fill="none" stroke="#BF3100" stroke-width="3" stroke-linecap="round" opacity=".75"/>
  <ellipse cx="${cx - 24}" cy="${cy - 30}" rx="9" ry="17" fill="#fff" opacity=".28" transform="rotate(-18 ${cx - 24} ${cy - 30})"/>
  <g fill="none" stroke="#7A2000" stroke-width="2.6" stroke-linecap="round">${inner.join('')}</g>
</svg>
`
writeFileSync(new URL('../public/logo.svg', import.meta.url), svg)
writeFileSync(new URL('../public/favicon.svg', import.meta.url), svg)
console.log('logo.svg écrit')
