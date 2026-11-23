import type { Answer, AnswerSet, Attempt, Bank, CircuitId, Item } from '../src/domain/types'
import { buildAttemptItems } from '../src/domain/select'
import { mulberry32 } from '../src/domain/rng'

export function question(circuit: CircuitId, n: number) {
  return {
    id: `2027-${circuit}-${String(n).padStart(3, '0')}`,
    circuit,
    circuitTitle: 'test',
    number: n,
    sourceMarker: `${n})`,
    numberedInSource: true,
    text: `Otázka ${circuit} č. ${n}?`,
    normativeRef: 'ČSN test čl. 1',
  }
}

export function answer(questionId: string, status: Answer['status'] = 'overeno'): Answer {
  return {
    questionId,
    options: [
      { id: 'o1', text: 'první' },
      { id: 'o2', text: 'druhá — správná' },
      { id: 'o3', text: 'třetí' },
    ],
    correctOptionId: 'o2',
    explanation: 'protože test',
    whyWrong: { o1: 'ne', o3: 'ne' },
    status,
    sourceClass: 'volny',
    verification:
      status === 'overeno'
        ? { source: 'testovací zdroj', method: 'test', checkedAt: '2026-11-23', checkedBy: 'test' }
        : null,
  }
}

/** Banka s daným počtem otázek na okruh a daným počtem ověřených odpovědí na okruh. */
export function makeBank(perCircuit: number, verifiedPerCircuit: Record<CircuitId, number>) {
  const circuits: CircuitId[] = ['ez1', 'ez2', 'ez3', 'ez4']
  const questions = circuits.flatMap((c) =>
    Array.from({ length: perCircuit }, (_, i) => question(c, i + 1)),
  )
  const bank: Bank = {
    schemaVersion: 1,
    bankVersion: '2027.1',
    validFrom: '2027-01-01',
    scope: 'test',
    disclaimer: 'test',
    provenance: {
      pageUrl: 'https://example.test',
      zipUrl: 'https://example.test/z.zip',
      importedAt: '2026-11-23',
      zipSha256: 'abc',
      files: [],
    },
    circuits: circuits.map((id) => ({
      id,
      sourceFile: id + '.doc',
      title: id,
      expected: perCircuit,
      imported: perCircuit,
      withNormativeRef: perCircuit,
    })),
    questions,
  }

  const answers: Answer[] = []
  for (const c of circuits) {
    const kolik = verifiedPerCircuit[c]
    for (let i = 0; i < perCircuit; i++) {
      const q = questions.find((x) => x.circuit === c && x.number === i + 1)!
      if (i < kolik) answers.push(answer(q.id, 'overeno'))
      else if (i < kolik + 2) answers.push(answer(q.id, 'navrh'))
      // zbytek zůstane bez odpovědi
    }
  }

  const answerSet: AnswerSet = {
    schemaVersion: 1,
    answersVersion: '0.1.0',
    bankVersion: '2027.1',
    license: 'CC-BY-SA-4.0',
    answers,
  }
  return { bank, answerSet }
}

export function makeAttempt(
  items: Item[],
  opts: { minutes?: number | null; threshold?: number; seed?: number; now?: number } = {},
): Attempt {
  const now = opts.now ?? 1_700_000_000_000
  const minutes = opts.minutes === undefined ? 120 : opts.minutes
  return {
    id: 'pokus-1',
    mode: minutes === null ? 'procvicovani' : 'zkouska',
    createdAt: now,
    deadlineAt: minutes === null ? null : now + minutes * 60_000,
    finishedAt: null,
    bankVersion: '2027.1',
    answersVersion: '0.1.0',
    thresholdPercent: opts.threshold ?? 80,
    label: 'test',
    items: buildAttemptItems(items, mulberry32(opts.seed ?? 1)),
  }
}
