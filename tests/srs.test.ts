import { describe, expect, it } from 'vitest'
import { advance, dueQuestionIds, emptyProgress, savedQuestionIds, wrongQuestionIds } from '../src/domain/srs'
import type { QuestionOutcome } from '../src/domain/score'

const now = 1_700_000_000_000
const vysledek = (over: Partial<QuestionOutcome> = {}): QuestionOutcome => ({
  questionId: 'q1',
  circuit: 'ez1',
  answered: true,
  correct: true,
  guessed: false,
  chosenOptionId: 'o2',
  correctOptionId: 'o2',
  ...over,
})

describe('opakování v rostoucích intervalech', () => {
  it('správná odpověď posune do další schránky', () => {
    const p = advance(emptyProgress('q1', now), vysledek(), now)
    expect(p.box).toBe(1)
    expect(p.dueAt).toBe(now + 86_400_000)
  })

  it('chyba vrací do schránky 0 a za deset minut', () => {
    let p = emptyProgress('q1', now)
    p = advance(p, vysledek(), now)
    p = advance(p, vysledek(), now)
    expect(p.box).toBe(2)

    p = advance(p, vysledek({ correct: false, chosenOptionId: 'o1' }), now)
    expect(p.box).toBe(0)
    expect(p.wrongCount).toBe(1)
    expect(p.dueAt).toBe(now + 600_000)
  })

  it('přiznaný tip neposune schránku, i když je odpověď správná', () => {
    let p = advance(emptyProgress('q1', now), vysledek(), now)
    expect(p.box).toBe(1)

    p = advance(p, vysledek({ guessed: true }), now)
    expect(p.box).toBe(1)
    expect(p.guessedCount).toBe(1)
  })

  it('schránka neroste nad nejdelší interval', () => {
    let p = emptyProgress('q1', now)
    for (let i = 0; i < 20; i++) p = advance(p, vysledek(), now)
    expect(p.box).toBe(5)
    expect(p.dueAt).toBe(now + 60 * 86_400_000)
  })

  it('k opakování řadí nejdřív otázky s chybou', () => {
    const a = { ...emptyProgress('a', now), dueAt: now - 1000, wrongCount: 0 }
    const b = { ...emptyProgress('b', now), dueAt: now - 500, wrongCount: 3 }
    const c = { ...emptyProgress('c', now), dueAt: now + 10_000, wrongCount: 9 }
    expect(dueQuestionIds([a, b, c], now)).toEqual(['b', 'a'])
  })

  it('vyjmenuje chybné a uložené otázky', () => {
    const a = { ...emptyProgress('a', now), wrongCount: 2 }
    const b = { ...emptyProgress('b', now), saved: true }
    expect(wrongQuestionIds([a, b])).toEqual(['a'])
    expect(savedQuestionIds([a, b])).toEqual(['b'])
  })
})
