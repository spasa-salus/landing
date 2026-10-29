// Edge Function del modulo «Vuoi saperne di più?» della landing (/ e /supermercati/).
// Pubblica: chi scrive dal sito non ha un account. Salva il messaggio, cifrato, in privato.contatto, dove lo
// leggono i pannelli admin e nutrizionista (sezione Messaggi, dalla funzione `admin`), e lo
// inoltra per email a info@nutriquore.it con Resend. Prima si salva, poi si manda: se l'email non
// parte, il messaggio resta nei pannelli col motivo.
//
// Deploy senza verifica JWT:
//   supabase functions deploy contatti --no-verify-jwt
//
// Segreti: RESEND_API_KEY (senza, i messaggi arrivano solo nei pannelli). Facoltativi:
// CONTATTI_A (destinatario, di base info@nutriquore.it), CONTATTI_DA (mittente, su un dominio
// verificato in Resend), CONTATTI_ORIGINE (le origini del sito separate da virgola; senza, qualunque).
//
// Una sola rotta, POST { email, tipo, oggetto, messaggio, sito, durata }.

import postgres from 'npm:postgres@3.4.5'
import { emailPerInfo, ErroreModulo, type Messaggio, sembraAutomatico, valida } from './messaggio.ts'

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 2 })

const CHIAVE_RESEND = Deno.env.get('RESEND_API_KEY') ?? ''
const A = Deno.env.get('CONTATTI_A') ?? 'info@nutriquore.it'
const DA = Deno.env.get('CONTATTI_DA') ?? 'NutriQuore <sito@nutriquore.it>'

// ponytail: tetti per indirizzo e complessivi, non per IP (servirebbe fidarsi di x-forwarded-for).
// Chi riempie il modulo a raffica lo blocca per un'ora a tutti: resta l'indirizzo scritto sotto.
const PER_EMAIL_AL_GIORNO = 3
const IN_TUTTO_ALL_ORA = 30
const CORPO_MASSIMO = 20_000

const ORIGINI = Deno.env.get('CONTATTI_ORIGINE')?.split(',').map((o) => o.trim()).filter(Boolean)

function cors(req: Request) {
  const origine = req.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': !ORIGINI ? '*' : ORIGINI.includes(origine) ? origine : ORIGINI[0],
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

function risposta(req: Request, corpo: unknown, stato = 200) {
  return new Response(JSON.stringify(corpo), {
    status: stato,
    headers: { ...cors(req), 'Content-Type': 'application/json' },
  })
}

class Errore extends Error {
  constructor(readonly stato: number, messaggio: string) {
    super(messaggio)
  }
}

async function controllaTetti(email: string) {
  const [{ suo, tutti }] = await sql`
    select count(*) filter (where email_impronta = privato.impronta(${email}) and creato_il > now() - interval '1 day')::int as suo,
           count(*) filter (where creato_il > now() - interval '1 hour')::int as tutti
    from privato.contatto
    where creato_il > now() - interval '1 day'`
  if (suo >= PER_EMAIL_AL_GIORNO) throw new Errore(429, 'Ci hai già scritto più volte oggi: ti rispondiamo appena possibile.')
  if (tutti >= IN_TUTTO_ALL_ORA) throw new Errore(429, `Troppi messaggi in questo momento: riprova fra un po’ o scrivi a ${A}.`)
}

// null = partita; altrimenti il motivo, che finisce nel pannello.
async function inoltra(m: Messaggio, id: string, ricevuto: Date): Promise<string | null> {
  if (!CHIAVE_RESEND) return 'RESEND_API_KEY non impostata'
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CHIAVE_RESEND}`,
        'Content-Type': 'application/json',
        // Un nuovo tentativo dello stesso messaggio non manda due email.
        'Idempotency-Key': `contatto-${id}`,
      },
      body: JSON.stringify({ from: DA, to: [A], reply_to: m.email, ...emailPerInfo(m, ricevuto) }),
      signal: AbortSignal.timeout(10_000),
    })
    if (r.ok) return null
    return `Resend ${r.status}: ${(await r.text()).slice(0, 300)}`
  } catch (e) {
    return `Resend irraggiungibile: ${(e as Error).message}`.slice(0, 300)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors(req) })
  if (req.method !== 'POST') return risposta(req, { errore: 'Solo POST' }, 405)
  try {
    const grezzo = await req.text()
    if (grezzo.length > CORPO_MASSIMO) throw new Errore(413, 'Messaggio troppo lungo')
    let p: Record<string, unknown>
    try {
      p = JSON.parse(grezzo)
    } catch {
      throw new Errore(400, 'Richiesta non valida')
    }
    if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Errore(400, 'Richiesta non valida')

    const m = valida(p)
    if (sembraAutomatico(p)) return risposta(req, { inviato: true })
    await controllaTetti(m.email)

    const [riga] = await sql`
      insert into privato.contatto (tipo, dati, email_impronta)
      values (${m.tipo}, privato.cifra(${sql.json({ email: m.email, oggetto: m.oggetto, messaggio: m.messaggio })}::jsonb),
              privato.impronta(${m.email}))
      returning id, creato_il`
    const errore = await inoltra(m, riga.id, new Date(riga.creato_il))
    await sql`update privato.contatto set inoltrato = ${errore === null}, errore_inoltro = ${errore} where id = ${riga.id}`
    if (errore) console.error('contatti: inoltro', riga.id, errore)
    return risposta(req, { inviato: true })
  } catch (e) {
    if (e instanceof Errore) return risposta(req, { errore: e.message }, e.stato)
    if (e instanceof ErroreModulo) return risposta(req, { errore: e.message }, 400)
    console.error(e)
    return risposta(req, { errore: 'Errore interno' }, 500)
  }
})
