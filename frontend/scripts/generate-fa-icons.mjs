// Generates a slim Font Awesome icon dataset for FontAwesomeIconPicker.vue.
//
// The full @fortawesome/fontawesome-free metadata (icon-families.json) is ~5 MB
// because it carries SVG path data for every style and family. The picker only
// needs { name, label, terms } for solid icons. Importing the full file directly
// bloats the bundle past the PWA precache limit and breaks `bun run build`.
//
// Re-run after bumping @fortawesome/fontawesome-free:
//   bun run generate:fa-icons
// Commit the regenerated src/config/fa-icons.json.

import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const raw = require('@fortawesome/fontawesome-free/metadata/icon-families.json')

const slim = Object.entries(raw)
  .filter(([, d]) => d?.svgs?.classic?.solid)
  .map(([name, d]) => ({ name, label: d.label, terms: d.search?.terms ?? [] }))

writeFileSync(new URL('../src/config/fa-icons.json', import.meta.url), JSON.stringify(slim))
console.log(`Wrote ${slim.length} icons to src/config/fa-icons.json`)
