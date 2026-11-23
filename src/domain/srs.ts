import type { Progress } from './types'
import type { QuestionOutcome } from './score'

const DAY = 86_400_000
/** Intervaly pro schránky 1 až 5. Schránka 0 se vrací do deseti minut. */
const INTERVALS = [10 * 60_000, 1 * DAY, 3 * DAY, 7 * DAY, 21 * DAY, 60 * DAY]

export function emptyProgress(questionId: string, now: number): Progress {
  return {
    questionId,
    box: 0,
    dueAt: now,
    seenCount: 0,
    wrongCount: 0,
    guessedCount: 0,
    lastSeenAt: 0,
    saved: false,
  }
}

/**
 * Posun v opakování po jedné odpovědi.
 *
 * Chyba vrací otázku do schránky 0, tedy za deset minut. Správná odpověď
 * posouvá dál, **ale jen pokud u ní nebyl přiznaný tip** — náhodně správná
 * odpověď nesmí projít jako zvládnuté učivo.
 */
export function advance(progress: Progress, outcome: QuestionOutcome, now: number): Progress {
  const next: Progress = {
    ...progress,
    seenCount: progress.seenCount + 1,
    lastSeenAt: now,
  }

  if (!outcome.correct) {
    next.box = 0
    next.wrongCount = progress.wrongCount + 1
  } else if (outcome.guessed) {
    next.guessedCount = progress.guessedCount + 1
    // schránka zůstává
  } else {
    next.box = Math.min(progress.box + 1, INTERVALS.length - 1)
  }

  next.dueAt = now + (INTERVALS[next.box] ?? INTERVALS[0]!)
  return next
}

/** Otázky k opakování: nejdřív ty s chybou, pak podle data splatnosti. */
export function dueQuestionIds(all: Progress[], now: number): string[] {
  return all
    .filter((p) => p.dueAt <= now)
    .sort((a, b) => b.wrongCount - a.wrongCount || a.dueAt - b.dueAt)
    .map((p) => p.questionId)
}

export function wrongQuestionIds(all: Progress[]): string[] {
  return all.filter((p) => p.wrongCount > 0).map((p) => p.questionId)
}

export function savedQuestionIds(all: Progress[]): string[] {
  return all.filter((p) => p.saved).map((p) => p.questionId)
}
