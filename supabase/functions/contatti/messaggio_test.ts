import { assert, assertEquals, assertThrows } from 'jsr:@std/assert@1'
import { emailPerInfo, ErroreModulo, sembraAutomatico, valida } from './messaggio.ts'

const buono = { email: ' anna@esempio.it ', tipo: 'azienda', oggetto: 'Il nostro punto vendita', messaggio: 'Vorremmo capire come funziona.' }

Deno.test('valida: toglie gli spazi e tiene i campi', () => {
  assertEquals(valida(buono), { email: 'anna@esempio.it', tipo: 'azienda', oggetto: 'Il nostro punto vendita', messaggio: 'Vorremmo capire come funziona.' })
})

Deno.test('valida: rifiuta indirizzi che non sono indirizzi', () => {
  for (const email of ['', 'anna', 'anna@esempio', 'anna @esempio.it', 'anna@esempio.it\nBcc: x@y.it', 'Anna <anna@esempio.it>', 42]) {
    assertThrows(() => valida({ ...buono, email }), ErroreModulo)
  }
})

Deno.test('valida: il tipo è privato o azienda', () => {
  assertEquals(valida({ ...buono, tipo: 'privato' }).tipo, 'privato')
  for (const tipo of ['', 'customer', 'business', undefined]) assertThrows(() => valida({ ...buono, tipo }), ErroreModulo)
})

Deno.test('valida: oggetto su una riga, messaggio con gli a capo', () => {
  const m = valida({ ...buono, oggetto: 'Prima\r\nseconda\triga', messaggio: 'Riga uno\r\nriga due\u0007\n\nfine' })
  assertEquals(m.oggetto, 'Prima seconda riga')
  assertEquals(m.messaggio, 'Riga uno\nriga due\n\nfine')
})

Deno.test('valida: lunghezze', () => {
  assertThrows(() => valida({ ...buono, oggetto: 'ok' }), ErroreModulo, 'almeno 3')
  assertThrows(() => valida({ ...buono, oggetto: 'x'.repeat(151) }), ErroreModulo, 'al massimo 150')
  assertThrows(() => valida({ ...buono, messaggio: '   corto   ' }), ErroreModulo, 'almeno 10')
  assertThrows(() => valida({ ...buono, messaggio: 'x'.repeat(5001) }), ErroreModulo, 'al massimo 5000')
  assertEquals(valida({ ...buono, messaggio: 'x'.repeat(5000) }).messaggio.length, 5000)
})

Deno.test('sembraAutomatico: campo trappola pieno o invio troppo veloce', () => {
  assert(!sembraAutomatico({ durata: 20_000 }))
  assert(!sembraAutomatico({ durata: 20_000, sito: '' }))
  assert(sembraAutomatico({ durata: 20_000, sito: 'https://spam.example' }))
  assert(sembraAutomatico({ durata: 800 }))
  assert(sembraAutomatico({}))
  assert(sembraAutomatico({ durata: '9000' }))
})

Deno.test('emailPerInfo: oggetto col tipo, testo con mittente e messaggio', () => {
  const e = emailPerInfo(valida(buono), new Date('2026-10-21T14:30:00Z'))
  assertEquals(e.subject, '[Sito · Azienda] Il nostro punto vendita')
  assert(e.text.includes('Da: anna@esempio.it'))
  assert(e.text.includes('Ricevuto: 21 ottobre 2026'))
  assert(e.text.includes('16:30'))
  assert(e.text.includes('Vorremmo capire come funziona.'))
})
