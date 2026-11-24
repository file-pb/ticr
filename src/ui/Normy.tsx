import { useMemo, useState } from 'react'
import normyJson from '../data/normy.json'
import skupinyJson from '../data/normy-skupiny.json'
import type { NormaPolozka, NormyData, SkupinyData } from '../domain/normy'
import {
  nejcitovanejsi,
  nejednotneZapsane,
  podilNejcitovanejsich,
  sestavMapu,
  vicEdic,
} from '../domain/normy'
import type { Item } from '../domain/types'
import { StavOdpovedi } from './bits'

const normy = normyJson as unknown as NormyData
const skupiny = skupinyJson as unknown as SkupinyData

/** Každá skupina dostane základ, zbytek šířky se dělí podle počtu odkazů.
 *  Bez základu by skupina se třemi odkazy byla proužek, na který se nedá kliknout. */
const ZAKLAD_PROCENT = 6

interface Props {
  items: Map<string, Item>
  onPracticeIds: (ids: string[], label: string) => void
}

export function Normy({ items, onPracticeIds }: Props) {
  const mapa = useMemo(() => sestavMapu(normy, skupiny), [])
  const [vybranaSkupina, setVybranaSkupina] = useState<string | null>(null)
  const [vybranaNorma, setVybranaNorma] = useState<string | null>(null)

  const skupina = mapa.vrstvy
    .flatMap((v) => v.skupiny)
    .find((s) => s.def.id === vybranaSkupina)
  const norma = normy.polozky.find((p) => p.klic === vybranaNorma)
  const top = nejcitovanejsi(normy, 10)
  const podilTop = podilNejcitovanejsich(normy, 5)
  const nejednotne = nejednotneZapsane(normy)
  const edicniPasti = vicEdic(normy)

  return (
    <section>
      <h1>{skupiny.nazev}</h1>
      <p className="upozorneni">
        <strong>Čísla jsou z banky, popisky jsou moje.</strong> {skupiny.varovani}
      </p>

      <p>
        Banka má <strong>{mapa.otazekVBance}</strong> otázek a{' '}
        <strong>{mapa.odkazuCelkem}</strong> odkazů na{' '}
        <strong>{normy.polozky.length}</strong> předpisů — odkaz, který jmenuje dva předpisy,
        se počítá u obou. Prvních pět předpisů nese{' '}
        <strong>{Math.round(podilTop * 100)} %</strong> všech odkazů.
      </p>

      <h2>Mapa</h2>
      <p className="tlumene">
        Šířka bloku odpovídá počtu odkazů, ne důležitosti. Každý blok má základ, aby i malá
        skupina zůstala čitelná. Kliknutím se skupina rozbalí.
      </p>

      {mapa.vrstvy.map((v) => (
        <div key={v.def.id} className="normy-vrstva">
          <h3>
            {v.def.nazev}{' '}
            <span className="tlumene">
              {v.odkazu} odkazů · {Math.round(v.podil * 100)} %
            </span>
          </h3>
          <p className="tlumene">{v.def.popis}</p>
          <div className="normy-pas">
            {v.skupiny.map((s) => {
              const podilVeVrstve = v.odkazu > 0 ? s.odkazu / v.odkazu : 0
              const sirka =
                ZAKLAD_PROCENT + (100 - ZAKLAD_PROCENT * v.skupiny.length) * podilVeVrstve
              return (
                <button
                  key={s.def.id}
                  className={'normy-blok' + (vybranaSkupina === s.def.id ? ' vybrany' : '')}
                  style={{ flexGrow: Math.max(1, sirka) }}
                  aria-pressed={vybranaSkupina === s.def.id}
                  onClick={() => {
                    setVybranaSkupina(s.def.id === vybranaSkupina ? null : s.def.id)
                    setVybranaNorma(null)
                  }}
                >
                  <span className="normy-blok-nazev">{s.def.zkratka}</span>
                  <span className="normy-blok-cislo">{s.odkazu}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {skupina && (
        <div className="karta">
          <h2 style={{ marginTop: 0 }}>{skupina.def.nazev}</h2>
          <p className="tlumene">{skupina.def.popis}</p>
          <p className="tlumene">
            {skupina.polozky.length} předpisů, {skupina.odkazu} odkazů z banky.
          </p>
          <div className="normy-sloupce">
            {skupina.polozky.map((p) => (
              <button
                key={p.klic}
                className={'normy-polozka' + (vybranaNorma === p.klic ? ' vybrany' : '')}
                aria-pressed={vybranaNorma === p.klic}
                onClick={() => setVybranaNorma(p.klic === vybranaNorma ? null : p.klic)}
              >
                <span className="normy-polozka-nazev">{p.oznaceni}</span>
                <span className="normy-polozka-cislo">{p.otazek}</span>
                <span
                  className="normy-polozka-pruh"
                  style={{ width: `${Math.round((p.otazek / skupina.polozky[0]!.otazek) * 100)}%` }}
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {norma && (
        <NormaDetail norma={norma} items={items} onPracticeIds={onPracticeIds} />
      )}

      <h2>Na čem zkouška stojí nejvíc</h2>
      <table>
        <thead>
          <tr>
            <th scope="col">Předpis</th>
            <th scope="col" className="cislo">Otázek</th>
            <th scope="col">Okruhy</th>
            <th scope="col">Edice</th>
          </tr>
        </thead>
        <tbody>
          {top.map((p) => (
            <tr key={p.klic}>
              <th scope="row">
                <button className="odkazove" onClick={() => {
                  setVybranaSkupina(p.skupina)
                  setVybranaNorma(p.klic)
                }}>
                  {p.oznaceni}
                </button>
              </th>
              <td className="cislo">{p.otazek}</td>
              <td className="tlumene">
                {Object.entries(p.podleOkruhu)
                  .sort()
                  .map(([c, n]) => `${c} ${n}`)
                  .join(', ')}
              </td>
              <td className="tlumene">{p.edice.join(', ') || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {edicniPasti.length > 0 && (
        <>
          <h2>Pozor na edici</h2>
          <p className="tlumene">
            U těchhle předpisů banka odkazuje na víc edic najednou. Starší edice téže normy
            může mít jinou hodnotu i jinou strukturu článků, takže otázku odkazující na starší
            edici nelze zodpovědět podle novější. Menšinová edice je obvykle jediná otázka,
            která se snadno přehlédne.
          </p>
          <ul>
            {edicniPasti.map((p) => (
              <li key={p.klic}>
                <strong>{p.oznaceni}</strong>
                <ul>
                  {Object.entries(p.otazkyPodleEdice)
                    .sort((a, b) => a[1].length - b[1].length)
                    .map(([edice, ids]) => (
                      <li key={edice}>
                        {edice}: {ids.length}{' '}
                        {ids.length <= 3 ? (
                          <>
                            —{' '}
                            {ids
                              .map((id) => {
                                const it = items.get(id)
                                return it ? `${it.question.circuit} č. ${it.question.number}` : id
                              })
                              .join(', ')}
                          </>
                        ) : (
                          'otázek'
                        )}
                      </li>
                    ))}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}

      {nejednotne.length > 0 && (
        <>
          <h2>Jeden předpis, dva zápisy</h2>
          <p className="tlumene">
            Tohle není chyba aplikace. Oficiální dokument TIČR píše tytéž normy různě; inventura
            je spojuje podle čísla, aby se jedna norma nerozpadla na dvě položky.
          </p>
          <ul>
            {nejednotne.map((p) => (
              <li key={p.klic}>
                <strong>{p.klic}</strong> — v bance jako {p.tvary.join(' a ')} ({p.otazek} otázek)
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="tlumene">
        Inventuru generuje <code>{normy.skript}</code> z banky {normy.bankVersion} (naposledy{' '}
        {normy.generovano}). {skupiny.doloz}
      </p>
    </section>
  )
}

function NormaDetail({
  norma,
  items,
  onPracticeIds,
}: { norma: NormaPolozka } & Props) {
  const sOdpovedi = norma.otazky.filter((id) => items.get(id)?.answer != null)
  return (
    <div className="karta">
      <h2 style={{ marginTop: 0 }}>{norma.oznaceni}</h2>
      {norma.popis ? (
        <p>
          {norma.popis} <span className="tlumene">(můj popisek, neověřený)</span>
        </p>
      ) : (
        <p className="tlumene">Popisek jsem nedoplnil — nebyl jsem si jistý, čeho se norma týká.</p>
      )}
      {norma.tvary.length > 1 && (
        <p className="tlumene">V bance zapsaná jako {norma.tvary.join(' a ')}.</p>
      )}
      <p className="tlumene">
        {norma.edice.length > 0 && (
          <>
            Edice:{' '}
            {Object.entries(norma.otazkyPodleEdice).length > 0
              ? Object.entries(norma.otazkyPodleEdice)
                  .map(([e, ids]) => `${e} (${ids.length})`)
                  .join(', ')
              : norma.edice.join(', ')}
            .{' '}
          </>
        )}
        {norma.roky.length > 0 && <>Rok vydání u odkazů: {norma.roky.join(', ')}. </>}
        Otázek {norma.otazek} —{' '}
        {Object.entries(norma.podleOkruhu).sort().map(([c, n]) => `${c} ${n}`).join(', ')}.
      </p>

      <ul>
        {norma.otazky.map((id) => {
          const it = items.get(id)
          if (!it) return <li key={id}>{id} — otázka v bance není</li>
          return (
            <li key={id}>
              <span className="znacka">
                {it.question.circuit} č. {it.question.number}
              </span>{' '}
              {it.question.text} <StavOdpovedi status={it.answer?.status ?? null} />
              <br />
              <span className="norma">{it.question.normativeRef}</span>
            </li>
          )
        })}
      </ul>

      {sOdpovedi.length > 0 ? (
        <button onClick={() => onPracticeIds(sOdpovedi, `Procvičování: ${norma.oznaceni}`)}>
          Procvičit {sOdpovedi.length} z nich
        </button>
      ) : (
        <p className="tlumene">
          Procvičovat je zatím nelze — žádná z nich nemá v klíči odpověď, kterou by šlo předložit.
        </p>
      )}
    </div>
  )
}
