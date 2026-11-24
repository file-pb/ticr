import { isPracticable, isScorable } from './bank'
import { shuffle, type Rng } from './rng'
import type { AttemptItem, CircuitId, Item } from './types'

export interface ExamPreset {
  circuits: CircuitId[]
  perCircuit: number
  /** Minut na jeden test, ne na celou zkoušku. Čas se mezi testy nepřenáší. */
  blockMinutes: number
  thresholdPercent: number
}

/** Čas na celou zkoušku. Jen informativní součet — zkouška ho takhle nedává. */
export function examTotalMinutes(preset: ExamPreset): number {
  return preset.circuits.length * preset.blockMinutes
}

/**
 * Tréninkové nastavení, ne potvrzená pravidla TIČR.
 *
 * Hranici 80 % uvádí TIČR ve zveřejněných informacích. Skladbu — pro rozsah
 * E2A čtyři testy po patnácti otázkách, na každý 20 minut — shodně uvádějí
 * čtyři nezávislé zdroje: přednášející kurzu ESČ 18. 5. 2026 („E2A jsou čtyři
 * testy po patnácti otázkách, 20 minut na test"), cvičný test rozdaný na
 * konci téhož kurzu 21. 5. 2026 (60 otázek, 80 minut), záznam prvního dne
 * kurzu 23. 11. 2026 a — jako jediný **písemně** — veřejná stránka ESČ
 * elektrosvaz.cz/rt-online: „kategorie E2A — test ze 4 okruhů … celkem 4x15
 * otázek / 4x20 minut", „minimálně 80% otázek musí být zodpovězeno správně"
 * (čteno 24. 11. 2026). Všechno jsou to druhotné zdroje, ne dokument TIČR.
 *
 * **`thresholdPercent` se počítá z celého pokusu, ne po okruzích**, a od
 * 23. 11. 2026 je to doložené: „Vyhodnocuje to až na závěr všech těch 60
 * otázek, protože budete mít čtyři testy po 15 otázkách… K úspěšnému složení
 * zkoušky musíte mít 80 % správných odpovědí." Do té doby to byl odhad.
 *
 * **Čím se tahle předvolba od skutečné zkoušky liší:** rozdíl v čase a
 * v průběhu zmizel — aplikace od 24. 11. 2026 losuje čtyři samostatné testy
 * po 15 otázkách, každý se svými 20 minutami a nevratným odevzdáním, v pořadí,
 * které si volí zkoušený, a výsledek drží až do odevzdání čtvrtého testu.
 * Zbývá jediný vědomý rozdíl: z běžícího testu se dá odejít do rozcestníku
 * aplikace, zatímco u zkoušky se z testu odejít nedá. Čas mu i tak běží dál,
 * protože se počítá z uloženého okamžiku konce. Rozdíl je popsaný v README.
 */
export const DEFAULT_EXAM: ExamPreset = {
  circuits: ['ez1', 'ez2', 'ez3', 'ez4'],
  perCircuit: 15,
  blockMinutes: 20,
  thresholdPercent: 80,
}

/**
 * Znění otázky srovnané na holý text — malá písmena, bez diakritiky,
 * bez interpunkce, jedna mezera. Slouží **jen** k poznání dvou doslova
 * stejných otázek, ne k posuzování podobnosti.
 */
function skeleton(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Mn}+/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Vyhodí z výběru doslovné duplicity znění.
 *
 * Oficiální dokument TIČR má v okruhu ez2 tutéž otázku dvakrát — čísla 22
 * a 23, shodné znění i shodný normativní odkaz (ČSN 33 2000-4-41 ed. 3:2018
 * čl. 411.3.3). V bance obě zůstávají, aby banka odpovídala zdroji bajt po
 * bajtu; při losování by ale jeden běh mohl obě vytáhnout a vypadalo by to
 * jako chyba aplikace.
 *
 * Rozhoduje **přesná shoda** srovnaného znění. Otázky, které se liší jediným
 * slovem, jsou dvě různé otázky a obě zůstávají — v ez2 jsou dvojice 78/79
 * (SELV proti PELV) a 95/96 („nesmí" proti „může"), kde to jediné slovo
 * obrací odpověď.
 *
 * Ponechá se první výskyt v pořadí banky, tedy otázka s nižším číslem.
 * Pořadí vstupu je dané bankou, ne losem, takže výsledek nezávisí na seedu.
 */
export function dropDuplicateWording(items: Item[]): Item[] {
  const videna = new Set<string>()
  return items.filter((i) => {
    const k = skeleton(i.question.text)
    if (videna.has(k)) return false
    videna.add(k)
    return true
  })
}

export interface Shortfall {
  circuit: CircuitId
  needed: number
  available: number
}

export type ExamSelection =
  | { ok: true; items: Item[] }
  | { ok: false; shortfalls: Shortfall[] }

/** Otázky jednoho testu. Jeden test = jeden okruh, jak to dělá i zkouška. */
export interface ExamGroup {
  circuit: CircuitId
  items: Item[]
}

export type ExamGroupSelection =
  | { ok: true; groups: ExamGroup[] }
  | { ok: false; shortfalls: Shortfall[] }

/**
 * Výběr otázek pro zkoušku nanečisto, rozdělený po testech. Losuje
 * **výhradně z ověřených** odpovědí. Když v okruhu není dost ověřených
 * otázek, vrátí, co kde chybí — nedolévá z jiného okruhu a nepoužije otázku
 * dvakrát. Okruhy se nekontrolují jen do prvního chybějícího, aby bylo vidět
 * všechno, co chybí, ne jen první nález.
 */
export function selectExamByCircuit(
  items: Item[],
  preset: ExamPreset,
  rng: Rng,
): ExamGroupSelection {
  const shortfalls: Shortfall[] = []
  const groups: ExamGroup[] = []

  for (const circuit of preset.circuits) {
    const pool = dropDuplicateWording(
      items.filter((i) => i.question.circuit === circuit && isScorable(i)),
    )
    if (pool.length < preset.perCircuit) {
      shortfalls.push({ circuit, needed: preset.perCircuit, available: pool.length })
      continue
    }
    groups.push({ circuit, items: shuffle(pool, rng).slice(0, preset.perCircuit) })
  }

  if (shortfalls.length > 0) return { ok: false, shortfalls }
  return { ok: true, groups }
}

/**
 * Tentýž výběr složený do jednoho pořadí otázek napříč okruhy. Zkouška takhle
 * neběží — používá se tam, kde na dělení na testy nezáleží.
 */
export function selectExam(items: Item[], preset: ExamPreset, rng: Rng): ExamSelection {
  const vyber = selectExamByCircuit(items, preset, rng)
  if (!vyber.ok) return vyber
  return { ok: true, items: shuffle(vyber.groups.flatMap((g) => g.items), rng) }
}

export interface PracticeQuery {
  circuits?: CircuitId[]
  count?: number
  /** Jen otázky z tohoto seznamu ID — opakování chyb, uložených a nejistých. */
  onlyIds?: string[]
  /** Pustit i neověřené návrhy. Ve zkoušce nikdy. */
  includeUnverified: boolean
}

export function selectPractice(items: Item[], query: PracticeQuery, rng: Rng): Item[] {
  const idFilter = query.onlyIds ? new Set(query.onlyIds) : null
  let pool = dropDuplicateWording(
    items.filter((i) =>
      (query.includeUnverified ? isPracticable(i) : isScorable(i)) &&
      (!query.circuits || query.circuits.includes(i.question.circuit)) &&
      (!idFilter || idFilter.has(i.question.id)),
    ),
  )
  pool = shuffle(pool, rng)
  return query.count ? pool.slice(0, query.count) : pool
}

/** Složí položky pokusu včetně promíchaných možností. */
export function buildAttemptItems(items: Item[], rng: Rng): AttemptItem[] {
  return items.map((item) => {
    const ids = (item.answer?.options ?? []).map((o) => o.id)
    return {
      questionId: item.question.id,
      optionOrder: shuffle(ids, rng),
      chosenOptionId: null,
      flagged: false,
      guessed: false,
    }
  })
}
