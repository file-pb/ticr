import type { Attempt, Bank, Item, Progress } from '../domain/types'
import type { CircuitCoverage } from '../domain/bank'
import type { Shortfall } from '../domain/select'
import { DEFAULT_EXAM } from '../domain/select'
import { scoreAttempt } from '../domain/score'
import { PokrytiTabulka, PuvodBanky, UcebniUpozorneni } from './bits'

interface Props {
  bank: Bank
  items: Map<string, Item>
  pokryti: CircuitCoverage[]
  progress: Progress[]
  attempts: Attempt[]
  shortfalls: Shortfall[] | null
  onStartExam: () => void
  onPracticeLps: () => void
  onRepeatWrong: () => void
  onPracticeShort: (count: number) => void
  onPracticeCircuit: (circuit: 'ez1' | 'ez2' | 'ez3' | 'ez4') => void
  onStudy: () => void
  onHistory: () => void
}

export function Home({
  bank,
  items,
  pokryti,
  progress,
  attempts,
  shortfalls,
  onStartExam,
  onPracticeLps,
  onRepeatWrong,
  onPracticeShort,
  onPracticeCircuit,
  onStudy,
  onHistory,
}: Props) {
  const overenoCelkem = pokryti.reduce((a, c) => a + c.overeno, 0)
  const chybnych = progress.filter((p) => p.wrongCount > 0).length
  const videnych = progress.filter((p) => p.seenCount > 0).length
  const nevidene = overenoCelkem - videnych
  const dokoncene = attempts.filter((a) => a.finishedAt !== null)

  return (
    <>
      <h1>Revizní technik E2A — příprava na sadu 2027</h1>
      <p className="tlumene">
        Písemná část zkoušky u TIČR, okruhy ez1–ez4 včetně LPS v prostředí bez nebezpečí výbuchu.
      </p>

      <div className="radek" style={{ marginTop: 16 }}>
        <button className="hlavni" onClick={onStartExam}>
          Spustit zkoušku
        </button>
        <button onClick={onPracticeLps}>Procvičit LPS</button>
        <button onClick={onRepeatWrong} disabled={chybnych === 0}>
          Zopakovat chyby{chybnych > 0 ? ` (${chybnych})` : ''}
        </button>
      </div>

      {shortfalls && shortfalls.length > 0 && (
        <div className="upozorneni" role="alert">
          <p style={{ marginTop: 0 }}>
            <strong>Plnou zkoušku nanečisto spustit nelze.</strong> Předvolba chce{' '}
            {DEFAULT_EXAM.perCircuit} ověřených otázek z každého okruhu. Chybí:
          </p>
          <ul>
            {shortfalls.map((s) => (
              <li key={s.circuit}>
                {s.circuit}: ověřených {s.available} z potřebných {s.needed} — chybí{' '}
                {s.needed - s.available}
              </li>
            ))}
          </ul>
          <p style={{ marginBottom: 0 }}>
            Chybějící otázky se nenahrazují jiným okruhem ani duplicitami. Dokud klíč nedoroste,
            použij kratší procvičování nebo studijní procházení.
          </p>
        </div>
      )}

      <h2>Kratší procvičování</h2>
      <div className="radek">
        <button onClick={() => onPracticeShort(10)}>Série 10 otázek</button>
        <button onClick={() => onPracticeShort(20)}>Série 20 otázek</button>
        <button onClick={onStudy}>Procházet banku</button>
      </div>
      <div className="radek" style={{ marginTop: 8 }}>
        {(['ez1', 'ez2', 'ez3', 'ez4'] as const).map((c) => (
          <button key={c} onClick={() => onPracticeCircuit(c)}>
            okruh {c}
          </button>
        ))}
      </div>

      <h2>Kde na tom jsem</h2>
      <div className="karta">
        <p>
          Otázek v bance <strong>{items.size}</strong>, z toho s ověřenou odpovědí{' '}
          <strong>{overenoCelkem}</strong>. Viděl jsi {videnych}
          {nevidene > 0 ? `, neviděných zbývá ${Math.max(0, nevidene)}` : ''}.
        </p>
        {dokoncene.length === 0 ? (
          <p className="tlumene">Žádný dokončený pokus. Skóre se objeví po prvním testu.</p>
        ) : (
          <>
            <p className="tlumene">Vývoj posledních pokusů (nejnovější vlevo):</p>
            <ul className="cisty">
              {dokoncene.slice(0, 5).map((a) => {
                const r = scoreAttempt(a, [...items.values()])
                return (
                  <li key={a.id}>
                    {new Date(a.createdAt).toLocaleDateString('cs-CZ')} · {a.label} ·{' '}
                    <strong>
                      {r.correct}/{r.total} ({r.percent} %)
                    </strong>{' '}
                    · {r.passed ? 'splněno' : 'nesplněno'}
                  </li>
                )
              })}
            </ul>
            <button onClick={onHistory}>Celá historie</button>
          </>
        )}
      </div>

      <h2>Pokrytí banky</h2>
      <PokrytiTabulka pokryti={pokryti} />
      <p className="tlumene">
        Skóre samo o sobě úspěch u TIČR nepředpovídá. Čti ho vždy spolu s pokrytím banky — několik
        opakovaných testů z malé části otázek nic nedokazuje.
      </p>

      <UcebniUpozorneni />
      <PuvodBanky bank={bank} />
    </>
  )
}
