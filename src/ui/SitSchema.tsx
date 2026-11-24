import type { SitSchema as Schema } from '../domain/site'

/**
 * Schéma druhu sítě. Kreslí se z popisu v `src/data/site.json`, ne jako
 * obrázek — jedno vykreslení pro všech pět druhů a žádný soubor, který by se
 * s obsahem rozešel.
 *
 * Kód sítě v obrázku **není**. V trenažéru je obrázek zadáním, takže by ho
 * popisek prozradil. Textový popis pro čtečku popisuje uspořádání vodičů
 * a uzemnění, tedy přesně to, co z obrázku vyčte vidící člověk — a kód sítě
 * taky neříká.
 */

const S = 22 // rozestup vodičů
const Y0 = 38 // první vodič
const X_ZDROJ = 86
const X_DELENI = 250
const X_ZATEZ = 404
const Y_ZEM = 190

function Zem({ x, y }: { x: number; y: number }) {
  return (
    <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <line x1={x - 16} y1={y} x2={x + 16} y2={y} />
      <line x1={x - 10} y1={y + 5} x2={x + 10} y2={y + 5} />
      <line x1={x - 4} y1={y + 10} x2={x + 4} y2={y + 10} />
    </g>
  )
}

/** Textový popis schématu. Používá ho čtečka i nápověda pod obrázkem. */
export function popisSchematu(schema: Schema): string {
  const casti: string[] = []
  casti.push(
    schema.zdroj === 'uzemneny'
      ? 'Jeden bod zdroje je přímo uzemněn.'
      : schema.zdroj === 'impedance'
        ? 'Jeden bod zdroje je spojen se zemí přes impedanci.'
        : 'Zdroj je od země izolovaný.',
  )
  const delene = schema.vodice.find((v) => v.deleniNa)
  if (delene) {
    casti.push(
      `Od zdroje vedou vodiče ${schema.vodice.map((v) => v.znak).join(', ')}; ` +
        `vodič ${delene.znak} se v jednom bodě dělí na ${delene.deleniNa!.join(' a ')}.`,
    )
  } else {
    casti.push(`Od zdroje vedou vodiče ${schema.vodice.map((v) => v.znak).join(', ')}.`)
  }
  casti.push(
    schema.neziveCasti === 'vlastniZemnic'
      ? 'Neživé části zátěže jsou uzemněné vlastním zemničem, nezávislým na uzemnění zdroje.'
      : `Neživé části zátěže jsou připojené na vodič ${schema.neziveCasti}.`,
  )
  return casti.join(' ')
}

export function SitSchema({ schema, popisek }: { schema: Schema; popisek?: string }) {
  const rady: { znak: string; y: number; odX: number; doX: number; ochranny: boolean }[] = []
  let i = 0
  for (const v of schema.vodice) {
    const y = Y0 + i * S
    if (v.deleniNa) {
      rady.push({ znak: v.znak, y, odX: X_ZDROJ, doX: X_DELENI, ochranny: true })
      rady.push({ znak: v.deleniNa[0]!, y, odX: X_DELENI, doX: X_ZATEZ, ochranny: false })
      i++
      rady.push({
        znak: v.deleniNa[1]!,
        y: Y0 + i * S,
        odX: X_DELENI,
        doX: X_ZATEZ,
        ochranny: true,
      })
    } else {
      rady.push({
        znak: v.znak,
        y,
        odX: X_ZDROJ,
        doX: X_ZATEZ,
        ochranny: v.znak === schema.neziveCasti,
      })
    }
    i++
  }
  const vyska = Y_ZEM + 26
  const popis = popisSchematu(schema)

  return (
    <svg
      className="sit-schema"
      viewBox={`0 0 520 ${vyska}`}
      role="img"
      aria-label={popisek ? `${popisek} ${popis}` : popis}
    >
      <rect x="8" y="24" width="78" height={Math.max(96, rady[rady.length - 1]!.y - 10)}
        rx="6" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <text x="47" y="20" textAnchor="middle" className="sit-popisek">zdroj</text>

      {schema.zdroj === 'uzemneny' && (
        <>
          <line x1="47" y1={Math.max(120, rady[rady.length - 1]!.y + 14)} x2="47" y2={Y_ZEM}
            stroke="currentColor" strokeWidth="1.6" />
          <Zem x={47} y={Y_ZEM} />
        </>
      )}
      {schema.zdroj !== 'uzemneny' && (
        <>
          <line x1="47" y1={Math.max(120, rady[rady.length - 1]!.y + 14)} x2="47" y2={Y_ZEM - 14}
            stroke="currentColor" strokeWidth="1.6" strokeDasharray="4 4" />
          <text x="47" y={Y_ZEM + 6} textAnchor="middle" className="sit-popisek">
            {schema.zdroj === 'impedance' ? 'přes impedanci' : 'izolováno'}
          </text>
        </>
      )}

      {rady.map((r) => (
        <g key={`${r.znak}-${r.y}-${r.odX}`}>
          <line x1={r.odX} y1={r.y} x2={r.doX} y2={r.y}
            stroke={r.ochranny ? 'var(--akcent)' : 'currentColor'}
            strokeWidth={r.ochranny ? 2.4 : 1.6} />
          <text x={r.odX + 6} y={r.y - 6} className="sit-popisek">{r.znak}</text>
        </g>
      ))}

      {schema.vodice.some((v) => v.deleniNa) && (
        <>
          <circle cx={X_DELENI} cy={Y0 + (schema.vodice.length - 1) * S} r="3.4" fill="var(--akcent)" />
          <text x={X_DELENI} y={Y0 + (schema.vodice.length - 1) * S + 42} textAnchor="middle"
            className="sit-popisek">bod rozdělení</text>
        </>
      )}

      <rect x={X_ZATEZ} y="24" width="100" height={Math.max(96, rady[rady.length - 1]!.y - 10)}
        rx="6" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <text x={X_ZATEZ + 50} y="20" textAnchor="middle" className="sit-popisek">neživá část</text>

      {schema.neziveCasti === 'vlastniZemnic' && (
        <>
          <line x1={X_ZATEZ + 50} y1={Math.max(120, rady[rady.length - 1]!.y + 14)}
            x2={X_ZATEZ + 50} y2={Y_ZEM} stroke="var(--akcent)" strokeWidth="2.4" />
          <Zem x={X_ZATEZ + 50} y={Y_ZEM} />
          <text x={X_ZATEZ + 50} y={Y_ZEM + 24} textAnchor="middle" className="sit-popisek">
            vlastní zemnič
          </text>
        </>
      )}
    </svg>
  )
}
