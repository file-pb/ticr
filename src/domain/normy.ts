/**
 * Mapa předpisů a norem, na které sada otázek odkazuje.
 *
 * Dvě vrstvy s velmi různou vahou, které se nesmí slít:
 *   - **počty, označení, edice a zařazení otázek** plynou z oficiální banky
 *     a přepočítá je `scripts/build_normy.py`
 *   - **popisky skupin a norem** jsou vlastní text téhle aplikace pro
 *     orientaci, neověřený proti katalogu ČAS
 */

export type DruhPredpisu = 'csn' | 'pravni'

export interface NormaPolozka {
  /** Číselné označení bez prefixu — „33 2000-4-41", „62305-3", „250/2021". */
  klic: string
  druh: DruhPredpisu
  /** Nejčastější zapsaný tvar v bance. */
  oznaceni: string
  /** Všechny tvary, kterými odkaz v bance stojí. Víc než jeden = nejednotnost zdroje. */
  tvary: string[]
  edice: string[]
  roky: string[]
  /** Které otázky odkazují na kterou edici. Edice rozhoduje o odpovědi. */
  otazkyPodleEdice: Record<string, string[]>
  skupina: string | null
  /** Vlastní popisek. null znamená, že jsem si jím nebyl jistý. */
  popis: string | null
  otazek: number
  podleOkruhu: Record<string, number>
  otazky: string[]
}

export interface NormyData {
  schemaVersion: number
  generovano: string
  skript: string
  bankVersion: string
  poznamka: string
  otazekVBance: number
  bezRozpoznanehoOdkazu: string[]
  polozky: NormaPolozka[]
}

export interface SkupinaDef {
  id: string
  nazev: string
  zkratka: string
  popis: string
  vzor: string
  druh: DruhPredpisu
  vrstva: string
}

export interface VrstvaDef {
  id: string
  nazev: string
  popis: string
}

export interface SkupinyData {
  schemaVersion: number
  verze: string
  nazev: string
  stavCeleho: 'navrh'
  varovani: string
  doloz: string
  vrstvy: VrstvaDef[]
  skupiny: SkupinaDef[]
  popisky: Record<string, string>
}

export interface SkupinaVMape {
  def: SkupinaDef
  polozky: NormaPolozka[]
  odkazu: number
  /** Podíl na všech odkazech v mapě, 0 až 1. */
  podil: number
}

export interface VrstvaVMape {
  def: VrstvaDef
  skupiny: SkupinaVMape[]
  odkazu: number
  podil: number
}

export interface Mapa {
  vrstvy: VrstvaVMape[]
  /** Součet odkazů přes všechny položky. Vyšší než počet otázek: odkaz může
   *  jmenovat dva předpisy a pak se počítá u obou. */
  odkazuCelkem: number
  otazekVBance: number
  /** Položky, které se nepodařilo zařadit. Prázdné, dokud kontrola prochází. */
  nezarazene: NormaPolozka[]
}

export function sestavMapu(normy: NormyData, skupiny: SkupinyData): Mapa {
  const odkazuCelkem = normy.polozky.reduce((a, p) => a + p.otazek, 0) || 1
  const podleSkupiny = new Map<string, NormaPolozka[]>()
  const nezarazene: NormaPolozka[] = []
  for (const p of normy.polozky) {
    if (!p.skupina) {
      nezarazene.push(p)
      continue
    }
    const sez = podleSkupiny.get(p.skupina) ?? []
    sez.push(p)
    podleSkupiny.set(p.skupina, sez)
  }

  const vrstvy: VrstvaVMape[] = skupiny.vrstvy.map((v) => {
    const sk = skupiny.skupiny
      .filter((s) => s.vrstva === v.id)
      .map((def) => {
        const polozky = (podleSkupiny.get(def.id) ?? [])
          .slice()
          .sort((a, b) => b.otazek - a.otazek || a.klic.localeCompare(b.klic, 'cs'))
        const odkazu = polozky.reduce((a, p) => a + p.otazek, 0)
        return { def, polozky, odkazu, podil: odkazu / odkazuCelkem }
      })
      .filter((s) => s.polozky.length > 0)
    const odkazu = sk.reduce((a, s) => a + s.odkazu, 0)
    return { def: v, skupiny: sk, odkazu, podil: odkazu / odkazuCelkem }
  })

  return {
    vrstvy,
    odkazuCelkem,
    otazekVBance: normy.otazekVBance,
    nezarazene,
  }
}

/** Nejcitovanější předpisy. Odpovídá na „čím začít", ne na „co je důležité". */
export function nejcitovanejsi(normy: NormyData, kolik: number): NormaPolozka[] {
  return normy.polozky.slice().sort((a, b) => b.otazek - a.otazek).slice(0, kolik)
}

/** Jaký podíl všech odkazů připadá na prvních `kolik` předpisů. */
export function podilNejcitovanejsich(normy: NormyData, kolik: number): number {
  const celkem = normy.polozky.reduce((a, p) => a + p.otazek, 0)
  if (celkem === 0) return 0
  return nejcitovanejsi(normy, kolik).reduce((a, p) => a + p.otazek, 0) / celkem
}

/**
 * Předpisy, na které banka odkazuje ve víc než jedné edici.
 *
 * Tohle není drobnost: starší edice téže normy může mít jinou hodnotu i jinou
 * strukturu článků, takže otázka odkazující na starší edici se nedá zodpovědět
 * podle novější. Seřazeno tak, aby menšinová edice byla vidět první.
 */
export function vicEdic(normy: NormyData): NormaPolozka[] {
  return normy.polozky
    .filter((p) => p.edice.length > 1)
    .sort((a, b) => b.otazek - a.otazek)
}

/** Předpisy, které banka píše víc než jedním způsobem. Nejednotnost je ve zdroji. */
export function nejednotneZapsane(normy: NormyData): NormaPolozka[] {
  return normy.polozky.filter((p) => p.tvary.length > 1)
}
