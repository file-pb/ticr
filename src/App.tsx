import { useCallback, useEffect, useMemo, useState } from 'react'
import { answerSet, bank, maLokalniVrstvu } from './data/load'
import type { Attempt, CircuitId, Item, Progress } from './domain/types'
import { CIRCUIT_ORDER, LPS_CIRCUIT, coverage, joinBank, staleAnswerIds } from './domain/bank'
import { DEFAULT_EXAM, buildAttemptItems, selectExam, selectPractice, type Shortfall } from './domain/select'
import { isExpired, scoreAttempt } from './domain/score'
import { advance, emptyProgress, wrongQuestionIds } from './domain/srs'
import { mulberry32, newSeed } from './domain/rng'
import * as db from './storage/db'
import { Home } from './ui/Home'
import { Runner } from './ui/Runner'
import { Results } from './ui/Results'
import { Study } from './ui/Study'
import { Site } from './ui/Site'
import { Normy } from './ui/Normy'
import { History } from './ui/History'

const AKTIVNI_POKUS = 'aktivniPokus'

type View =
  | { k: 'home' }
  | { k: 'run'; attemptId: string }
  | { k: 'result'; attemptId: string }
  | { k: 'study' }
  | { k: 'site' }
  | { k: 'normy' }
  | { k: 'history' }

export function App() {
  const [view, setView] = useState<View>({ k: 'home' })
  const [progress, setProgress] = useState<Progress[]>([])
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [shortfalls, setShortfalls] = useState<Shortfall[] | null>(null)
  const [nacteno, setNacteno] = useState(false)

  const items = useMemo<Item[]>(() => joinBank(bank, answerSet), [])
  const itemMap = useMemo(() => new Map(items.map((i) => [i.question.id, i])), [items])
  const pokryti = useMemo(() => coverage(items, bank), [items])
  const stale = useMemo(() => staleAnswerIds(bank, answerSet), [])
  const savedIds = useMemo(
    () => new Set(progress.filter((p) => p.saved).map((p) => p.questionId)),
    [progress],
  )

  const reload = useCallback(async () => {
    const [p, a] = await Promise.all([db.progress.all(), db.attempts.all()])
    setProgress(p)
    setAttempts(a)
  }, [])

  // Načtení stavu a obnovení rozpracovaného pokusu. Pokus, kterému mezitím
  // vypršel čas, se uzavře hned — nedoběhne se v něm po obnovení stránky.
  useEffect(() => {
    void (async () => {
      await reload()
      const id = await db.meta.get<string>(AKTIVNI_POKUS)
      if (!id) return setNacteno(true)
      const attempt = await db.attempts.get(id)
      if (!attempt) return setNacteno(true)
      if (attempt.finishedAt !== null) return setNacteno(true)
      if (isExpired(attempt, Date.now())) {
        const uzavreny = { ...attempt, finishedAt: attempt.deadlineAt ?? Date.now() }
        await dokonci(uzavreny)
        setView({ k: 'result', attemptId: uzavreny.id })
      } else {
        setView({ k: 'run', attemptId: attempt.id })
      }
      setNacteno(true)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const aktivni = useMemo(
    () =>
      view.k === 'run' || view.k === 'result'
        ? attempts.find((a) => a.id === view.attemptId) ?? null
        : null,
    [view, attempts],
  )

  async function ulozPokrok(zmeneny: Progress) {
    await db.progress.put(zmeneny)
    setProgress((xs) => {
      const i = xs.findIndex((p) => p.questionId === zmeneny.questionId)
      if (i === -1) return [...xs, zmeneny]
      const kopie = xs.slice()
      kopie[i] = zmeneny
      return kopie
    })
  }

  function pokrokPro(questionId: string): Progress {
    return (
      progress.find((p) => p.questionId === questionId) ?? emptyProgress(questionId, Date.now())
    )
  }

  async function zalozPokus(
    vybrane: Item[],
    label: string,
    minuty: number | null,
    threshold: number,
  ) {
    const seed = newSeed()
    const rng = mulberry32(seed)
    const now = Date.now()
    const attempt: Attempt = {
      id: `${now}-${seed}`,
      mode: minuty === null ? 'procvicovani' : 'zkouska',
      createdAt: now,
      deadlineAt: minuty === null ? null : now + minuty * 60_000,
      finishedAt: null,
      bankVersion: bank.bankVersion,
      answersVersion: answerSet.answersVersion,
      thresholdPercent: threshold,
      label,
      items: buildAttemptItems(vybrane, rng),
    }
    await db.attempts.put(attempt)
    await db.meta.set(AKTIVNI_POKUS, attempt.id)
    setAttempts((xs) => [attempt, ...xs])
    setShortfalls(null)
    setView({ k: 'run', attemptId: attempt.id })
  }

  async function dokonci(attempt: Attempt) {
    const r = scoreAttempt(attempt, items)
    for (const o of r.outcomes) {
      await ulozPokrok(advance(pokrokPro(o.questionId), o, Date.now()))
    }
    await db.attempts.put(attempt)
    await db.meta.set(AKTIVNI_POKUS, null)
    setAttempts((xs) => xs.map((a) => (a.id === attempt.id ? attempt : a)))
  }

  /** Ukládá po každé změně. V procvičování zapisuje pokrok hned po odpovědi. */
  const zmen = useCallback(
    (zmeneny: Attempt) => {
      void (async () => {
        const predchozi = attempts.find((a) => a.id === zmeneny.id)
        await db.attempts.put(zmeneny)
        setAttempts((xs) => xs.map((a) => (a.id === zmeneny.id ? zmeneny : a)))

        if (zmeneny.mode === 'procvicovani' && predchozi) {
          const r = scoreAttempt(zmeneny, items)
          for (let i = 0; i < zmeneny.items.length; i++) {
            const pred = predchozi.items[i]
            const po = zmeneny.items[i]
            if (!pred || !po) continue
            if (pred.chosenOptionId === null && po.chosenOptionId !== null) {
              const o = r.outcomes[i]
              if (o) await ulozPokrok(advance(pokrokPro(o.questionId), o, Date.now()))
            }
          }
        }
      })()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attempts, items, progress],
  )

  const dokonciAZobraz = useCallback(
    (attempt: Attempt) => {
      void (async () => {
        await dokonci(attempt)
        setView({ k: 'result', attemptId: attempt.id })
      })()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [progress, items],
  )

  function spustZkousku() {
    const vyber = selectExam(items, DEFAULT_EXAM, mulberry32(newSeed()))
    if (!vyber.ok) {
      setShortfalls(vyber.shortfalls)
      setView({ k: 'home' })
      return
    }
    void zalozPokus(
      vyber.items,
      'Zkouška nanečisto',
      DEFAULT_EXAM.minutes,
      DEFAULT_EXAM.thresholdPercent,
    )
  }

  function spustProcvicovani(
    label: string,
    opts: { circuits?: CircuitId[]; count?: number; onlyIds?: string[] },
  ) {
    const vybrane = selectPractice(
      items,
      { ...opts, includeUnverified: true },
      mulberry32(newSeed()),
    )
    if (vybrane.length === 0) {
      setShortfalls([{ circuit: opts.circuits?.[0] ?? 'ez1', needed: opts.count ?? 1, available: 0 }])
      setView({ k: 'home' })
      return
    }
    void zalozPokus(vybrane, label, null, DEFAULT_EXAM.thresholdPercent)
  }

  async function toggleSaved(questionId: string) {
    const p = pokrokPro(questionId)
    await ulozPokrok({ ...p, saved: !p.saved })
  }

  if (!nacteno) {
    return (
      <main>
        <p>Načítám…</p>
      </main>
    )
  }

  return (
    <main>
      {view.k !== 'home' && (
        <nav className="hlavni-nav" aria-label="Hlavní navigace">
          <button onClick={() => setView({ k: 'home' })}>← Rozcestník</button>
          <button onClick={() => setView({ k: 'study' })}>Procházet banku</button>
          <button onClick={() => setView({ k: 'history' })}>Historie</button>
          {/* Pomůcky stojí v menu zvlášť. Nejsou to otázky TIČR a nemají se
              s nimi plést. */}
          <span className="nav-oddelovac" aria-hidden="true" />
          <button onClick={() => setView({ k: 'site' })}>Trenažér sítí</button>
          <button onClick={() => setView({ k: 'normy' })}>Mapa norem</button>
        </nav>
      )}

      {stale.length > 0 && (
        <p className="upozorneni" role="alert">
          Klíč odpovědí byl psaný pro banku {answerSet.bankVersion}, ale nahraná banka je{' '}
          {bank.bankVersion}. Odpovědi se nepřebírají automaticky — {stale.length} z nich je
          potřeba znovu posoudit proti novému znění otázek.
        </p>
      )}

      {view.k === 'home' && (
        <Home
          bank={bank}
          items={itemMap}
          pokryti={pokryti}
          progress={progress}
          attempts={attempts}
          shortfalls={shortfalls}
          onStartExam={spustZkousku}
          onPracticeLps={() =>
            spustProcvicovani('Procvičování LPS (okruh ez4)', { circuits: [LPS_CIRCUIT] })
          }
          onRepeatWrong={() =>
            spustProcvicovani('Opakování chyb', { onlyIds: wrongQuestionIds(progress) })
          }
          onPracticeShort={(count) => spustProcvicovani(`Série ${count} otázek`, { count })}
          onPracticeCircuit={(c) =>
            spustProcvicovani(`Procvičování okruhu ${c}`, { circuits: [c] })
          }
          onStudy={() => setView({ k: 'study' })}
          onSite={() => setView({ k: 'site' })}
          onNormy={() => setView({ k: 'normy' })}
          onHistory={() => setView({ k: 'history' })}
        />
      )}

      {view.k === 'run' && aktivni && (
        <Runner
          attempt={aktivni}
          items={itemMap}
          ukazatPrubeznouZpetnouVazbu={aktivni.mode === 'procvicovani'}
          onChange={zmen}
          onFinish={dokonciAZobraz}
          onToggleSaved={(id) => void toggleSaved(id)}
          savedIds={savedIds}
        />
      )}

      {view.k === 'result' && aktivni && (
        <Results
          attempt={aktivni}
          items={itemMap}
          onPracticeMistakes={(ids) => spustProcvicovani('Procvičení chyb z pokusu', { onlyIds: ids })}
          onHome={() => setView({ k: 'home' })}
        />
      )}

      {view.k === 'study' && (
        <Study items={items} savedIds={savedIds} onToggleSaved={(id) => void toggleSaved(id)} />
      )}

      {view.k === 'site' && (
        <Site
          items={itemMap}
          onPracticeIds={(ids, label) => spustProcvicovani(label, { onlyIds: ids })}
        />
      )}

      {view.k === 'normy' && (
        <Normy
          items={itemMap}
          onPracticeIds={(ids, label) => spustProcvicovani(label, { onlyIds: ids })}
        />
      )}

      {view.k === 'history' && (
        <History
          attempts={attempts}
          items={itemMap}
          onOpen={(id) => {
            const a = attempts.find((x) => x.id === id)
            setView(a && a.finishedAt === null ? { k: 'run', attemptId: id } : { k: 'result', attemptId: id })
          }}
          onWipe={() => void db.wipe().then(reload)}
          onReload={() => void reload()}
        />
      )}

      <footer>
        {maLokalniVrstvu && (
          <p>
            Tenhle běh používá i lokální vrstvu odpovědí odvozených z placených podkladů. Do
            veřejného nasazení nepatří a nesmí se publikovat.
          </p>
        )}
        <p>
          Okruhy {CIRCUIT_ORDER.join(', ')} — {bank.scope}
        </p>
        <p>{bank.disclaimer}</p>
      </footer>
    </main>
  )
}
