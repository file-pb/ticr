import { useState } from 'react'
import type { Attempt, Item } from '../domain/types'
import { scoreAttempt } from '../domain/score'
import { downloadSnapshot, exportSnapshot, importSnapshot, parseSnapshot } from '../storage/transfer'

interface Props {
  attempts: Attempt[]
  items: Map<string, Item>
  onOpen: (attemptId: string) => void
  onWipe: () => void
  onReload: () => void
}

export function History({ attempts, items, onOpen, onWipe, onReload }: Props) {
  const [stav, setStav] = useState<string | null>(null)
  const [mazani, setMazani] = useState(false)
  const all = [...items.values()]

  async function naimportuj(file: File) {
    try {
      const snapshot = parseSnapshot(await file.text())
      const n = await importSnapshot(snapshot)
      setStav(`Naimportováno ${n.attempts} pokusů a ${n.progress} záznamů pokroku.`)
      onReload()
    } catch (e) {
      setStav('Import se nepovedl: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  return (
    <>
      <h1>Historie a pokrok</h1>

      <h2>Pokusy ({attempts.length})</h2>
      {attempts.length === 0 ? (
        <p>Zatím žádný pokus.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th scope="col">Kdy</th>
              <th scope="col">Co</th>
              <th scope="col" className="cislo">Výsledek</th>
              <th scope="col">Banka / klíč</th>
              <th scope="col" />
            </tr>
          </thead>
          <tbody>
            {attempts.map((a) => {
              const r = scoreAttempt(a, all)
              return (
                <tr key={a.id}>
                  <td>{new Date(a.createdAt).toLocaleString('cs-CZ')}</td>
                  <td>{a.label}</td>
                  <td className="cislo">
                    {a.finishedAt === null ? (
                      'rozpracováno'
                    ) : (
                      <>
                        {r.correct}/{r.total} ({r.percent} %) {r.passed ? '· splněno' : '· nesplněno'}
                      </>
                    )}
                  </td>
                  <td className="tlumene">
                    {a.bankVersion} / {a.answersVersion}
                  </td>
                  <td>
                    <button onClick={() => onOpen(a.id)}>
                      {a.finishedAt === null ? 'Pokračovat' : 'Výsledek'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <p className="tlumene">
        Každý pokus si pamatuje verzi banky i verzi klíče, podle kterých byl hodnocen. Po doplnění
        odpovědí tak starší výsledek nepřestane něco znamenat.
      </p>

      <h2>Přenos pokroku</h2>
      <div className="radek">
        <button onClick={async () => downloadSnapshot(await exportSnapshot())}>
          Exportovat do souboru
        </button>
        <label>
          <span className="tlumene">Import ze souboru: </span>
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void naimportuj(f)
            }}
          />
        </label>
      </div>
      {stav && (
        <p className="upozorneni" aria-live="polite">
          {stav}
        </p>
      )}

      <h2>Vymazání historie</h2>
      {mazani ? (
        <div className="karta" role="alertdialog" aria-label="Potvrzení vymazání">
          <p>
            <strong>Vymazat celou historii a pokrok?</strong> Je to nevratné. Pokud si ho chceš
            nechat, nejdřív ho exportuj.
          </p>
          <div className="radek">
            <button
              className="hlavni"
              onClick={() => {
                onWipe()
                setMazani(false)
                setStav('Historie i pokrok vymazány.')
              }}
            >
              Vymazat nevratně
            </button>
            <button onClick={() => setMazani(false)}>Nechat být</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setMazani(true)}>Vymazat historii a pokrok…</button>
      )}
    </>
  )
}
