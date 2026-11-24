/**
 * Zkouška rozdělená na čtyři samostatné testy.
 *
 * Co z průběhu zkoušky tenhle modul drží a proč (záznam prvního dne kurzu ESČ
 * z 23. 11. 2026, přednášející Radek Roušar — druhotný zdroj, ne dokument
 * TIČR): čtyři testy po patnácti otázkách, na každý 20 minut, pořadí si volí
 * zkoušený, čas se mezi testy nepřenáší, stisk „Vyhodnotit“ test nevratně
 * uzavře a výsledek se neukáže dřív než po čtvrtém testu.
 *
 * Co tady naopak **není**: hranice 80 %. Ta se počítá z celých šedesáti
 * otázek, takže zůstává ve `scoreAttempt` nad celým pokusem — blok se nehodnotí
 * samostatně a nikde se nepočítá, jestli „prošel“.
 */
import type { Attempt, AttemptBlock, AttemptItem, CircuitId, Item } from './types'

export interface BlockSource {
  circuit: CircuitId
  title: string
  items: Item[]
}

/**
 * Složí bloky a pořadí otázek. Otázky jednoho testu leží v `Attempt.items`
 * za sebou, aby `from`/`count` ukazovaly na souvislý úsek — vyhodnocení celého
 * pokusu tak zůstává jediným průchodem a výsledek testu je jen výsek výsledků.
 */
export function buildBlocks(
  sources: BlockSource[],
  minutes: number,
): { blocks: AttemptBlock[]; order: Item[] } {
  const blocks: AttemptBlock[] = []
  const order: Item[] = []
  for (const s of sources) {
    blocks.push({
      circuit: s.circuit,
      title: s.title,
      from: order.length,
      count: s.items.length,
      minutes,
      startedAt: null,
      deadlineAt: null,
      submittedAt: null,
    })
    order.push(...s.items)
  }
  return { blocks, order }
}

export type BlockState = 'nezahajeny' | 'bezi' | 'odevzdany'

export function blockState(block: AttemptBlock): BlockState {
  if (block.submittedAt !== null) return 'odevzdany'
  return block.startedAt === null ? 'nezahajeny' : 'bezi'
}

/** Pokus rozdělený na testy. Procvičování a starší pokusy bloky nemají. */
export function hasBlocks(attempt: Attempt): attempt is Attempt & { blocks: AttemptBlock[] } {
  return Array.isArray(attempt.blocks) && attempt.blocks.length > 0
}

/** Zbývající čas testu z uloženého okamžiku konce. Refresh ho neposune. */
export function blockRemainingMs(block: AttemptBlock, now: number): number | null {
  if (block.deadlineAt === null) return null
  return Math.max(0, block.deadlineAt - now)
}

export function isBlockExpired(block: AttemptBlock, now: number): boolean {
  return block.submittedAt === null && block.deadlineAt !== null && now >= block.deadlineAt
}

/** Index rozběhnutého testu. Víc testů najednou běžet nemá — bere se první. */
export function runningBlockIndex(attempt: Attempt): number | null {
  if (!hasBlocks(attempt)) return null
  const i = attempt.blocks.findIndex((b) => blockState(b) === 'bezi')
  return i === -1 ? null : i
}

export function allBlocksSubmitted(attempt: Attempt): boolean {
  return hasBlocks(attempt) && attempt.blocks.every((b) => b.submittedAt !== null)
}

/** Položky jednoho testu. Prázdné pole, když blok neexistuje. */
export function blockItems(attempt: Attempt, index: number): AttemptItem[] {
  const block = attempt.blocks?.[index]
  if (!block) return []
  return attempt.items.slice(block.from, block.from + block.count)
}

/**
 * Zápis do otázky testu. `localIndex` je pořadí **v rámci testu**, ne v celém
 * pokusu; přepočet na globální pozici patří sem, aby odpověď z třetího testu
 * nemohla přepsat otázku z prvního. `blockIndex` null znamená pokus bez dělení
 * na testy, kde jsou obě čísla totožná.
 *
 * Index mimo rozsah testu nezapíše nic a vrátí tentýž pokus — rozsah drží
 * `from`/`count` bloku, ne délka celého pole.
 */
export function setItemInBlock(
  attempt: Attempt,
  blockIndex: number | null,
  localIndex: number,
  change: Partial<AttemptItem>,
): Attempt {
  const block = blockIndex !== null && hasBlocks(attempt) ? attempt.blocks[blockIndex] : null
  if (blockIndex !== null && !block) return attempt
  const od = block ? block.from : 0
  const pocet = block ? block.count : attempt.items.length
  if (localIndex < 0 || localIndex >= pocet) return attempt

  const puvodni = attempt.items[od + localIndex]
  if (!puvodni) return attempt
  const items = attempt.items.slice()
  items[od + localIndex] = { ...puvodni, ...change }
  return { ...attempt, items }
}

/**
 * Zahájení testu. Čas se odsud ukládá jako okamžik konce, takže běží dál i po
 * zavření záložky — stejně jako u zkoušky.
 */
export function startBlock(attempt: Attempt, index: number, now: number): Attempt {
  if (!hasBlocks(attempt)) return attempt
  const block = attempt.blocks[index]
  if (!block || blockState(block) !== 'nezahajeny') return attempt
  const blocks = attempt.blocks.slice()
  blocks[index] = { ...block, startedAt: now, deadlineAt: now + block.minutes * 60_000 }
  return { ...attempt, blocks }
}

/**
 * Odevzdání testu. **Nevratné** — už odevzdaný test se nepřepíše, i kdyby
 * zavolání přišlo znovu. Odevzdání po vypršení času se zapíše na okamžik
 * konce, ne na skutečné kliknutí; čas po limitu se do testu nepočítá.
 */
export function submitBlock(attempt: Attempt, index: number, now: number): Attempt {
  if (!hasBlocks(attempt)) return attempt
  const block = attempt.blocks[index]
  if (!block || block.submittedAt !== null) return attempt
  const blocks = attempt.blocks.slice()
  blocks[index] = {
    ...block,
    submittedAt: block.deadlineAt === null ? now : Math.min(now, block.deadlineAt),
  }
  return { ...attempt, blocks }
}

/**
 * Uzavře testy, kterým čas vypršel mimo běžící aplikaci — zavřená záložka,
 * uspaný notebook. Bez toho by se v nich dalo po obnovení stránky dopisovat.
 * Vrací tentýž objekt, když se nic nezměnilo, aby se zbytečně neukládalo.
 */
export function expireBlocks(attempt: Attempt, now: number): Attempt {
  if (!hasBlocks(attempt)) return attempt
  let zmena = false
  const blocks = attempt.blocks.map((b) => {
    if (!isBlockExpired(b, now)) return b
    zmena = true
    return { ...b, submittedAt: b.deadlineAt }
  })
  return zmena ? { ...attempt, blocks } : attempt
}

/**
 * Uzavře zbytek nedokončené zkoušky. Nezahájený test se zapíše jako odevzdaný
 * s nulovým časem; jeho otázky zůstanou nevyplněné, a `scoreAttempt` je počítá
 * jako nesprávné — stejně jako zkouška počítá to, co zkoušený neodpověděl.
 */
export function abandonRemaining(attempt: Attempt, now: number): Attempt {
  if (!hasBlocks(attempt)) return attempt
  const blocks = attempt.blocks.map((b) =>
    b.submittedAt !== null ? b : { ...b, startedAt: b.startedAt ?? now, submittedAt: now },
  )
  return { ...attempt, blocks }
}
