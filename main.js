// Stesso carattere del pannello B2B e dell'app Android: Nunito, servito da qui e non da Google.
// Sui dispositivi Apple vince SF Rounded (ui-rounded), come nell'app iOS.
import '@fontsource-variable/nunito'
// Il corsivo della firma del brand, solo per lo slogan.
import '@fontsource/herr-von-muellerhoff'

const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches

// Comparse allo scroll: ogni [data-rivela] riceve .visto la prima volta che entra a schermo.
// Gli stati iniziali nascosti valgono solo con html.anima, così senza JS si vede tutto.
if (!quieto && 'IntersectionObserver' in window) {
  document.documentElement.classList.add('anima')
  const osservatore = new IntersectionObserver((voci) => {
    for (const v of voci) {
      if (!v.isIntersecting) continue
      v.target.classList.add('visto')
      osservatore.unobserve(v.target)
    }
  }, { rootMargin: '0px 0px -12% 0px' })
  document.querySelectorAll('[data-rivela]').forEach((el) => osservatore.observe(el))
}

// Movimenti legati allo scroll: ogni [data-scorri] riceve --p da 0 (entra dal basso) a 1 (esce in
// alto), e il CSS ci costruisce sopra le rotazioni 3D. Con data-scorri="uscita" lo 0 è quando
// l'elemento sta a metà schermo: la scena dell'apertura parte ferma e si apre solo scendendo.
// Un solo rAF per frame.
if (!quieto) {
  const elementi = [...document.querySelectorAll('[data-scorri]')]
  let atteso = 0
  const aggiorna = () => {
    atteso = 0
    const h = innerHeight
    for (const el of elementi) {
      const r = el.getBoundingClientRect()
      const p = el.dataset.scorri === 'uscita'
        ? (h / 2 - r.top - r.height / 2) / (h / 2 + r.height / 2)
        : (h - r.top) / (h + r.height)
      el.style.setProperty('--p', Math.min(Math.max(p, 0), 1).toFixed(3))
    }
  }
  const chiedi = () => { if (!atteso) atteso = requestAnimationFrame(aggiorna) }
  addEventListener('scroll', chiedi, { passive: true })
  addEventListener('resize', chiedi)
  aggiorna()

  // Col mouse la scena dell'apertura segue anche il puntatore.
  const scena = document.querySelector('.scena')
  if (scena && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let attesa = 0
    addEventListener('pointermove', (e) => {
      if (attesa) return
      attesa = requestAnimationFrame(() => {
        attesa = 0
        scena.style.setProperty('--mx', (e.clientX / innerWidth - 0.5).toFixed(3))
        scena.style.setProperty('--my', (e.clientY / innerHeight - 0.5).toFixed(3))
      })
    }, { passive: true })
  }
}
