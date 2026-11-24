import { useEffect, useMemo, useState } from 'react'
import citaceJson from '../data/zprava-citace.json'
import pruvodceJson from '../data/zprava.json'
import type { CitaceData, CitaceSekce, PruvodceData } from '../domain/zprava'
import { klicBodu, lhutyPodleSkupin, sestavFaze, spocitejHotove } from '../domain/zprava'
import type { Item } from '../domain/types'
import * as db from '../storage/db'
import { StavOdpovedi } from './bits'

const citace = citaceJson as unknown as CitaceData
const pruvodce = pruvodceJson as unknown as PruvodceData
const KLIC_ULOZENI = 'zpravaOdskrtnuto'

interface Props {
  items: Map<string, Item>
  onPracticeIds: (ids: string[], label: string) => void
}

export function Zprava({ items, onPracticeIds }: Props) {
  const faze = useMemo(() => sestavFaze(citace, pruvodce), [])
  const [hotove, setHotove] = useState<Record<string, boolean>>({})
  const [nacteno, setNacteno] = useState(false)

  // Odškrtnutí přežije refresh. Je to pomůcka při učení, ne záznam o revizi.
  useEffect(() => {
    void (async () => {
      const ulozene = await db.meta.get<Record<string, boolean>>(KLIC_ULOZENI)
      if (ulozene) setHotove(ulozene)
      setNacteno(true)
    })()
  }, [])

  function prepni(klic: string) {
    setHotove((h) => {
      const novy = { ...h, [klic]: !h[klic] }
      if (!novy[klic]) delete novy[klic]
      void db.meta.set(KLIC_ULOZENI, novy)
      return novy
    })
  }

  const { hotovo, celkem } = spocitejHotove(citace, hotove)

  return (
    <section>
      <h1>{pruvodce.nazev}</h1>
      <p>{pruvodce.uvod}</p>

      <div className="karta">
        <p style={{ marginTop: 0 }}>
          <strong>Co tu není:</strong>
        </p>
        <ul style={{ marginBottom: 0 }}>
          {pruvodce.comuNeni.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>

      <p className="tlumene">
        Odškrtnuto {hotovo} z {celkem} bodů. Zůstane to v prohlížeči — je to pomůcka při
        učení, ne záznam o provedené revizi.{' '}
        {hotovo > 0 && (
          <button
            className="odkazove"
            onClick={() => {
              setHotove({})
              void db.meta.set(KLIC_ULOZENI, {})
            }}
          >
            Odškrtnout vše
          </button>
        )}
      </p>

      {faze.map(({ faze: f, sekce, bodu }) => (
        <div key={f.id}>
          <h2>
            {f.nazev} <span className="tlumene">({bodu} bodů)</span>
          </h2>
          <p className="tlumene">{f.popis}</p>
          {sekce.map((s) => (
            <SekceKarta
              key={s.id}
              sekce={s}
              hotove={hotove}
              nacteno={nacteno}
              onPrepni={prepni}
              items={items}
              onPracticeIds={onPracticeIds}
            />
          ))}
        </div>
      ))}

      <h2>{citace.lhuty.nazev}</h2>
      <p className="tlumene">
        {pruvodce.poznamky['lhuty']}{' '}
        <span className="tlumene">(moje poznámka)</span>
      </p>
      {lhutyPodleSkupin(citace).map(({ skupina, radky }) => (
        <table key={skupina}>
          <caption className="tlumene" style={{ textAlign: 'left', paddingBottom: 6 }}>
            {skupina}
          </caption>
          <tbody>
            {radky.map((r) => (
              <tr key={r.co}>
                <th scope="row" style={{ fontWeight: 400, color: 'inherit', fontSize: '1rem' }}>
                  {r.co}
                </th>
                <td className="cislo" style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                  {r.lhuta}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
      <ul>
        {citace.lhuty.doplnky.map((b) => (
          <li key={b.znak}>{b.text}</li>
        ))}
      </ul>
      <h3>K lhůtám LPS</h3>
      <ul>
        {citace.lhuty.doplnkyLps.map((b) => (
          <li key={b.znak}>{b.text}</li>
        ))}
      </ul>
      <p>{citace.lhuty.zbytek}</p>
      <p className="norma">{citace.lhuty.zdroj}</p>
      <OtazkyKSekci
        ids={citace.lhuty.otazky}
        items={items}
        label="Procvičování: lhůty revizí"
        onPracticeIds={onPracticeIds}
      />

      <p className="tlumene">
        Citace vytahuje <code>{citace.skript}</code> ze souboru{' '}
        <code>{citace.zdroj.soubor}</code>. {citace.zdroj.poznamka}
      </p>
    </section>
  )
}

function SekceKarta({
  sekce,
  hotove,
  nacteno,
  onPrepni,
  items,
  onPracticeIds,
}: {
  sekce: CitaceSekce
  hotove: Record<string, boolean>
  nacteno: boolean
  onPrepni: (klic: string) => void
} & Props) {
  const poznamka = pruvodce.poznamky[sekce.id]
  const hotovychTu = sekce.body.filter((b) => hotove[klicBodu(sekce.id, b.znak)]).length
  return (
    <div className="karta">
      <h3 style={{ marginTop: 0 }}>
        {sekce.nazev}{' '}
        <span className="tlumene">
          {hotovychTu} / {sekce.body.length}
        </span>
      </h3>
      <p className="tlumene">{sekce.uvod}</p>
      {poznamka && (
        <p className="tlumene">
          {poznamka} <span className="tlumene">(moje poznámka, ne text předpisu)</span>
        </p>
      )}
      <ul className="cisty">
        {sekce.body.map((b) => {
          const klic = klicBodu(sekce.id, b.znak)
          return (
            <li key={b.znak}>
              <label className="zaskrtavaci" style={{ alignItems: 'flex-start' }}>
                <input
                  type="checkbox"
                  checked={!!hotove[klic]}
                  disabled={!nacteno}
                  onChange={() => onPrepni(klic)}
                />
                <span>
                  <strong>{b.znak})</strong> {b.text}
                </span>
              </label>
            </li>
          )
        })}
      </ul>
      <p className="norma">{sekce.zdroj}</p>
      <OtazkyKSekci
        ids={sekce.otazky}
        items={items}
        label={`Procvičování: ${sekce.nazev}`}
        onPracticeIds={onPracticeIds}
      />
    </div>
  )
}

function OtazkyKSekci({
  ids,
  items,
  label,
  onPracticeIds,
}: {
  ids: string[]
  items: Map<string, Item>
  label: string
} & Pick<Props, 'onPracticeIds'>) {
  if (ids.length === 0) {
    return (
      <p className="tlumene">
        Na tohle ustanovení se banka přímo neptá. Pro písemnou část to tedy není, pro práci ano.
      </p>
    )
  }
  const sOdpovedi = ids.filter((id) => items.get(id)?.answer != null)
  return (
    <>
      <p className="tlumene">Banka se na tohle ustanovení ptá {ids.length}×:</p>
      <ul>
        {ids.map((id) => {
          const it = items.get(id)
          if (!it) return <li key={id}>{id} — otázka v bance není</li>
          return (
            <li key={id}>
              <span className="znacka">
                {it.question.circuit} č. {it.question.number}
              </span>{' '}
              {it.question.text} <StavOdpovedi status={it.answer?.status ?? null} />
            </li>
          )
        })}
      </ul>
      {sOdpovedi.length > 0 && (
        <button onClick={() => onPracticeIds(sOdpovedi, label)}>
          Procvičit {sOdpovedi.length} z nich
        </button>
      )}
    </>
  )
}
