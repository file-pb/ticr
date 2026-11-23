import type { Answer, AnswerSet, Bank, CircuitId, Item } from './types'

export const CIRCUIT_ORDER: CircuitId[] = ['ez1', 'ez2', 'ez3', 'ez4']

/** Okruh LPS. Samostatné procvičování LPS je filtr tohoto okruhu, ne jiný profil zkoušky. */
export const LPS_CIRCUIT: CircuitId = 'ez4'

export function joinBank(bank: Bank, answerSet: AnswerSet): Item[] {
  const byId = new Map<string, Answer>()
  for (const a of answerSet.answers) byId.set(a.questionId, a)
  return bank.questions.map((question) => ({
    question,
    answer: byId.get(question.id) ?? null,
  }))
}

/**
 * Odpovědi psané pro jinou verzi banky. Nesmí se potichu zdědit — otázka se
 * mohla přeformulovat, aniž by se změnilo její číslo.
 */
export function staleAnswerIds(bank: Bank, answerSet: AnswerSet): string[] {
  if (answerSet.bankVersion === bank.bankVersion) return []
  return answerSet.answers.map((a) => a.questionId)
}

/** Otázka, podle které se smí hodnotit test. */
export function isScorable(item: Item): boolean {
  return item.answer !== null && item.answer.status === 'overeno'
}

/** Otázka, kterou lze předložit v procvičování (včetně neověřených návrhů). */
export function isPracticable(item: Item): boolean {
  return item.answer !== null && item.answer.status !== 'sporne'
}

export interface CircuitCoverage {
  circuit: CircuitId
  title: string
  total: number
  overeno: number
  navrh: number
  sporne: number
  bezOdpovedi: number
}

export function coverage(items: Item[], bank: Bank): CircuitCoverage[] {
  return CIRCUIT_ORDER.map((circuit) => {
    const inCircuit = items.filter((i) => i.question.circuit === circuit)
    const meta = bank.circuits.find((c) => c.id === circuit)
    const count = (s: string) => inCircuit.filter((i) => i.answer?.status === s).length
    return {
      circuit,
      title: meta?.title ?? circuit,
      total: inCircuit.length,
      overeno: count('overeno'),
      navrh: count('navrh'),
      sporne: count('sporne'),
      bezOdpovedi: inCircuit.filter((i) => i.answer === null).length,
    }
  })
}
