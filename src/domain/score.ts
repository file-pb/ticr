import type { Attempt, CircuitId, Item } from './types'

export interface QuestionOutcome {
  questionId: string
  circuit: CircuitId
  answered: boolean
  correct: boolean
  guessed: boolean
  chosenOptionId: string | null
  correctOptionId: string | null
}

export interface CircuitResult {
  circuit: CircuitId
  total: number
  correct: number
}

export interface AttemptResult {
  total: number
  answered: number
  correct: number
  /** Procenta zaokrouhlená dolů — 47,5 z 60 není splněných 80 %. */
  percent: number
  passed: boolean
  thresholdPercent: number
  neededCorrect: number
  elapsedMs: number
  byCircuit: CircuitResult[]
  outcomes: QuestionOutcome[]
}

/**
 * Vyhodnocení pokusu. Nezodpovězená otázka se počítá jako nesprávná, protože
 * tak ji počítá i zkouška po vypršení času.
 */
export function scoreAttempt(attempt: Attempt, items: Item[]): AttemptResult {
  const byId = new Map(items.map((i) => [i.question.id, i]))
  const outcomes: QuestionOutcome[] = attempt.items.map((ai) => {
    const item = byId.get(ai.questionId)
    const correctOptionId = item?.answer?.correctOptionId ?? null
    return {
      questionId: ai.questionId,
      circuit: item?.question.circuit ?? 'ez1',
      answered: ai.chosenOptionId !== null,
      correct: ai.chosenOptionId !== null && ai.chosenOptionId === correctOptionId,
      guessed: ai.guessed,
      chosenOptionId: ai.chosenOptionId,
      correctOptionId,
    }
  })

  const total = outcomes.length
  const correct = outcomes.filter((o) => o.correct).length
  const percent = total === 0 ? 0 : Math.floor((correct / total) * 100)
  const neededCorrect = Math.ceil((attempt.thresholdPercent / 100) * total)

  const circuits = [...new Set(outcomes.map((o) => o.circuit))]
  const byCircuit: CircuitResult[] = circuits.map((circuit) => ({
    circuit,
    total: outcomes.filter((o) => o.circuit === circuit).length,
    correct: outcomes.filter((o) => o.circuit === circuit && o.correct).length,
  }))

  const end = attempt.finishedAt ?? Date.now()
  return {
    total,
    answered: outcomes.filter((o) => o.answered).length,
    correct,
    percent,
    passed: total > 0 && correct >= neededCorrect,
    thresholdPercent: attempt.thresholdPercent,
    neededCorrect,
    elapsedMs: Math.max(0, end - attempt.createdAt),
    byCircuit,
    outcomes,
  }
}

/** Zbývající čas z uloženého okamžiku konce. Refresh ani přepnutí záložky ho neresetuje. */
export function remainingMs(attempt: Attempt, now: number): number | null {
  if (attempt.deadlineAt === null) return null
  return Math.max(0, attempt.deadlineAt - now)
}

export function isExpired(attempt: Attempt, now: number): boolean {
  return attempt.deadlineAt !== null && attempt.finishedAt === null && now >= attempt.deadlineAt
}
