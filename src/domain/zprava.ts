/**
 * Průvodce revizní zprávou.
 *
 * Obsah je **doslovný text nařízení vlády č. 190/2022 Sb.** vytažený
 * skriptem; `scripts/check_zprava.py` ověřuje, že každá věta v předpisu
 * doslova stojí. Vlastní je jen rozdělení do fází a pár poznámek — ty jsou
 * v `src/data/zprava.json` a v rozhraní jsou označené jako moje.
 */

export interface CitaceBod {
  znak: string
  text: string
}

export interface CitaceSekce {
  id: string
  nazev: string
  /** Ustanovení, ze kterého sekce pochází. */
  zdroj: string
  uvod: string
  body: CitaceBod[]
  /** Otázky z banky, které na tohle ustanovení odkazují. */
  otazky: string[]
}

export interface LhutaRadek {
  co: string
  lhuta: string
  skupina: string | null
}

export interface CitaceData {
  schemaVersion: number
  generovano: string
  skript: string
  zdroj: { predpis: string; soubor: string; poznamka: string }
  sekce: CitaceSekce[]
  lhuty: {
    nazev: string
    zdroj: string
    radky: LhutaRadek[]
    doplnky: CitaceBod[]
    doplnkyLps: CitaceBod[]
    zbytek: string
    otazky: string[]
  }
}

export interface Faze {
  id: string
  nazev: string
  popis: string
  sekce: string[]
}

export interface PruvodceData {
  schemaVersion: number
  verze: string
  nazev: string
  uvod: string
  comuNeni: string[]
  faze: Faze[]
  poznamky: Record<string, string>
}

export interface FazeSPolozkami {
  faze: Faze
  sekce: CitaceSekce[]
  bodu: number
}

export function sestavFaze(citace: CitaceData, pruvodce: PruvodceData): FazeSPolozkami[] {
  const podleId = new Map(citace.sekce.map((s) => [s.id, s]))
  return pruvodce.faze.map((faze) => {
    const sekce = faze.sekce.map((id) => podleId.get(id)).filter((s): s is CitaceSekce => !!s)
    return { faze, sekce, bodu: sekce.reduce((a, s) => a + s.body.length, 0) }
  })
}

/** Stabilní klíč jednoho bodu v odškrtávacím seznamu. */
export function klicBodu(sekceId: string, znak: string): string {
  return `${sekceId}.${znak}`
}

export function spocitejHotove(
  citace: CitaceData,
  hotove: Record<string, boolean>,
): { hotovo: number; celkem: number } {
  let hotovo = 0
  let celkem = 0
  for (const s of citace.sekce) {
    for (const b of s.body) {
      celkem++
      if (hotove[klicBodu(s.id, b.znak)]) hotovo++
    }
  }
  return { hotovo, celkem }
}

/** Lhůty seskupené tak, jak je člení příloha. */
export function lhutyPodleSkupin(citace: CitaceData): { skupina: string; radky: LhutaRadek[] }[] {
  const poradi: string[] = []
  const mapa = new Map<string, LhutaRadek[]>()
  for (const r of citace.lhuty.radky) {
    const k = r.skupina ?? ''
    if (!mapa.has(k)) {
      mapa.set(k, [])
      poradi.push(k)
    }
    mapa.get(k)!.push(r)
  }
  return poradi.map((skupina) => ({ skupina, radky: mapa.get(skupina)! }))
}
