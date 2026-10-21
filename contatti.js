// Il modulo «Vuoi saperne di più?» (#contatti, su / e su /supermercati/). Lo manda alla funzione
// `contatti` (window.NQ.CONTATTI), che lo salva per i pannelli admin e nutrizionista e lo inoltra
// a info@nutriquore.it. Senza JavaScript, o senza indirizzo, il modulo apre il programma di posta.

const NOME_TIPO = { privato: 'Privato', azienda: 'Azienda' }
const SCRIVI_A = 'scrivi a info@nutriquore.it'

const modulo = document.getElementById('modulo-contatti')
const grazie = document.getElementById('contatti-grazie')
const indirizzo = window.NQ?.CONTATTI

if (modulo && grazie && indirizzo) {
  const esito = modulo.querySelector('.esito')
  const bottone = modulo.querySelector('button[type="submit"]')

  const scrivi = (testo, errore = false) => {
    esito.textContent = testo
    esito.classList.toggle('errore', errore)
  }

  modulo.addEventListener('submit', async (e) => {
    e.preventDefault()
    const dati = Object.fromEntries(new FormData(modulo))
    bottone.disabled = true
    scrivi('Invio in corso…')
    try {
      const r = await fetch(indirizzo, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // durata: da quanto la pagina è aperta. Un invio dopo pochi istanti non l'ha scritto una persona.
        body: JSON.stringify({ ...dati, durata: Math.round(performance.now()) }),
      })
      const corpo = await r.json().catch(() => ({}))
      if (!r.ok) return scrivi(corpo.errore ?? `Il messaggio non è partito. Riprova, o ${SCRIVI_A}.`, true)

      grazie.querySelector('[data-campo="email"]').textContent = dati.email
      grazie.querySelector('[data-campo="tipo"]').textContent = NOME_TIPO[dati.tipo] ?? dati.tipo
      grazie.querySelector('[data-campo="oggetto"]').textContent = dati.oggetto
      scrivi('')
      modulo.hidden = true
      grazie.hidden = false
      grazie.focus()
    } catch {
      scrivi(`Non riusciamo a raggiungere il server: controlla la connessione e riprova, o ${SCRIVI_A}.`, true)
    } finally {
      bottone.disabled = false
    }
  })

  // Un altro messaggio: email e «scrivi come» restano, oggetto e testo si svuotano.
  grazie.querySelector('[data-altro]').addEventListener('click', () => {
    modulo.elements.oggetto.value = ''
    modulo.elements.messaggio.value = ''
    grazie.hidden = true
    modulo.hidden = false
    modulo.elements.oggetto.focus()
  })
}
