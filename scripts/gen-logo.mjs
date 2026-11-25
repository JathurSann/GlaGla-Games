// Génère public/logo.svg : deux joysticks de manette qui pendent comme des testicules, aux couleurs GlaGla.
import { writeFileSync } from 'node:fs'

// Un joystick qui pend : tige + capuchon caoutchouc rond (anneaux + creux antidérapant)
const stick = (x, topY, capY, r, tilt, id) => `
  <g transform="rotate(${tilt} ${x} ${topY})">
    <rect x="${x - 8}" y="${topY - 4}" width="16" height="${capY - topY - r + 18}" rx="7" fill="#3a3a3a" stroke="#1a1a1a" stroke-width="3"/>
    <rect x="${x - 3}" y="${topY}" width="4" height="${capY - topY - r}" rx="2" fill="#fff" opacity=".12"/>
    <circle cx="${x}" cy="${capY}" r="${r}" fill="url(#${id})" stroke="#BF3100" stroke-width="4"/>
    <circle cx="${x}" cy="${capY}" r="${r * 0.72}" fill="none" stroke="#BF3100" stroke-width="2.5" opacity=".55"/>
    <circle cx="${x}" cy="${capY}" r="${r * 0.42}" fill="#D76A03" stroke="#BF3100" stroke-width="2.5" opacity=".9"/>
    <ellipse cx="${x - r * 0.38}" cy="${capY - r * 0.42}" rx="${r * 0.2}" ry="${r * 0.3}" fill="#fff" opacity=".35" transform="rotate(-30 ${x - r * 0.38} ${capY - r * 0.42})"/>
  </g>`

const grad = (id) => `
    <radialGradient id="${id}" cx="38%" cy="30%" r="80%">
      <stop offset="0" stop-color="#F5BB00"/><stop offset=".5" stop-color="#EC9F05"/><stop offset="1" stop-color="#D76A03"/>
    </radialGradient>`

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 224" role="img" aria-label="GlaGla Jeux">
  <defs>${grad('capA')}${grad('capB')}</defs>
  <!-- corps de la manette -->
  <path d="M14 40 Q14 14 44 14 H156 Q186 14 186 40 V58 Q186 74 170 74 H30 Q14 74 14 58 Z" fill="#2b2b2b" stroke="#BF3100" stroke-width="4"/>
  <!-- croix directionnelle -->
  <path d="M40 34h8v-8h8v8h8v8h-8v8h-8v-8h-8z" fill="#8EA604"/>
  <!-- boutons -->
  <circle cx="142" cy="26" r="6" fill="#F5BB00"/><circle cx="160" cy="38" r="6" fill="#BF3100"/>
  <circle cx="124" cy="38" r="6" fill="#8EA604"/><circle cx="142" cy="50" r="6" fill="#EC9F05"/>
  ${stick(66, 74, 142, 36, 4, 'capA')}
  ${stick(134, 74, 154, 40, -3, 'capB')}
</svg>
`
writeFileSync(new URL('../public/logo.svg', import.meta.url), svg)
writeFileSync(new URL('../public/favicon.svg', import.meta.url), svg)
console.log('logo.svg écrit')
