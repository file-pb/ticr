import { useMemo, useState } from 'react'
import sitJson from '../data/site.json'
import sitOtazkyJson from '../data/site-otazky.json'
import type { SitData, SitDruh, SitOtazky, Ukol } from '../domain/site'
import { poradiMoznosti, sestavUkoly, vyhodnot } from '../domain/site'
import { mulberry32, newSeed } from '../domain/rng'
import type { Item } from '../domain/types'
import { SitSchema, popisSchematu } from './SitSchema'
import { StavOdpovedi } from './bits'

const data = sitJson as unknown as SitData
const temata = sitOtazkyJson as unknown as SitOtazky

interface Props {
  items: Map<string, Item>
  /** Pustí procvičování nad otázkami z banky. Trenažér sám do pokroku nezapisuje. */
  onPracticeIds: (ids: string[], label: string) => void
}

export function Site({ items, onPracticeIds }: Props) {
  const [rezim, setRezim] = useState<'uceni' | 'kviz'>('uceni')
  const [seed, setSeed] = useState(() => newSeed())
  const [jenUkoly, setJenUkoly] = useState<string[] | null>(null)

  const ukoly = useMemo(() => {
    const vsechny = sestavUkoly(data, mulberry32(seed))
    return jenUkoly ? vsechny.filter((u) => jenUkoly.includes(u.id)) : vsechny
  }, [seed, jenUkoly])

  return (
    <section>
      <h1>{data.nazev}</h1>
      <p className="upozorneni">
        <strong>Učební text, neověřený proti normě.</strong> {data.varovani}
      </p>
      <p className="tlumene">{data.doloz}</p>

      <div className="radek">
        <button
          className={rezim === 'uceni' ? 'hlavni' : undefined}
          aria-pressed={rezim === 'uceni'}
          onClick={() => setRezim('uceni')}
        >
          Učit se
        </button>
        <button
          className={rezim === 'kviz' ? 'hlavni' : undefined}
          aria-pressed={rezim === 'kviz'}
          onClick={() => {
            setJenUkoly(null)
            setSeed(newSeed())
            setRezim('kviz')
          }}
        >
          Rozpoznávat
        </button>
      </div>

      {rezim === 'uceni' ? (
        <Uceni items={items} onPracticeIds={onPracticeIds} />
      ) : (
        <Kviz
          key={`${seed}-${jenUkoly?.length ?? 0}`}
          ukoly={ukoly}
          seed={seed}
          onZnovu={() => {
            setJenUkoly(null)
            setSeed(newSeed())
          }}
          onChyby={(ids) => {
            setJenUkoly(ids)
            setSeed(newSeed())
          }}
        />
      )}
    </section>
  )
}

function Uceni({ items, onPracticeIds }: Props) {
  return (
    <>
      <h2>Co znamenají písmena</h2>
      <table>
        <thead>
          <tr>
            <th scope="col">Pozice</th>
            <th scope="col">Co popisuje</th>
            <th scope="col">Varianty</th>
          </tr>
        </thead>
        <tbody>
          {data.pismena.map((p) => (
            <tr key={p.pozice}>
              <th scope="row">{p.pozice}</th>
              <td>{p.vyznam}</td>
              <td>
                {p.varianty.map((v) => (
                  <p key={v.znak} style={{ margin: '2px 0' }}>
                    <strong>{v.znak}</strong> — {v.popis}
                  </p>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {data.druhy.map((d) => (
        <DruhKarta key={d.id} druh={d} items={items} onPracticeIds={onPracticeIds} />
      ))}

      <h2>Otázky z banky k vodiči PEN a k označování sítí</h2>
      <p className="tlumene">
        Nepatří pod jediný druh sítě. Přiřazení je mechanické, podle kódu ve znění otázky —
        generuje ho <code>{temata.skript}</code> z banky {temata.bankVersion}.
      </p>
      <OtazkySeznamu
        ids={temata.temata.spolecne ?? []}
        items={items}
        label="Procvičování: PEN a označování sítí"
        onPracticeIds={onPracticeIds}
      />
    </>
  )
}

function DruhKarta({
  druh,
  items,
  onPracticeIds,
}: { druh: SitDruh } & Props) {
  const ids = temata.temata[druh.id] ?? []
  return (
    <div className="karta rozestup">
      <h2 style={{ marginTop: 0 }}>
        {druh.kod} <span className="tlumene">— {druh.nazev}</span>
      </h2>
      <SitSchema schema={druh.schema} popisek={`Schéma sítě ${druh.kod}.`} />
      <p className="tlumene">{popisSchematu(druh.schema)}</p>

      <h3>Z čeho se kód skládá</h3>
      <ul>
        {druh.rozpad.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>

      <h3>Čím se síť pozná</h3>
      <ul>
        {druh.znaky.map((z) => (
          <li key={z}>{z}</li>
        ))}
      </ul>

      {druh.zameny.length > 0 && (
        <>
          <h3>S čím se plete</h3>
          <ul>
            {druh.zameny.map((z) => (
              <li key={z.s}>
                <strong>{z.s}:</strong> {z.cim}
              </li>
            ))}
          </ul>
        </>
      )}

      <h3>Na co se ptá banka ({ids.length})</h3>
      <OtazkySeznamu
        ids={ids}
        items={items}
        label={`Procvičování: síť ${druh.kod}`}
        onPracticeIds={onPracticeIds}
      />
    </div>
  )
}

function OtazkySeznamu({
  ids,
  items,
  label,
  onPracticeIds,
}: {
  ids: string[]
  items: Map<string, Item>
  label: string
  onPracticeIds: (ids: string[], label: string) => void
}) {
  if (ids.length === 0) return <p className="tlumene">Žádná otázka v bance kód přímo nejmenuje.</p>
  const sOdpovedi = ids.filter((id) => items.get(id)?.answer != null)
  return (
    <>
      <ul>
        {ids.map((id) => {
          const it = items.get(id)
          if (!it) return <li key={id}>{id} — otázka v bance není</li>
          return (
            <li key={id}>
              <span className="znacka">{it.question.circuit} č. {it.question.number}</span>{' '}
              {it.question.text} <StavOdpovedi status={it.answer?.status ?? null} />
              <br />
              <span className="norma">{it.question.normativeRef}</span>
            </li>
          )
        })}
      </ul>
      {sOdpovedi.length > 0 ? (
        <button onClick={() => onPracticeIds(sOdpovedi, label)}>
          Procvičit {sOdpovedi.length} z nich
        </button>
      ) : (
        <p className="tlumene">
          Procvičovat je zatím nelze — žádná z nich nemá v klíči odpověď, kterou by šlo předložit.
        </p>
      )}
    </>
  )
}

function Kviz({
  ukoly,
  seed,
  onZnovu,
  onChyby,
}: {
  ukoly: Ukol[]
  seed: number
  onZnovu: () => void
  onChyby: (ids: string[]) => void
}) {
  const [index, setIndex] = useState(0)
  const [volby, setVolby] = useState<Record<string, string | null>>({})
  const ukol = ukoly[index]

  const poradi = useMemo(
    () => (ukol ? poradiMoznosti(ukol, mulberry32(seed + index)) : []),
    [ukol, seed, index],
  )

  const vysledek = vyhodnot(ukoly, volby)
  const hotovo = vysledek.zodpovezeno === ukoly.length

  if (!ukol) {
    return (
      <p>
        Žádná úloha. <button onClick={onZnovu}>Začít znovu</button>
      </p>
    )
  }

  const volba = volby[ukol.id] ?? null
  const odpovezeno = volba !== null
  const druh = ukol.schemaDruhId ? data.druhy.find((d) => d.id === ukol.schemaDruhId) : undefined

  return (
    <div className="karta rozestup">
      <p className="tlumene">
        Úloha {index + 1} z {ukoly.length} · správně {vysledek.spravne} z {vysledek.zodpovezeno}
      </p>

      <p className="otazka-text">{ukol.zadani}</p>
      {druh && <SitSchema schema={druh.schema} />}

      <fieldset>
        <legend className="tlumene">Vyber jednu možnost</legend>
        {poradi.map((mid) => {
          const m = ukol.moznosti.find((x) => x.id === mid)!
          const jeSpravna = mid === ukol.spravnaId
          const trida = !odpovezeno
            ? 'moznost'
            : 'moznost' + (jeSpravna ? ' je-spravna' : mid === volba ? ' je-chybna' : '')
          return (
            <label key={mid} className={trida}>
              <input
                type="radio"
                name={ukol.id}
                checked={volba === mid}
                disabled={odpovezeno}
                onChange={() => setVolby((v) => ({ ...v, [ukol.id]: mid }))}
              />{' '}
              {m.text}
            </label>
          )
        })}
      </fieldset>

      {odpovezeno && (
        <div className="karta" style={{ marginBottom: 0 }}>
          <p>
            <strong className={'znacka ' + (volba === ukol.spravnaId ? 'spravne' : 'chybne')}>
              {volba === ukol.spravnaId ? '✓ Správně.' : '✗ Nesprávně.'}
            </strong>{' '}
            {ukol.vysvetleni}
          </p>
          <p className="tlumene">
            Učební text, neověřený proti normě — doložit podle ČSN uvedených nahoře.
          </p>
        </div>
      )}

      <div className="radek">
        <button disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
          ← Předchozí
        </button>
        <button
          disabled={index >= ukoly.length - 1}
          onClick={() => setIndex((i) => i + 1)}
          className={odpovezeno ? 'hlavni' : undefined}
        >
          Další →
        </button>
      </div>

      {hotovo && (
        <>
          <h3>
            Hotovo — {vysledek.spravne} z {ukoly.length}
          </h3>
          <p className="tlumene">
            Výsledek se nikam neukládá. Trenažér nezapisuje do pokroku ani do historie pokusů,
            protože jeho obsah není ověřený proti normě.
          </p>
          <div className="radek">
            <button onClick={onZnovu}>Znovu, jiné pořadí</button>
            {vysledek.chybne.length > 0 && (
              <button className="hlavni" onClick={() => onChyby(vysledek.chybne)}>
                Zopakovat {vysledek.chybne.length} chyb
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
