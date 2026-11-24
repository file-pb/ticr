import { useEffect, useMemo, useState } from 'react'
import type { Attempt, AttemptItem, Item } from '../domain/types'
import { remainingMs } from '../domain/score'
import { blockRemainingMs, hasBlocks, setItemInBlock } from '../domain/blocks'
import { Cas, StavOdpovedi } from './bits'

interface Props {
  attempt: Attempt
  items: Map<string, Item>
  /**
   * Index běžícího testu, nebo null, když pokus na testy dělený není
   * (procvičování a starší pokusy). V režimu testu se pracuje jen s jeho
   * úsekem otázek a čas i odevzdání patří testu, ne celému pokusu.
   */
  blockIndex: number | null
  /** Ve zkoušce se správná odpověď neukazuje před odevzdáním. */
  ukazatPrubeznouZpetnouVazbu: boolean
  onChange: (attempt: Attempt) => void
  onFinish: (attempt: Attempt) => void
  onToggleSaved: (questionId: string) => void
  savedIds: Set<string>
}

export function Runner({
  attempt,
  items,
  blockIndex,
  ukazatPrubeznouZpetnouVazbu,
  onChange,
  onFinish,
  onToggleSaved,
  savedIds,
}: Props) {
  const [index, setIndex] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [odevzdavam, setOdevzdavam] = useState(false)

  const blok =
    blockIndex !== null && hasBlocks(attempt) ? attempt.blocks[blockIndex] ?? null : null
  const od = blok ? blok.from : 0
  const pocet = blok ? blok.count : attempt.items.length
  const polozky = useMemo(() => attempt.items.slice(od, od + pocet), [attempt.items, od, pocet])

  const zbyva = blok ? blockRemainingMs(blok, now) : remainingMs(attempt, now)
  const lhuta = blok ? blok.deadlineAt : attempt.deadlineAt

  // Čas se čte z uloženého okamžiku konce, takže refresh ani uspání záložky
  // odpočet neposune. Interval jen překresluje.
  useEffect(() => {
    if (lhuta === null) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [lhuta])

  // Vypršení času odevzdává za zkoušeného. U testu se odevzdá test, ne pokus —
  // zbylé testy zkoušky tím nekončí.
  useEffect(() => {
    if (zbyva !== 0) return
    onFinish(blok ? attempt : { ...attempt, finishedAt: Date.now() })
  }, [zbyva, attempt, blok, onFinish])

  const aktualni = polozky[index]
  const item = aktualni ? items.get(aktualni.questionId) : undefined

  const nevyplnene = useMemo(
    () => polozky.filter((i) => i.chosenOptionId === null).length,
    [polozky],
  )

  if (!aktualni || !item || !item.answer) {
    return <p className="upozorneni">Otázku se nepodařilo složit — chybí k ní odpověď.</p>
  }

  const zvoleno = aktualni.chosenOptionId
  const odpovezeno = zvoleno !== null
  const ukazatVysledek = ukazatPrubeznouZpetnouVazbu && odpovezeno
  const spravne = zvoleno === item.answer.correctOptionId
  const nazev = blok ? blok.title : attempt.label

  function uprav(zmena: Partial<AttemptItem>) {
    onChange(setItemInBlock(attempt, blockIndex, index, zmena))
  }

  function odevzdej() {
    onFinish(blok ? attempt : { ...attempt, finishedAt: Date.now() })
  }

  const moznosti = aktualni.optionOrder
    .map((id) => item.answer!.options.find((o) => o.id === id))
    .filter((o): o is NonNullable<typeof o> => o !== undefined)

  return (
    <>
      <div className="radek rozestup">
        <p className="tlumene" style={{ margin: 0 }}>
          {blok && blockIndex !== null && hasBlocks(attempt) ? (
            <>
              Test {blockIndex + 1} ze {attempt.blocks.length} · {blok.title} ·{' '}
            </>
          ) : (
            <>{attempt.label} · </>
          )}
          otázka {index + 1} z {pocet} · okruh {item.question.circuit} · č.{' '}
          {item.question.number}
        </p>
        {zbyva !== null && <Cas ms={zbyva} />}
      </div>

      <div className="karta">
        <p className="otazka-text">{item.question.text}</p>
        <p className="norma">{item.question.normativeRef}</p>
        <div className="radek" style={{ marginTop: 8 }}>
          <StavOdpovedi status={item.answer.status} />
          <span className="tlumene">{item.question.id}</span>
        </div>

        <fieldset>
          <legend>Vyber jednu odpověď</legend>
          {moznosti.map((o, i) => {
            const jeSpravna = ukazatVysledek && o.id === item.answer!.correctOptionId
            const jeChybna = ukazatVysledek && o.id === zvoleno && !spravne
            return (
              <label
                key={o.id}
                className={
                  'moznost' + (jeSpravna ? ' je-spravna' : '') + (jeChybna ? ' je-chybna' : '')
                }
              >
                <input
                  type="radio"
                  name={'q-' + index}
                  checked={zvoleno === o.id}
                  disabled={ukazatVysledek}
                  onChange={() => uprav({ chosenOptionId: o.id })}
                />
                <span>
                  <span className="znacka">{'ABC'[i] ?? '?'})</span> {o.text}
                  {jeSpravna && <strong className="znacka spravne"> — správně</strong>}
                  {jeChybna && <strong className="znacka chybne"> — tvoje odpověď, nesprávně</strong>}
                </span>
              </label>
            )
          })}
        </fieldset>

        <div className="radek" style={{ marginTop: 14 }}>
          <label className="zaskrtavaci">
            <input
              type="checkbox"
              checked={aktualni.flagged}
              onChange={(e) => uprav({ flagged: e.target.checked })}
            />
            Vrátit se k ní
          </label>
          <label className="zaskrtavaci">
            <input
              type="checkbox"
              checked={aktualni.guessed}
              onChange={(e) => uprav({ guessed: e.target.checked })}
            />
            Tipoval jsem
          </label>
          <label className="zaskrtavaci">
            <input
              type="checkbox"
              checked={savedIds.has(item.question.id)}
              onChange={() => onToggleSaved(item.question.id)}
            />
            Uložit otázku
          </label>
        </div>

        {ukazatVysledek && (
          <div className="karta" style={{ marginBottom: 0 }}>
            <p>
              <strong className={'znacka ' + (spravne ? 'spravne' : 'chybne')}>
                {spravne ? '✓ Správně.' : '✗ Nesprávně.'}
              </strong>{' '}
              {item.answer.explanation}
            </p>
            {zvoleno && item.answer.whyWrong[zvoleno] && (
              <p className="tlumene">Proč ne tvoje odpověď: {item.answer.whyWrong[zvoleno]}</p>
            )}
            <p className="norma">{item.question.normativeRef}</p>
            {item.answer.verification && (
              <p className="tlumene">
                Ověřeno podle: {item.answer.verification.source} ({item.answer.verification.checkedAt})
              </p>
            )}
          </div>
        )}
      </div>

      <div className="radek rozestup">
        <div className="radek">
          <button onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>
            ← Předchozí
          </button>
          <button
            onClick={() => setIndex((i) => Math.min(pocet - 1, i + 1))}
            disabled={index === pocet - 1}
            className={ukazatVysledek ? 'hlavni' : undefined}
          >
            Další →
          </button>
        </div>
        <button className="hlavni" onClick={() => setOdevzdavam(true)}>
          {blok ? 'Vyhodnotit test' : attempt.deadlineAt === null ? 'Ukončit a vyhodnotit' : 'Odevzdat'}
        </button>
      </div>

      {odevzdavam && (
        <div className="karta" role="alertdialog" aria-label="Potvrzení odevzdání">
          <h3>{blok ? `Vyhodnotit ${nazev}?` : `Odevzdat ${attempt.label.toLowerCase()}?`}</h3>
          <p>
            {nevyplnene === 0
              ? 'Všechny otázky jsou vyplněné.'
              : `Nevyplněných otázek: ${nevyplnene}. Počítají se jako nesprávné.`}
          </p>
          {blok && (
            <p>
              <strong>Odevzdání testu je nevratné.</strong> Zpátky se k němu nedostaneš a výsledek
              se ukáže až po odevzdání posledního testu — stejně jako u zkoušky.
            </p>
          )}
          <div className="radek">
            <button className="hlavni" onClick={odevzdej}>
              {blok ? 'Vyhodnotit test' : 'Odevzdat'}
            </button>
            <button onClick={() => setOdevzdavam(false)}>Zpět k otázkám</button>
          </div>
        </div>
      )}

      <h2>Přehled otázek</h2>
      <p className="tlumene">
        Vyplněno {pocet - nevyplnene} z {pocet}. Vyplněná otázka má plný podklad, označená
        vlaječku.
      </p>
      <div className="prehled">
        {polozky.map((it, i) => (
          <button
            key={it.questionId}
            aria-current={i === index}
            aria-label={`Otázka ${i + 1}${it.chosenOptionId ? ', vyplněná' : ', nevyplněná'}${
              it.flagged ? ', označená' : ''
            }`}
            className={
              (it.chosenOptionId ? 'vyplnena' : '') + (it.flagged ? ' oznacena' : '')
            }
            onClick={() => setIndex(i)}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </>
  )
}
