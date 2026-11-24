import type { Attempt, Item } from '../domain/types'
import { scoreAttempt } from '../domain/score'
import { hasBlocks } from '../domain/blocks'

interface Props {
  attempt: Attempt
  items: Map<string, Item>
  onPracticeMistakes: (ids: string[]) => void
  onHome: () => void
}

function trvani(ms: number): string {
  const m = Math.floor(ms / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  return `${m} min ${String(s).padStart(2, '0')} s`
}

export function Results({ attempt, items, onPracticeMistakes, onHome }: Props) {
  const r = scoreAttempt(attempt, [...items.values()])
  const chyby = r.outcomes.filter((o) => !o.correct)
  const tipyNaslepo = r.outcomes.filter((o) => o.correct && o.guessed)

  return (
    <>
      <h1>{attempt.label} — výsledek</h1>

      <div className="karta">
        <p style={{ fontSize: '1.25rem', margin: 0 }}>
          <strong>
            {r.correct} z {r.total} správně, {r.percent} %
          </strong>{' '}
          — <strong>{r.passed ? '✓ splněno' : '✗ nesplněno'}</strong>
        </p>
        <p className="tlumene">
          Hranice {r.thresholdPercent} %, tedy nejméně {r.neededCorrect} správných odpovědí. Čas{' '}
          {trvani(r.elapsedMs)}
          {hasBlocks(attempt) ? ' od spuštění zkoušky, tedy včetně prodlev mezi testy' : ''}.
          Nevyplněných {r.total - r.answered} (počítají se jako nesprávné).
        </p>
        <div className="pruh" role="img" aria-label={`Úspěšnost ${r.percent} procent`}>
          <span style={{ width: `${r.percent}%` }} />
        </div>
        {tipyNaslepo.length > 0 && (
          <p className="tlumene">
            U {tipyNaslepo.length} správných odpovědí jsi přiznal tip — do zvládnutého učiva se
            nepočítají a vrátí se k procvičení.
          </p>
        )}
      </div>

      {hasBlocks(attempt) ? (
        <>
          <h2>Po testech</h2>
          <table>
            <caption className="tlumene" style={{ textAlign: 'left', paddingBottom: 6 }}>
              Jednotlivý test se nehodnotí — hranice {r.thresholdPercent} % se počítá z celého
              pokusu. Rozpad po testech je jen pro orientaci, kde to drhne.
            </caption>
            <thead>
              <tr>
                <th scope="col">Test</th>
                <th scope="col" className="cislo">Správně</th>
                <th scope="col" className="cislo">Otázek</th>
                <th scope="col" className="cislo">Využitý čas</th>
              </tr>
            </thead>
            <tbody>
              {attempt.blocks.map((b, i) => {
                const vysek = r.outcomes.slice(b.from, b.from + b.count)
                const cas =
                  b.startedAt !== null && b.submittedAt !== null
                    ? Math.max(0, b.submittedAt - b.startedAt)
                    : null
                return (
                  <tr key={b.circuit}>
                    <th scope="row">
                      {i + 1}. {b.title} <span className="tlumene">({b.circuit})</span>
                    </th>
                    <td className="cislo">{vysek.filter((o) => o.correct).length}</td>
                    <td className="cislo">{vysek.length}</td>
                    <td className="cislo">
                      {cas === null ? <span className="tlumene">nezahájen</span> : trvani(cas)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      ) : (
        <>
          <h2>Po okruzích</h2>
          <table>
            <thead>
              <tr>
                <th scope="col">Okruh</th>
                <th scope="col" className="cislo">Správně</th>
                <th scope="col" className="cislo">Otázek</th>
              </tr>
            </thead>
            <tbody>
              {r.byCircuit.map((c) => (
                <tr key={c.circuit}>
                  <th scope="row">{c.circuit}</th>
                  <td className="cislo">{c.correct}</td>
                  <td className="cislo">{c.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2>Rozbor chyb ({chyby.length})</h2>
      {chyby.length === 0 ? (
        <p>Žádná chyba.</p>
      ) : (
        <ul className="cisty">
          {chyby.map((o) => {
            const item = items.get(o.questionId)
            if (!item || !item.answer) return null
            const moje = item.answer.options.find((x) => x.id === o.chosenOptionId)
            const spravna = item.answer.options.find((x) => x.id === o.correctOptionId)
            return (
              <li key={o.questionId}>
                <p className="otazka-text">{item.question.text}</p>
                <p>
                  <strong className="znacka chybne">✗ Tvoje odpověď:</strong>{' '}
                  {moje ? moje.text : <em>nevyplněno</em>}
                </p>
                <p>
                  <strong className="znacka spravne">✓ Správně:</strong> {spravna?.text}
                </p>
                <p className="tlumene">{item.answer.explanation}</p>
                <p className="norma">{item.question.normativeRef}</p>
                {item.answer.verification && (
                  <p className="tlumene">Zdroj ověření: {item.answer.verification.source}</p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <div className="radek" style={{ marginTop: 20 }}>
        {chyby.length > 0 && (
          <button
            className="hlavni"
            onClick={() => onPracticeMistakes(chyby.map((o) => o.questionId))}
          >
            Procvičit chyby z tohoto pokusu
          </button>
        )}
        <button onClick={onHome}>Na rozcestník</button>
      </div>
    </>
  )
}
