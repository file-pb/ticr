import { useMemo, useState } from 'react'
import type { CircuitId, Item } from '../domain/types'
import { CIRCUIT_ORDER } from '../domain/bank'
import { StavOdpovedi } from './bits'

interface Props {
  items: Item[]
  savedIds: Set<string>
  onToggleSaved: (questionId: string) => void
}

/** Studijní procházení celé banky. Použitelné i u otázek, ke kterým klíč chybí. */
export function Study({ items, savedIds, onToggleSaved }: Props) {
  const [dotaz, setDotaz] = useState('')
  const [okruh, setOkruh] = useState<CircuitId | 'vse'>('vse')
  const [jenUlozene, setJenUlozene] = useState(false)

  const nalezene = useMemo(() => {
    const q = dotaz.trim().toLowerCase()
    return items.filter((i) => {
      if (okruh !== 'vse' && i.question.circuit !== okruh) return false
      if (jenUlozene && !savedIds.has(i.question.id)) return false
      if (!q) return true
      return (
        i.question.text.toLowerCase().includes(q) ||
        i.question.normativeRef.toLowerCase().includes(q) ||
        String(i.question.number) === q ||
        i.question.id.toLowerCase().includes(q)
      )
    })
  }, [items, dotaz, okruh, jenUlozene, savedIds])

  return (
    <>
      <h1>Studijní procházení banky</h1>
      <p className="tlumene">
        Hledá v textu otázky, v čísle a v normativním odkazu. Otázky bez klíče jsou tu taky —
        znění otázky a článek normy jsou samy o sobě k učení.
      </p>

      <div className="karta">
        <label htmlFor="hledani">Hledat</label>
        <input
          id="hledani"
          type="search"
          value={dotaz}
          onChange={(e) => setDotaz(e.target.value)}
          placeholder="např. 62305, § 6, zemnič, 2027-ez4-013"
        />
        <div className="radek" style={{ marginTop: 10 }}>
          <button
            onClick={() => setOkruh('vse')}
            aria-pressed={okruh === 'vse'}
            className={okruh === 'vse' ? 'hlavni' : undefined}
          >
            vše
          </button>
          {CIRCUIT_ORDER.map((c) => (
            <button
              key={c}
              onClick={() => setOkruh(c)}
              aria-pressed={okruh === c}
              className={okruh === c ? 'hlavni' : undefined}
            >
              {c}
            </button>
          ))}
          <label className="zaskrtavaci">
            <input
              type="checkbox"
              checked={jenUlozene}
              onChange={(e) => setJenUlozene(e.target.checked)}
            />
            jen uložené
          </label>
        </div>
        <p className="tlumene" aria-live="polite" style={{ marginBottom: 0 }}>
          Nalezeno {nalezene.length} otázek.
        </p>
      </div>

      <ul className="cisty">
        {nalezene.slice(0, 200).map((i) => (
          <li key={i.question.id}>
            <div className="radek rozestup">
              <span className="tlumene">
                {i.question.circuit} · č. {i.question.number} · {i.question.id}
              </span>
              <StavOdpovedi status={i.answer?.status ?? null} />
            </div>
            <p className="otazka-text">{i.question.text}</p>
            <p className="norma">{i.question.normativeRef}</p>
            {i.answer ? (
              <details>
                <summary>Odpověď a vysvětlení</summary>
                <ul className="cisty">
                  {i.answer.options.map((o) => (
                    <li key={o.id}>
                      {o.id === i.answer!.correctOptionId ? (
                        <strong className="znacka spravne">✓ </strong>
                      ) : (
                        <span className="znacka chybne">✗ </span>
                      )}
                      {o.text}
                      {o.id !== i.answer!.correctOptionId && i.answer!.whyWrong[o.id] && (
                        <span className="tlumene"> — {i.answer!.whyWrong[o.id]}</span>
                      )}
                    </li>
                  ))}
                </ul>
                <p>{i.answer.explanation}</p>
                {i.answer.status !== 'overeno' && (
                  <p className="upozorneni">
                    Tato odpověď není ověřená proti primárnímu zdroji, takže se podle ní nehodnotí
                    test. {i.answer.missing ? 'Chybí doložit: ' + i.answer.missing : ''}
                    {i.answer.dispute ? 'Rozpor: ' + i.answer.dispute : ''}
                  </p>
                )}
                {i.answer.verification && (
                  <p className="tlumene">
                    Ověřeno podle: {i.answer.verification.source} ({i.answer.verification.checkedAt},{' '}
                    {i.answer.verification.checkedBy})
                  </p>
                )}
              </details>
            ) : (
              <p className="tlumene">
                Klíč k této otázce zatím není. Je potřeba text uvedeného předpisu nebo článku normy.
              </p>
            )}
            <label className="zaskrtavaci" style={{ marginTop: 6 }}>
              <input
                type="checkbox"
                checked={savedIds.has(i.question.id)}
                onChange={() => onToggleSaved(i.question.id)}
              />
              Uložit otázku
            </label>
          </li>
        ))}
      </ul>
      {nalezene.length > 200 && (
        <p className="tlumene">Zobrazeno prvních 200. Zpřesni hledání.</p>
      )}
    </>
  )
}
