import { describe, expect, it } from 'vitest'
import { joinBank } from '../src/domain/bank'
import { DEFAULT_EXAM, examTotalMinutes, selectExam } from '../src/domain/select'
import { isExpired, remainingMs, scoreAttempt } from '../src/domain/score'
import { mulberry32 } from '../src/domain/rng'
import { makeAttempt, makeBank } from './fixtures'

function plnaZkouska() {
  const { bank, answerSet } = makeBank(20, { ez1: 20, ez2: 20, ez3: 20, ez4: 20 })
  const items = joinBank(bank, answerSet)
  const vyber = selectExam(items, DEFAULT_EXAM, mulberry32(5))
  if (!vyber.ok) throw new Error('fixtura má mít dost ověřených otázek')
  return { items, vybrane: vyber.items }
}

describe('hodnocení pokusu', () => {
  it('nezodpovězená otázka se počítá jako nesprávná', () => {
    const { items, vybrane } = plnaZkouska()
    const attempt = makeAttempt(vybrane)
    // odpovíme správně jen na prvních 10, zbytek zůstane prázdný
    attempt.items = attempt.items.map((it, i) => ({
      ...it,
      chosenOptionId: i < 10 ? 'o2' : null,
    }))
    const r = scoreAttempt({ ...attempt, finishedAt: attempt.createdAt + 1000 }, items)

    expect(r.total).toBe(60)
    expect(r.answered).toBe(10)
    expect(r.correct).toBe(10)
    expect(r.passed).toBe(false)
  })

  it('hranice 80 % z 60 otázek je 48 správných', () => {
    const { items, vybrane } = plnaZkouska()
    const uspesny = makeAttempt(vybrane)
    uspesny.items = uspesny.items.map((it, i) => ({ ...it, chosenOptionId: i < 48 ? 'o2' : 'o1' }))
    const r48 = scoreAttempt({ ...uspesny, finishedAt: uspesny.createdAt }, items)
    expect(r48.neededCorrect).toBe(48)
    expect(r48.correct).toBe(48)
    expect(r48.percent).toBe(80)
    expect(r48.passed).toBe(true)

    const neuspesny = makeAttempt(vybrane)
    neuspesny.items = neuspesny.items.map((it, i) => ({ ...it, chosenOptionId: i < 47 ? 'o2' : 'o1' }))
    const r47 = scoreAttempt({ ...neuspesny, finishedAt: neuspesny.createdAt }, items)
    expect(r47.correct).toBe(47)
    expect(r47.percent).toBe(78)
    expect(r47.passed).toBe(false)
  })

  it('rozpad po okruzích dá dohromady celek', () => {
    const { items, vybrane } = plnaZkouska()
    const attempt = makeAttempt(vybrane)
    attempt.items = attempt.items.map((it, i) => ({ ...it, chosenOptionId: i % 2 === 0 ? 'o2' : 'o3' }))
    const r = scoreAttempt({ ...attempt, finishedAt: attempt.createdAt }, items)
    expect(r.byCircuit).toHaveLength(4)
    expect(r.byCircuit.reduce((a, c) => a + c.total, 0)).toBe(60)
    expect(r.byCircuit.reduce((a, c) => a + c.correct, 0)).toBe(r.correct)
  })
})

describe('promíchání možností', () => {
  it('správnost drží na ID možnosti, ne na pozici ani písmenu', () => {
    const { items, vybrane } = plnaZkouska()
    const a = makeAttempt(vybrane, { seed: 11 })
    const b = makeAttempt(vybrane, { seed: 999 })

    // pořadí se mezi pokusy liší...
    const poradiA = a.items.map((i) => i.optionOrder.join(''))
    const poradiB = b.items.map((i) => i.optionOrder.join(''))
    expect(poradiA).not.toEqual(poradiB)

    // ...ale volba stejného ID je v obou správná
    for (const attempt of [a, b]) {
      attempt.items = attempt.items.map((it) => ({ ...it, chosenOptionId: 'o2' }))
      const r = scoreAttempt({ ...attempt, finishedAt: attempt.createdAt }, items)
      expect(r.correct).toBe(60)
    }
  })

  it('každý pokus nabízí všechny tři možnosti právě jednou', () => {
    const { vybrane } = plnaZkouska()
    const a = makeAttempt(vybrane, { seed: 77 })
    for (const it of a.items) {
      expect([...it.optionOrder].sort()).toEqual(['o1', 'o2', 'o3'])
    }
  })
})

describe('čas', () => {
  const start = 1_700_000_000_000

  it('zbývající čas se počítá z uloženého okamžiku konce', () => {
    const { vybrane } = plnaZkouska()
    const attempt = makeAttempt(vybrane, { minutes: 120, now: start })
    expect(remainingMs(attempt, start)).toBe(120 * 60_000)
    // obnovení stránky o 30 minut později: odpočet nezačíná znovu
    expect(remainingMs(attempt, start + 30 * 60_000)).toBe(90 * 60_000)
    expect(isExpired(attempt, start + 30 * 60_000)).toBe(false)
  })

  it('po vypršení času je pokus prošlý a zbývá nula', () => {
    const { vybrane } = plnaZkouska()
    const attempt = makeAttempt(vybrane, { minutes: 120, now: start })
    const po = start + 121 * 60_000
    expect(remainingMs(attempt, po)).toBe(0)
    expect(isExpired(attempt, po)).toBe(true)
  })

  it('dokončený pokus už prošlý není, i když je po termínu', () => {
    const { vybrane } = plnaZkouska()
    const attempt = makeAttempt(vybrane, { minutes: 120, now: start })
    const dokonceny = { ...attempt, finishedAt: start + 60 * 60_000 }
    expect(isExpired(dokonceny, start + 200 * 60_000)).toBe(false)
  })

  it('procvičování běží bez času', () => {
    const { vybrane } = plnaZkouska()
    const attempt = makeAttempt(vybrane, { minutes: null })
    expect(attempt.deadlineAt).toBeNull()
    expect(remainingMs(attempt, start)).toBeNull()
    expect(isExpired(attempt, start + 10 ** 9)).toBe(false)
  })
})

describe('předvolba zkoušky', () => {
  it('odpovídá doložené skladbě: 4 testy × 15 otázek, 20 minut na test, hranice 80 %', () => {
    expect(DEFAULT_EXAM.circuits).toHaveLength(4)
    expect(DEFAULT_EXAM.perCircuit).toBe(15)
    expect(DEFAULT_EXAM.circuits.length * DEFAULT_EXAM.perCircuit).toBe(60)
    // Čas patří testu, ne zkoušce — mezi testy se nepřenáší.
    expect(DEFAULT_EXAM.blockMinutes).toBe(20)
    expect(examTotalMinutes(DEFAULT_EXAM)).toBe(80)
    expect(DEFAULT_EXAM.thresholdPercent).toBe(80)
  })
})
