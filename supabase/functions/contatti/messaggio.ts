// Il messaggio del modulo «Vuoi saperne di più?»: controllo dei campi e testo dell'email per
// info@. Niente rete e niente database, si prova con `deno test`.

export type Tipo = 'privato' | 'azienda'
export type Messaggio = { email: string; tipo: Tipo; oggetto: string; messaggio: string }

export const NOME_TIPO: Record<Tipo, string> = { privato: 'Privato', azienda: 'Azienda' }

// I limiti del modulo e della tabella privato.contatto: chi li cambia, li cambia in tutti e tre.
export const LIMITI = { email: 254, oggetto: [3, 150], messaggio: [10, 5000] } as const

export class ErroreModulo extends Error {}

// Basta che sembri un indirizzo: se e' sbagliato, la risposta non arriva e chi ha scritto lo
// vede da se'. Quello che conta e' che non entrino spazi o a capo nell'intestazione Reply-To.
const EMAIL = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/

// Caratteri di controllo via, tranne a capo e tab nel messaggio; l'oggetto sta su una riga.
// deno-lint-ignore no-control-regex
const senzaControllo = (t: string) => t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
const suUnaRiga = (t: string) => senzaControllo(t).replace(/[\r\n\t]+/g, ' ').replace(/ {2,}/g, ' ')

function testo(valore: unknown, campo: string, [min, max]: readonly [number, number], pulisci: (t: string) => string) {
  const t = typeof valore === 'string' ? pulisci(valore.replace(/\r\n?/g, '\n')).trim() : ''
  if (t.length < min) throw new ErroreModulo(`${campo}: almeno ${min} caratteri`)
  if (t.length > max) throw new ErroreModulo(`${campo}: al massimo ${max} caratteri`)
  return t
}

export function valida(p: Record<string, unknown>): Messaggio {
  const email = typeof p.email === 'string' ? p.email.trim() : ''
  if (!EMAIL.test(email) || email.length > LIMITI.email) throw new ErroreModulo('Controlla l’indirizzo email')
  if (p.tipo !== 'privato' && p.tipo !== 'azienda') throw new ErroreModulo('Scegli se scrivi come privato o come azienda')
  return {
    email,
    tipo: p.tipo,
    oggetto: testo(p.oggetto, 'Oggetto', LIMITI.oggetto, suUnaRiga),
    messaggio: testo(p.messaggio, 'Messaggio', LIMITI.messaggio, senzaControllo),
  }
}

// Le trappole per i programmi che riempiono i moduli da soli: il campo `sito`, nascosto alle
// persone, e un invio arrivato troppo presto dopo l'apertura della pagina. Chi ci cade riceve
// lo stesso «inviato», cosi' non impara cosa l'ha tradito.
export const MILLISECONDI_MINIMI = 3000

export function sembraAutomatico(p: Record<string, unknown>) {
  if (typeof p.sito === 'string' && p.sito.trim() !== '') return true
  return typeof p.durata !== 'number' || !Number.isFinite(p.durata) || p.durata < MILLISECONDI_MINIMI
}

// Solo testo: niente HTML da costruire con quello che scrive uno sconosciuto. Rispondendo
// all'email si risponde a chi ha scritto (Reply-To).
export function emailPerInfo(m: Messaggio, ricevuto: Date) {
  const quando = ricevuto.toLocaleString('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'long', timeStyle: 'short' })
  return {
    subject: `[Sito · ${NOME_TIPO[m.tipo]}] ${m.oggetto}`,
    text: [
      'Nuovo messaggio dal modulo «Vuoi saperne di più?» di nutriquore.it.',
      '',
      `Da: ${m.email}`,
      `Scrive come: ${NOME_TIPO[m.tipo]}`,
      `Ricevuto: ${quando}`,
      `Oggetto: ${m.oggetto}`,
      '',
      m.messaggio,
      '',
      '—',
      `Rispondi a questa email per scrivere a ${m.email}.`,
      'Il messaggio è anche nei pannelli admin e nutrizionista, sezione Messaggi.',
    ].join('\n'),
  }
}
