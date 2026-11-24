import type { AnswerStatus, Bank } from '../domain/types'
import type { CircuitCoverage } from '../domain/bank'

const POPIS: Record<AnswerStatus | 'chybi', string> = {
  overeno: 'ověřeno',
  navrh: 'návrh, neověřeno',
  sporne: 'sporné',
  chybi: 'bez odpovědi',
}

export function StavOdpovedi({ status }: { status: AnswerStatus | null }) {
  const key = status ?? 'chybi'
  return <span className={'odznak ' + key}>{POPIS[key]}</span>
}

/**
 * Počet se skloňováním, v prvním pádě. Předvolba zkoušky jsou čtyři testy po
 * patnácti otázkách, ale je přepsatelná — text se nesmí vázat na konkrétní
 * číslo. Druhý pád se píše natvrdo („ze 4 testů“), ten je pro všechny počty
 * stejný.
 */
export function pocet(n: number, jedna: string, dva: string, pet: string): string {
  if (n === 1) return `${n} ${jedna}`
  return n < 5 ? `${n} ${dva}` : `${n} ${pet}`
}

export const pocetTestu = (n: number) => pocet(n, 'test', 'testy', 'testů')
export const pocetOtazek = (n: number) => pocet(n, 'otázka', 'otázky', 'otázek')

export function Cas({ ms }: { ms: number }) {
  const t = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  const text = h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
  return (
    <span className={'cas' + (ms < 5 * 60_000 ? ' mala-rezerva' : '')}>
      <span aria-hidden="true">⏱ </span>
      <span className="tlumene">zbývá </span>
      {text}
    </span>
  )
}

export function PokrytiTabulka({ pokryti }: { pokryti: CircuitCoverage[] }) {
  const soucet = (k: keyof CircuitCoverage) =>
    pokryti.reduce((a, c) => a + (typeof c[k] === 'number' ? (c[k] as number) : 0), 0)
  return (
    <table>
      <caption className="tlumene" style={{ textAlign: 'left', paddingBottom: 6 }}>
        Pokrytí banky odpověďmi. Zkouška nanečisto losuje jen z ověřených.
      </caption>
      <thead>
        <tr>
          <th scope="col">Okruh</th>
          <th scope="col" className="cislo">Otázek</th>
          <th scope="col" className="cislo">Ověřeno</th>
          <th scope="col" className="cislo">Návrh</th>
          <th scope="col" className="cislo">Sporné</th>
          <th scope="col" className="cislo">Bez odpovědi</th>
        </tr>
      </thead>
      <tbody>
        {pokryti.map((c) => (
          <tr key={c.circuit}>
            <th scope="row">
              {c.circuit} — {c.title}
            </th>
            <td className="cislo">{c.total}</td>
            <td className="cislo">{c.overeno}</td>
            <td className="cislo">{c.navrh}</td>
            <td className="cislo">{c.sporne}</td>
            <td className="cislo">{c.bezOdpovedi}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row">celkem</th>
          <td className="cislo">{soucet('total')}</td>
          <td className="cislo">{soucet('overeno')}</td>
          <td className="cislo">{soucet('navrh')}</td>
          <td className="cislo">{soucet('sporne')}</td>
          <td className="cislo">{soucet('bezOdpovedi')}</td>
        </tr>
      </tfoot>
    </table>
  )
}

export function PuvodBanky({ bank }: { bank: Bank }) {
  return (
    <p className="tlumene">
      Banka {bank.bankVersion}, platnost od {bank.validFrom}. Zdroj{' '}
      <a href={bank.provenance.pageUrl} target="_blank" rel="noopener noreferrer">
        ticr.eu
      </a>
      , importováno {bank.provenance.importedAt}, kontrolní součet archivu{' '}
      <code>{bank.provenance.zipSha256?.slice(0, 12) ?? 'neznámý'}…</code>
    </p>
  )
}

export function UcebniUpozorneni() {
  return (
    <p className="upozorneni">
      <strong>Možnosti A/B/C jsou učební.</strong> Oficiální dokumenty TIČR zveřejňují znění
      otázek a odkazy na předpisy, ne možnosti ani klíč správných odpovědí. Aplikace procvičuje
      písemnou část zkoušky.
    </p>
  )
}
