import { describe, expect, it } from 'vitest'
import { joinBank, coverage, isScorable, staleAnswerIds } from '../src/domain/bank'
import { DEFAULT_EXAM, selectExam, selectPractice } from '../src/domain/select'
import { mulberry32 } from '../src/domain/rng'
import { makeBank } from './fixtures'

describe('výběr otázek pro zkoušku nanečisto', () => {
  it('vybere 15 z každého okruhu, celkem 60, bez duplicit', () => {
    const { bank, answerSet } = makeBank(30, { ez1: 20, ez2: 20, ez3: 20, ez4: 20 })
    const items = joinBank(bank, answerSet)
    const vyber = selectExam(items, DEFAULT_EXAM, mulberry32(42))

    expect(vyber.ok).toBe(true)
    if (!vyber.ok) return
    expect(vyber.items).toHaveLength(60)

    const ids = vyber.items.map((i) => i.question.id)
    expect(new Set(ids).size).toBe(60)

    for (const c of DEFAULT_EXAM.circuits) {
      expect(vyber.items.filter((i) => i.question.circuit === c)).toHaveLength(15)
    }
  })

  it('losuje výhradně z ověřených odpovědí', () => {
    const { bank, answerSet } = makeBank(30, { ez1: 15, ez2: 15, ez3: 15, ez4: 15 })
    const items = joinBank(bank, answerSet)
    const vyber = selectExam(items, DEFAULT_EXAM, mulberry32(7))

    expect(vyber.ok).toBe(true)
    if (!vyber.ok) return
    expect(vyber.items.every(isScorable)).toBe(true)
    expect(vyber.items.every((i) => i.answer?.status === 'overeno')).toBe(true)
  })

  it('odmítne se a vyjmenuje, co kde chybí, když ověřených není dost', () => {
    const { bank, answerSet } = makeBank(30, { ez1: 15, ez2: 15, ez3: 3, ez4: 0 })
    const items = joinBank(bank, answerSet)
    const vyber = selectExam(items, DEFAULT_EXAM, mulberry32(1))

    expect(vyber.ok).toBe(false)
    if (vyber.ok) return
    expect(vyber.shortfalls).toEqual([
      { circuit: 'ez3', needed: 15, available: 3 },
      { circuit: 'ez4', needed: 15, available: 0 },
    ])
  })

  it('nedolévá chybějící otázky z jiného okruhu', () => {
    // ez1 má ověřených na dva okruhy, ez4 nemá nic. Výběr musí přesto spadnout.
    const { bank, answerSet } = makeBank(40, { ez1: 40, ez2: 15, ez3: 15, ez4: 0 })
    const items = joinBank(bank, answerSet)
    const vyber = selectExam(items, DEFAULT_EXAM, mulberry32(3))
    expect(vyber.ok).toBe(false)
  })

  it('procvičování smí vzít i neověřené návrhy, zkouška ne', () => {
    const { bank, answerSet } = makeBank(10, { ez1: 2, ez2: 0, ez3: 0, ez4: 0 })
    const items = joinBank(bank, answerSet)

    const jenOverene = selectPractice(items, { circuits: ['ez1'], includeUnverified: false }, mulberry32(1))
    const iNavrhy = selectPractice(items, { circuits: ['ez1'], includeUnverified: true }, mulberry32(1))

    expect(jenOverene).toHaveLength(2)
    expect(iNavrhy).toHaveLength(4) // 2 ověřené + 2 návrhy
  })

  it('opakování chyb bere jen zadaná ID', () => {
    const { bank, answerSet } = makeBank(10, { ez1: 10, ez2: 10, ez3: 10, ez4: 10 })
    const items = joinBank(bank, answerSet)
    const chci = ['2027-ez1-001', '2027-ez3-004']
    const vybrane = selectPractice(items, { onlyIds: chci, includeUnverified: true }, mulberry32(9))
    expect(vybrane.map((i) => i.question.id).sort()).toEqual(chci.sort())
  })
})

describe('pokrytí a verzování klíče', () => {
  it('spočítá pokrytí po okruzích', () => {
    const { bank, answerSet } = makeBank(10, { ez1: 3, ez2: 0, ez3: 10, ez4: 1 })
    const p = coverage(joinBank(bank, answerSet), bank)
    const ez1 = p.find((x) => x.circuit === 'ez1')!
    expect(ez1).toMatchObject({ total: 10, overeno: 3, navrh: 2, sporne: 0, bezOdpovedi: 5 })
    const ez3 = p.find((x) => x.circuit === 'ez3')!
    expect(ez3).toMatchObject({ total: 10, overeno: 10, navrh: 0, bezOdpovedi: 0 })
  })

  it('nahlásí odpovědi psané pro jinou verzi banky', () => {
    const { bank, answerSet } = makeBank(5, { ez1: 5, ez2: 5, ez3: 5, ez4: 5 })
    expect(staleAnswerIds(bank, answerSet)).toEqual([])

    const jinaBanka = { ...bank, bankVersion: '2027.2' }
    expect(staleAnswerIds(jinaBanka, answerSet)).toHaveLength(answerSet.answers.length)
  })
})
