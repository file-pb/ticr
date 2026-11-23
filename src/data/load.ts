/**
 * Načtení banky a klíče odpovědí.
 *
 * Klíč je ve dvou vrstvách:
 *   answers.2027.json        veřejná, verzovaná v gitu — odpovědi ověřené
 *                            proti volně dostupným primárním zdrojům
 *   answers.2027.local.json  nepovinná, mimo git — odpovědi odvozené
 *                            z placených podkladů (normy ČSN, materiály ze
 *                            školení). Zůstávají na stroji toho, kdo si je
 *                            zaplatil, a do veřejného nasazení se nedostanou.
 *
 * Lokální vrstva přepisuje veřejnou podle ID otázky.
 */
import bankJson from './questions.2027.json'
import publicAnswers from './answers.2027.json'
import type { Answer, AnswerSet, Bank, Visibility } from '../domain/types'

export const bank = bankJson as unknown as Bank

function viditelnost(a: Answer): Visibility {
  return a.visibility ?? (a.sourceClass === 'placeny' ? 'jen-lokalne' : 'verejne')
}

const lokalniModuly = import.meta.glob<{ default: AnswerSet }>('./answers.2027.local.json', {
  eager: true,
})

function slouc(): AnswerSet {
  const zaklad = publicAnswers as unknown as AnswerSet
  const lokalni = Object.values(lokalniModuly)[0]?.default
  if (!lokalni) return { ...zaklad, answers: zaklad.answers.map(doplnViditelnost) }

  const podleId = new Map<string, Answer>()
  for (const a of zaklad.answers) podleId.set(a.questionId, doplnViditelnost(a))
  for (const a of lokalni.answers) podleId.set(a.questionId, doplnViditelnost(a))

  return {
    ...zaklad,
    answersVersion: `${zaklad.answersVersion}+lokalni.${lokalni.answersVersion}`,
    answers: [...podleId.values()],
  }
}

function doplnViditelnost(a: Answer): Answer {
  return { ...a, visibility: viditelnost(a) }
}

export const answerSet = slouc()

/** Má tenhle běh nějaké odpovědi z placených podkladů? Rozhraní to přizná. */
export const maLokalniVrstvu = answerSet.answers.some((a) => a.visibility === 'jen-lokalne')
