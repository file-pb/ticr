/**
 * Trenažér druhů sítí. Vlastní obsah aplikace, **ne** klíč k otázkám TIČR.
 *
 * Proč je oddělený od banky: banka a klíč jsou vázané na oficiální znění
 * otázek a na doložitelný zdroj. Tenhle trenažér je učební text, který nikdo
 * neověřil proti normě, takže nesmí vstupovat do hodnocení zkoušky ani do
 * opakování podle pokroku. Má jediný úkol — naučit rozpoznat druh sítě.
 */

import { shuffle, type Rng } from './rng'

export type ZdrojVazba = 'uzemneny' | 'izolovany' | 'impedance'

export interface SitVodic {
  /** Značka vodiče, např. „L1" nebo „PEN". */
  znak: string
  /** Vodiče, na které se v bodě rozdělení dělí. Jen u PEN v síti TN-C-S. */
  deleniNa?: string[]
}

export interface SitSchema {
  zdroj: ZdrojVazba
  vodice: SitVodic[]
  /** Na co jsou připojené neživé části: značka vodiče, nebo vlastní zemnič. */
  neziveCasti: string
}

export interface SitZamena {
  /** Kód sítě, se kterou se snadno zamění. */
  s: string
  cim: string
}

export interface SitDruh {
  id: string
  kod: string
  nazev: string
  /** Co znamená které písmeno v tomhle kódu. */
  rozpad: string[]
  znaky: string[]
  zameny: SitZamena[]
  schema: SitSchema
}

export interface PismenoVarianta {
  znak: string
  popis: string
}

export interface PismenoPozice {
  pozice: string
  vyznam: string
  varianty: PismenoVarianta[]
}

export interface SitData {
  schemaVersion: number
  verze: string
  nazev: string
  /** Vždy „navrh". Trenažér netvrdí, že je obsah ověřený. */
  stavCeleho: 'navrh'
  varovani: string
  doloz: string
  pismena: PismenoPozice[]
  druhy: SitDruh[]
}

/** ID otázek z banky, které se ptají na jednotlivé druhy sítí. Generované. */
export interface SitOtazky {
  schemaVersion: number
  generovano: string
  skript: string
  bankVersion: string
  poznamka: string
  temata: Record<string, string[]>
}

export type UkolTyp = 'schema' | 'znaky' | 'pismeno'

export interface UkolMoznost {
  id: string
  text: string
}

export interface Ukol {
  id: string
  typ: UkolTyp
  zadani: string
  /** U typu „schema" druh, jehož schéma se kreslí. Jinak nic. */
  schemaDruhId?: string
  moznosti: UkolMoznost[]
  spravnaId: string
  vysvetleni: string
}

export const VSECHNY_TYPY: UkolTyp[] = ['schema', 'znaky', 'pismeno']

/**
 * Sestaví úlohy ze dat trenažéru. Deterministické — ze stejného seedu padne
 * stejná série, takže se dá na chybu vrátit.
 *
 * Každá úloha má právě jednu správnou odpověď z povahy zadání: schéma i úplný
 * výčet znaků určují druh sítě jednoznačně a význam písmene je dán jeho pozicí
 * v kódu. Úlohy na jediný znak se záměrně nesestavují — „jeden bod zdroje je
 * přímo uzemněn" platí pro TN i TT, takže taková otázka by měla dvě správné
 * odpovědi.
 */
export function sestavUkoly(
  data: SitData,
  rng: Rng,
  opts: { typy?: UkolTyp[]; pocet?: number } = {},
): Ukol[] {
  const typy = new Set(opts.typy ?? VSECHNY_TYPY)
  const ukoly: Ukol[] = []
  const kodyMoznosti = data.druhy.map((d) => ({ id: d.id, text: d.kod }))

  if (typy.has('schema')) {
    for (const d of data.druhy) {
      ukoly.push({
        id: `schema-${d.id}`,
        typ: 'schema',
        zadani: 'Který druh sítě je na schématu?',
        schemaDruhId: d.id,
        moznosti: kodyMoznosti,
        spravnaId: d.id,
        vysvetleni: [d.rozpad.join(' · '), ...d.znaky].join(' '),
      })
    }
  }

  if (typy.has('znaky')) {
    for (const d of data.druhy) {
      ukoly.push({
        id: `znaky-${d.id}`,
        typ: 'znaky',
        zadani: `Který druh sítě je takto popsaný? ${d.znaky.join(' ')}`,
        moznosti: kodyMoznosti,
        spravnaId: d.id,
        vysvetleni: d.rozpad.join(' · '),
      })
    }
  }

  if (typy.has('pismeno')) {
    for (const p of data.pismena) {
      for (const v of p.varianty) {
        const moznosti = p.varianty.map((x) => ({
          id: `${p.pozice}-${x.znak}`,
          text: x.popis,
        }))
        ukoly.push({
          id: `pismeno-${p.pozice}-${v.znak}`,
          typ: 'pismeno',
          zadani: `Co znamená písmeno ${v.znak} na pozici „${p.pozice}"? ${p.vyznam}`,
          moznosti,
          spravnaId: `${p.pozice}-${v.znak}`,
          vysvetleni: `${p.vyznam} ${v.popis}`,
        })
      }
    }
  }

  const poradi = shuffle(ukoly, rng)
  return opts.pocet ? poradi.slice(0, opts.pocet) : poradi
}

/** Pořadí možností pro jednu úlohu. Míchá se, aby se nedrželo pozice. */
export function poradiMoznosti(ukol: Ukol, rng: Rng): string[] {
  return shuffle(
    ukol.moznosti.map((m) => m.id),
    rng,
  )
}

export interface SitVysledek {
  zodpovezeno: number
  spravne: number
  /** ID úloh, ve kterých se chybovalo. Nabídnou se k zopakování. */
  chybne: string[]
}

export function vyhodnot(ukoly: Ukol[], volby: Record<string, string | null>): SitVysledek {
  let zodpovezeno = 0
  let spravne = 0
  const chybne: string[] = []
  for (const u of ukoly) {
    const volba = volby[u.id]
    if (volba == null) continue
    zodpovezeno++
    if (volba === u.spravnaId) spravne++
    else chybne.push(u.id)
  }
  return { zodpovezeno, spravne, chybne }
}
