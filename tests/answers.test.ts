import { describe, expect, it } from 'vitest'
import answersJson from '../src/data/answers.2027.json'
import bankJson from '../src/data/questions.2027.json'
import type { AnswerSet, Bank } from '../src/domain/types'
import { isScorable, joinBank } from '../src/domain/bank'

const bank = bankJson as unknown as Bank
const answerSet = answersJson as unknown as AnswerSet

/**
 * Invarianty klíče odpovědí. Doložitelnost zdroje proti textu předpisu hlídá
 * `scripts/check_answers.py`; tohle hlídá to, co musí platit i v běhu aplikace.
 */
describe('klíč odpovědí', () => {
  it('je psaný pro nahranou verzi banky', () => {
    expect(answerSet.bankVersion).toBe(bank.bankVersion)
  })

  it('odpovídá jen na otázky, které v bance existují', () => {
    const ids = new Set(bank.questions.map((q) => q.id))
    const cizi = answerSet.answers.filter((a) => !ids.has(a.questionId))
    expect(cizi.map((a) => a.questionId)).toEqual([])
  })

  it('nemá dvě odpovědi na tutéž otázku', () => {
    const ids = answerSet.answers.map((a) => a.questionId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('žádná ověřená odpověď není bez doloženého zdroje', () => {
    const bezZdroje = answerSet.answers.filter(
      (a) => a.status === 'overeno' && !a.verification?.source,
    )
    expect(bezZdroje.map((a) => a.questionId)).toEqual([])
  })

  it('správná možnost vždy existuje a whyWrong pokrývá zbytek', () => {
    for (const a of answerSet.answers) {
      const ids = a.options.map((o) => o.id)
      expect(ids).toContain(a.correctOptionId)
      expect(Object.keys(a.whyWrong).sort()).toEqual(
        ids.filter((i) => i !== a.correctOptionId).sort(),
      )
    }
  })

  it('do hodnocení testu se dostanou jen ověřené odpovědi', () => {
    const hodnotitelne = joinBank(bank, answerSet).filter(isScorable)
    expect(hodnotitelne.every((i) => i.answer?.status === 'overeno')).toBe(true)
    expect(hodnotitelne.every((i) => i.answer?.verification !== null)).toBe(true)
  })
})
