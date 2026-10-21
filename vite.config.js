import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'
import { defineConfig } from 'vite'

const qui = (percorso) => resolve(import.meta.dirname, percorso)

// L'indirizzo pubblico del sito. nutriquore.it rimanda qui (308, dominio principale su Vercel): canonical,
// og:url, sitemap e robots usano solo questo, cosi' Google non vede due copie dello stesso sito.
const SITO = 'https://www.nutriquore.it'

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

// L'indirizzo pubblico di una pagina: index.html → /, supermercati/index.html → /supermercati/.
const percorso = (file) => `/${relative(import.meta.dirname, file).split(sep).join('/')}`.replace(/(^|\/)index\.html$/, '$1')

// Ultima modifica vera di una pagina, dalla storia git; le legali cambiano anche quando cambia
// legale/dati.json. Senza git, o con un clone troppo corto per vederla, la data non si inventa.
function ultimaModifica(file) {
  const relativo = relative(import.meta.dirname, file).split(sep).join('/')
  const anche = relativo.startsWith('legale/') ? ['legale/dati.json'] : []
  try {
    return execFileSync('git', ['log', '-1', '--format=%cs', '--', relativo, ...anche], { cwd: import.meta.dirname, encoding: 'utf8' }).trim() || null
  } catch {
    return null
  }
}

// Ogni pagina dice qual e' il suo indirizzo (canonical, og:url), e sitemap.xml e robots.txt escono dalla
// stessa lista di pagine della build: una pagina nuova ci entra da sola, una con
// <meta name="robots" content="noindex"> resta fuori.
function seo(pagine) {
  return {
    name: 'seo',
    transformIndexHtml(_, ctx) {
      const url = SITO + percorso(ctx.filename)
      return [
        { tag: 'link', attrs: { rel: 'canonical', href: url }, injectTo: 'head' },
        { tag: 'meta', attrs: { property: 'og:url', content: url }, injectTo: 'head' },
      ]
    },
    generateBundle() {
      const indicizzate = pagine.filter((f) => !/<meta\s+name="robots"\s+content="[^"]*noindex/i.test(readFileSync(f, 'utf8')))
      const url = indicizzate.map((f) => {
        const data = ultimaModifica(f)
        return `  <url>\n    <loc>${SITO}${percorso(f)}</loc>${data ? `\n    <lastmod>${data}</lastmod>` : ''}\n  </url>`
      })
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${url.join('\n')}\n</urlset>\n`,
      })
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\n\nSitemap: ${SITO}/sitemap.xml\n` })
    },
  }
}

// Le pagine: chi fa la spesa su /, i supermercati su /supermercati/, i documenti legali su /legale/.
const LEGALI = ['privacy', 'cookie', 'termini', 'note-legali', 'privacy-partner', 'termini-partner']
const PAGINE = {
  spesa: qui('index.html'),
  supermercati: qui('supermercati/index.html'),
  ...Object.fromEntries(LEGALI.map((nome) => [nome, qui(`legale/${nome}.html`)])),
}

export default defineConfig({
  plugins: [datiLegali(), seo(Object.values(PAGINE))],
  build: {
    rolldownOptions: {
      input: PAGINE,
    },
  },
})
