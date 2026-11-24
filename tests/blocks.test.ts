import { describe, expect, it } from 'vitest'
import type { Attempt, Item } from '../src/domain/types'
import { joinBank } from '../src/domain/bank'
import {
  DEFAULT_EXAM,
  buildAttemptItems,
  examTotalMinutes,
  selectExamByCircuit,
} from '../src/domain/select'
import {
  abandonRemaining,
  allBlocksSubmitted,
  blockItems,
  blockRemainingMs,
  blockState,
  buildBlocks,
  expireBlocks,
  hasBlocks,
  isBlockExpired,
  runningBlockIndex,
  setItemInBlock,
  startBlock,
  submitBlock,
} from '../src/domain/blocks'
import { scoreAttempt } from '../src/domain/score'
import { mulberry32 } from '../src/domain/rng'
import { makeBank } from './fixtures'

const START = 1_700_000_000_000
const MIN = 60_000

/** Zkouška nanečisto rozdělená na čtyři testy, nic z ní ještě nezahájené. */
function zkouska(now = START): { attempt: Attempt; items: Item[] } {
  const { bank, answerSet } = makeBank(30, { ez1: 20, ez2: 20, ez3: 20, ez4: 20 })
  const items = joinBank(bank, answerSet)
  const vyber = selectExamByCircuit(items, DEFAULT_EXAM, mulberry32(11))
  if (!vyber.ok) throw new Error('výběr měl projít')
  const { blocks, order } = buildBlocks(
    vyber.groups.map((g) => ({ circuit: g.circuit, title: `test ${g.circuit}`, items: g.items })),
    DEFAULT_EXAM.blockMinutes,
  )
  const attempt: Attempt = {
    id: 'pokus-bloky',
    mode: 'zkouska',
    createdAt: now,
    deadlineAt: null,
    finishedAt: null,
    bankVersion: '2027.1',
    answersVersion: '0.1.0',
    thresholdPercent: DEFAULT_EXAM.thresholdPercent,
    label: 'Zkouška nanečisto',
    items: buildAttemptItems(order, mulberry32(2)),
    blocks,
  }
  return { attempt, items }
}

/** Vyplní prvních `kolik` otázek daného testu správně. Správná je vždy `o2`. */
function odpovez(attempt: Attempt, blockIndex: number, kolik: number): Attempt {
  const b = attempt.blocks![blockIndex]!
  const polozky = attempt.items.slice()
  for (let i = 0; i < kolik; i++) {
    polozky[b.from + i] = { ...polozky[b.from + i]!, chosenOptionId: 'o2' }
  }
  return { ...attempt, items: polozky }
}

describe('skladba zkoušky na čtyři testy', () => {
  it('čtyři testy po 15 otázkách, souvislé úseky, 60 otázek celkem', () => {
    const { attempt } = zkouska()
    expect(hasBlocks(attempt)).toBe(true)
    expect(attempt.blocks).toHaveLength(4)
    expect(attempt.items).toHaveLength(60)

    let ocekavanyZacatek = 0
    for (const b of attempt.blocks!) {
      expect(b.count).toBe(15)
      expect(b.minutes).toBe(20)
      expect(b.from).toBe(ocekavanyZacatek)
      ocekavanyZacatek += b.count
    }
    expect(ocekavanyZacatek).toBe(60)
    expect(examTotalMinutes(DEFAULT_EXAM)).toBe(80)
  })

  it('každý test obsahuje jen otázky svého okruhu', () => {
    const { attempt, items } = zkouska()
    const byId = new Map(items.map((i) => [i.question.id, i]))
    for (const b of attempt.blocks!) {
      const okruhy = blockItems(
        attempt,
        attempt.blocks!.indexOf(b),
      ).map((it) => byId.get(it.questionId)!.question.circuit)
      expect(new Set(okruhy)).toEqual(new Set([b.circuit]))
    }
  })

  it('pokus sám nemá lhůtu — čas drží jednotlivé testy', () => {
    const { attempt } = zkouska()
    expect(attempt.deadlineAt).toBeNull()
    expect(attempt.blocks!.every((b) => b.deadlineAt === null)).toBe(true)
  })
})

describe('čas jednoho testu', () => {
  it('začíná běžet až zahájením testu, ne spuštěním zkoušky', () => {
    const { attempt } = zkouska()
    expect(blockState(attempt.blocks![0]!)).toBe('nezahajeny')
    expect(blockRemainingMs(attempt.blocks![0]!, START + 60 * MIN)).toBeNull()

    const po = startBlock(attempt, 0, START + 60 * MIN)
    expect(blockState(po.blocks![0]!)).toBe('bezi')
    expect(blockRemainingMs(po.blocks![0]!, START + 60 * MIN)).toBe(20 * MIN)
  })

  it('se mezi testy nepřenáší — druhý test má svých 20 minut, ať se prvního ušetřilo kolik chce', () => {
    const { attempt } = zkouska()
    let a = startBlock(attempt, 0, START)
    a = submitBlock(a, 0, START + 2 * MIN) // první test za dvě minuty
    a = startBlock(a, 1, START + 2 * MIN)
    expect(blockRemainingMs(a.blocks![1]!, START + 2 * MIN)).toBe(20 * MIN)
    expect(a.blocks![1]!.deadlineAt).toBe(START + 22 * MIN)
  })

  it('nezahájený test se zahájením rozběhne jen jednou', () => {
    const { attempt } = zkouska()
    const a = startBlock(attempt, 0, START)
    const znovu = startBlock(a, 0, START + 5 * MIN)
    expect(znovu.blocks![0]!.deadlineAt).toBe(START + 20 * MIN)
  })
})

describe('odevzdání testu', () => {
  it('je nevratné — druhé odevzdání okamžik nepřepíše', () => {
    const { attempt } = zkouska()
    let a = startBlock(attempt, 0, START)
    a = submitBlock(a, 0, START + 3 * MIN)
    const znovu = submitBlock(a, 0, START + 9 * MIN)
    expect(znovu.blocks![0]!.submittedAt).toBe(START + 3 * MIN)
    expect(blockState(znovu.blocks![0]!)).toBe('odevzdany')
  })

  it('po vypršení času se zapíše na okamžik konce, ne na skutečné kliknutí', () => {
    const { attempt } = zkouska()
    let a = startBlock(attempt, 0, START)
    a = submitBlock(a, 0, START + 25 * MIN)
    expect(a.blocks![0]!.submittedAt).toBe(START + 20 * MIN)
  })

  it('uzavře jen svůj test, ne celou zkoušku', () => {
    const { attempt } = zkouska()
    let a = startBlock(attempt, 0, START)
    a = submitBlock(a, 0, START + 5 * MIN)
    expect(a.finishedAt).toBeNull()
    expect(allBlocksSubmitted(a)).toBe(false)
    expect(runningBlockIndex(a)).toBeNull()
  })

  it('zkouška je hotová teprve po čtvrtém testu', () => {
    const { attempt } = zkouska()
    let a = attempt
    for (let i = 0; i < 4; i++) {
      a = startBlock(a, i, START + i * 25 * MIN)
      expect(allBlocksSubmitted(a)).toBe(false)
      a = submitBlock(a, i, START + i * 25 * MIN + 10 * MIN)
    }
    expect(allBlocksSubmitted(a)).toBe(true)
  })

  it('pořadí testů je libovolné', () => {
    const { attempt } = zkouska()
    let a = attempt
    for (const i of [2, 0, 3, 1]) {
      a = submitBlock(startBlock(a, i, START), i, START + MIN)
    }
    expect(allBlocksSubmitted(a)).toBe(true)
  })
})

describe('vypršení času mimo běžící aplikaci', () => {
  it('uzavře rozběhnutý test, kterému mezitím vypršel čas', () => {
    const { attempt } = zkouska()
    const a = startBlock(attempt, 0, START)
    expect(isBlockExpired(a.blocks![0]!, START + 20 * MIN)).toBe(true)

    const po = expireBlocks(a, START + 90 * MIN)
    expect(po.blocks![0]!.submittedAt).toBe(START + 20 * MIN)
    expect(blockState(po.blocks![0]!)).toBe('odevzdany')
    // Zbylé testy se tím nezahodí — zkoušející je má pořád před sebou.
    expect(blockState(po.blocks![1]!)).toBe('nezahajeny')
    expect(allBlocksSubmitted(po)).toBe(false)
  })

  it('nezahájeného testu se nedotkne a bez změny vrátí tentýž objekt', () => {
    const { attempt } = zkouska()
    expect(expireBlocks(attempt, START + 10 ** 9)).toBe(attempt)

    const a = startBlock(attempt, 0, START)
    expect(expireBlocks(a, START + 10 * MIN)).toBe(a)
  })
})

describe('hranice 80 % se počítá z celých 60 otázek, ne po testech', () => {
  it('nevyrovnaný výsledek projde, když je v součtu 48 správných', () => {
    const { attempt, items } = zkouska()
    let a = attempt
    // 15 + 15 + 15 + 3 = 48 z 60, tedy přesně 80 %. Po testech by čtvrtý test
    // s 3/15 propadl — zkouška ho ale samostatně nehodnotí.
    for (const [blok, kolik] of [[0, 15], [1, 15], [2, 15], [3, 3]] as const) {
      a = odpovez(a, blok, kolik)
      a = submitBlock(startBlock(a, blok, START), blok, START + MIN)
    }
    a = { ...a, finishedAt: START + 80 * MIN }

    const r = scoreAttempt(a, items)
    expect(r.total).toBe(60)
    expect(r.correct).toBe(48)
    expect(r.percent).toBe(80)
    expect(r.neededCorrect).toBe(48)
    expect(r.passed).toBe(true)
  })

  it('o jednu odpověď méně neprojde', () => {
    const { attempt, items } = zkouska()
    let a = attempt
    for (const [blok, kolik] of [[0, 15], [1, 15], [2, 15], [3, 2]] as const) {
      a = odpovez(a, blok, kolik)
    }
    a = { ...a, finishedAt: START + 80 * MIN }
    const r = scoreAttempt(a, items)
    expect(r.correct).toBe(47)
    expect(r.percent).toBe(78)
    expect(r.passed).toBe(false)
  })
})

describe('uzavření nedokončené zkoušky', () => {
  it('nenapsané testy se počítají jako nesprávné', () => {
    const { attempt, items } = zkouska()
    let a = odpovez(attempt, 0, 15)
    a = submitBlock(startBlock(a, 0, START), 0, START + 5 * MIN)
    a = abandonRemaining(a, START + 6 * MIN)

    expect(allBlocksSubmitted(a)).toBe(true)
    const r = scoreAttempt({ ...a, finishedAt: START + 6 * MIN }, items)
    expect(r.correct).toBe(15)
    expect(r.answered).toBe(15)
    expect(r.total).toBe(60)
    expect(r.passed).toBe(false)
  })

  it('už odevzdanému testu okamžik odevzdání nepřepíše', () => {
    const { attempt } = zkouska()
    let a = submitBlock(startBlock(attempt, 0, START), 0, START + 5 * MIN)
    a = abandonRemaining(a, START + 60 * MIN)
    expect(a.blocks![0]!.submittedAt).toBe(START + 5 * MIN)
  })
})

describe('pokusy bez dělení na testy', () => {
  it('procvičování bloky nemá a funkce nad bloky ho nechají být', () => {
    const { attempt } = zkouska()
    const procvicovani: Attempt = { ...attempt, mode: 'procvicovani', blocks: undefined }
    expect(hasBlocks(procvicovani)).toBe(false)
    expect(runningBlockIndex(procvicovani)).toBeNull()
    expect(allBlocksSubmitted(procvicovani)).toBe(false)
    expect(blockItems(procvicovani, 0)).toEqual([])
    expect(startBlock(procvicovani, 0, START)).toBe(procvicovani)
    expect(submitBlock(procvicovani, 0, START)).toBe(procvicovani)
    expect(expireBlocks(procvicovani, START)).toBe(procvicovani)
    expect(abandonRemaining(procvicovani, START)).toBe(procvicovani)
  })
})

describe('zápis odpovědi do správné otázky', () => {
  it('index v rámci testu se přepočítá na pozici v celém pokusu', () => {
    const { attempt } = zkouska()
    const tretiTest = attempt.blocks![2]!
    const po = setItemInBlock(attempt, 2, 0, { chosenOptionId: 'o2' })

    // Zapsala se první otázka třetího testu, tedy 31. otázka pokusu.
    expect(tretiTest.from).toBe(30)
    expect(po.items[30]!.chosenOptionId).toBe('o2')
    // a nic jiného.
    expect(po.items.filter((it) => it.chosenOptionId !== null)).toHaveLength(1)
    expect(po.items[0]!.chosenOptionId).toBeNull()
  })

  it('zapíše poslední otázku testu a za hranici testu nepřeteče', () => {
    const { attempt } = zkouska()
    const po = setItemInBlock(attempt, 0, 14, { flagged: true })
    expect(po.items[14]!.flagged).toBe(true)
    expect(po.items[15]!.flagged).toBe(false)

    // 15 otázek, takže index 15 už patří dalšímu testu — zápis se zahodí.
    expect(setItemInBlock(attempt, 0, 15, { flagged: true })).toBe(attempt)
    expect(setItemInBlock(attempt, 0, -1, { flagged: true })).toBe(attempt)
  })

  it('u pokusu bez dělení na testy je index rovnou globální', () => {
    const { attempt } = zkouska()
    const procvicovani: Attempt = { ...attempt, mode: 'procvicovani', blocks: undefined }
    const po = setItemInBlock(procvicovani, null, 42, { chosenOptionId: 'o2' })
    expect(po.items[42]!.chosenOptionId).toBe('o2')
    expect(setItemInBlock(procvicovani, null, 60, { flagged: true })).toBe(procvicovani)
  })

  it('neexistující test nezapíše nic', () => {
    const { attempt } = zkouska()
    expect(setItemInBlock(attempt, 9, 0, { flagged: true })).toBe(attempt)
  })
})
