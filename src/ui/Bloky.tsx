import { useEffect, useState } from 'react'
import type { Attempt, AttemptBlock } from '../domain/types'
import { allBlocksSubmitted, blockRemainingMs, blockState, runningBlockIndex } from '../domain/blocks'
import { Cas, pocetOtazek, pocetTestu } from './bits'

interface Props {
  attempt: Attempt & { blocks: AttemptBlock[] }
  onStart: (index: number) => void
  onResume: (index: number) => void
  onEvaluate: () => void
  /** Uzavře nedokončenou zkoušku. Zbylé otázky se počítají jako nesprávné. */
  onAbandon: () => void
}

function trvani(ms: number): string {
  const m = Math.floor(ms / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return `${m} min ${String(s).padStart(2, '0')} s`
}

export function Bloky({ attempt, onStart, onResume, onEvaluate, onAbandon }: Props) {
  const [now, setNow] = useState(() => Date.now())
  const [koncim, setKoncim] = useState(false)

  const bezi = runningBlockIndex(attempt)
  const hotovo = allBlocksSubmitted(attempt)
  const odevzdano = attempt.blocks.filter((b) => b.submittedAt !== null).length

  // Běžícímu testu dotikává čas i na tomhle rozcestníku, protože se počítá
  // z uloženého okamžiku konce. Interval jen překresluje.
  useEffect(() => {
    if (bezi === null) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [bezi])

  return (
    <>
      <h1>{attempt.label}</h1>

      <div className="karta">
        <p style={{ marginTop: 0 }}>
          Zkouška jsou{' '}
          <strong>
            {pocetTestu(attempt.blocks.length)} po {attempt.blocks[0]?.count} otázkách
          </strong>
          , na každý {attempt.blocks[0]?.minutes} minut. Pořadí si volíš ty a čas se mezi testy
          nepřenáší.
        </p>
        <p>
          <strong>Odevzdaný test se už neotevře</strong> a výsledek se neukáže dřív než po
          odevzdání posledního. Hranice {attempt.thresholdPercent} % se pak počítá z celých{' '}
          {attempt.items.length} otázek, ne po testech.
        </p>
        <p className="tlumene" style={{ marginBottom: 0 }}>
          Takhle průběh zkoušky popsal přednášející kurzu ESČ 23. 11. 2026. Je to druhotný zdroj,
          ne dokument TIČR.
        </p>
      </div>

      <h2>Testy</h2>
      <ul className="cisty">
        {attempt.blocks.map((b, i) => {
          const stav = blockState(b)
          const zbyva = blockRemainingMs(b, now)
          const vyplneno = attempt.items
            .slice(b.from, b.from + b.count)
            .filter((it) => it.chosenOptionId !== null).length
          return (
            <li key={b.circuit} className="karta">
              <div className="radek rozestup">
                <div>
                  <p style={{ margin: 0 }}>
                    <strong>
                      Test {i + 1} — {b.title}
                    </strong>
                  </p>
                  <p className="tlumene" style={{ margin: '4px 0 0' }}>
                    okruh {b.circuit} · {pocetOtazek(b.count)} · {b.minutes} minut
                    {stav === 'odevzdany' && (
                      <>
                        {' '}
                        · odevzdáno
                        {b.startedAt !== null && b.submittedAt !== null
                          ? `, využito ${trvani(b.submittedAt - b.startedAt)}`
                          : ''}
                        {` · vyplněno ${vyplneno} z ${b.count}`}
                      </>
                    )}
                  </p>
                </div>
                <div className="radek">
                  {stav === 'bezi' && zbyva !== null && <Cas ms={zbyva} />}
                  {stav === 'nezahajeny' && (
                    <button
                      className={bezi === null ? 'hlavni' : undefined}
                      disabled={bezi !== null}
                      onClick={() => onStart(i)}
                    >
                      Spustit test
                    </button>
                  )}
                  {stav === 'bezi' && (
                    <button className="hlavni" onClick={() => onResume(i)}>
                      Zpět do testu
                    </button>
                  )}
                  {stav === 'odevzdany' && <span className="odznak overeno">odevzdáno</span>}
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      {bezi !== null && (
        <p className="tlumene">
          Dokud běží test {bezi + 1}, další se spustit nedá — a čas mu běží dál, i když se na tuhle
          obrazovku vrátíš. U zkoušky se z rozběhnutého testu odejít nedá vůbec.
        </p>
      )}

      <h2>Vyhodnocení</h2>
      {hotovo ? (
        <div className="radek">
          <button className="hlavni" onClick={onEvaluate}>
            Zobrazit výsledek zkoušky
          </button>
        </div>
      ) : (
        <>
          <p>
            Odevzdáno {odevzdano} ze {attempt.blocks.length} testů. Výsledek se objeví po
            odevzdání posledního.
          </p>
          {!koncim ? (
            <button onClick={() => setKoncim(true)}>Ukončit zkoušku nedokončenou</button>
          ) : (
            <div className="karta" role="alertdialog" aria-label="Potvrzení ukončení zkoušky">
              <h3>Ukončit zkoušku, i když nejsou všechny testy odevzdané?</h3>
              <p>
                Neodevzdané testy se uzavřou a jejich nevyplněné otázky se spočítají jako
                nesprávné. Vrátit se k nim už nejde.
              </p>
              <div className="radek">
                <button className="hlavni" onClick={onAbandon}>
                  Ukončit a vyhodnotit
                </button>
                <button onClick={() => setKoncim(false)}>Zpět</button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}
