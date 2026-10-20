import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

const qui = (percorso) => resolve(import.meta.dirname, percorso)

// Le pagine legali leggono i dati del titolare da legale/dati.json: {{chiave}} nel testo, [[chiave]]
// dentro un attributo (un href mailto:). Un dato vuoto esce evidenziato nel testo e la build lo dice,
// invece di sparire in silenzio; una chiave che nel file non c'e' e' un refuso e ferma tutto.
function datiLegali() {
  const file = qui('legale/dati.json')
  const mancanti = new Set()
  const html = (v) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  return {
    name: 'dati-legali',
    transformIndexHtml(pagina) {
      const dati = JSON.parse(readFileSync(file, 'utf8'))
      const valore = (chiave) => {
        if (!(chiave in dati)) throw new Error(`legale/dati.json: manca la chiave «${chiave}»`)
        const v = String(dati[chiave]).trim()
        if (!v) mancanti.add(chiave)
        return v
      }
      return pagina
        .replace(/\[\[(\w+)\]\]/g, (_, chiave) => html(valore(chiave)))
        .replace(/\{\{(\w+)\}\}/g, (_, chiave) => {
          const v = valore(chiave)
          return v ? html(v) : `<mark class="da-completare">[da completare: ${chiave}]</mark>`
        })
    },
    configureServer(server) {
      server.watcher.add(file)
      server.watcher.on('change', (f) => { if (f === file) server.ws.send({ type: 'full-reload' }) })
    },
    closeBundle() {
      if (mancanti.size) console.warn(`\n⚠ Pagine legali: dati da completare in legale/dati.json → ${[...mancanti].join(', ')}\n`)
    },
  }
}

// Le pagine: chi fa la spesa su /, i supermercati su /supermercati/, i documenti legali su /legale/.
const LEGALI = ['privacy', 'cookie', 'termini', 'note-legali', 'privacy-partner', 'termini-partner']

export default defineConfig({
  plugins: [datiLegali()],
  build: {
    rolldownOptions: {
      input: {
        spesa: qui('index.html'),
        supermercati: qui('supermercati/index.html'),
        ...Object.fromEntries(LEGALI.map((nome) => [nome, qui(`legale/${nome}.html`)])),
      },
    },
  },
})
