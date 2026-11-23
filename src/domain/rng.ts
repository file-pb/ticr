/**
 * Deterministický generátor. Pokus si ukládá seed, takže se po obnovení
 * stránky složí ve stejném pořadí otázek i možností.
 */
export type Rng = () => number

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Fisher–Yates. Vrací novou kopii, vstup nemění. */
export function shuffle<T>(input: readonly T[], rng: Rng): T[] {
  const out = input.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const a = out[i] as T
    const b = out[j] as T
    out[i] = b
    out[j] = a
  }
  return out
}

export function newSeed(): number {
  return (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1
}
