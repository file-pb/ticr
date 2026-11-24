import { describe, expect, it } from 'vitest'
import normyJson from '../src/data/normy.json'
import skupinyJson from '../src/data/normy-skupiny.json'
import bankJson from '../src/data/questions.2027.json'
import type { NormyData, SkupinyData } from '../src/domain/normy'
import {
  nejcitovanejsi,
  nejednotneZapsane,
  podilNejcitovanejsich,
  sestavMapu,
  vicEdic,
} from '../src/domain/normy'
import type { Bank } from '../src/domain/types'

const normy = normyJson as unknown as NormyData
const skupiny = skupinyJson as unknown as SkupinyData
const bank = bankJson as unknown as Bank

describe('mapa předpisů a norem', () => {
  it('každá položka má skupinu a žádná se cestou neztratí', () => {
    const mapa = sestavMapu(normy, skupiny)
    expect(mapa.nezarazene).toEqual([])
    const vMape = mapa.vrstvy.flatMap((v) => v.skupiny).flatMap((s) => s.polozky)
    expect(vMape).toHaveLength(normy.polozky.length)
    expect(new Set(vMape.map((p) => p.klic)).size).toBe(normy.polozky.length)
  })

  it('součty po vrstvách dávají dohromady všechny odkazy', () => {
    const mapa = sestavMapu(normy, skupiny)
    const soucet = mapa.vrstvy.reduce((a, v) => a + v.odkazu, 0)
    expect(soucet).toBe(mapa.odkazuCelkem)
    expect(mapa.odkazuCelkem).toBe(normy.polozky.reduce((a, p) => a + p.otazek, 0))
  })

  it('každá otázka z banky je v mapě aspoň jednou', () => {
    const pokryte = new Set(normy.polozky.flatMap((p) => p.otazky))
    const vBance = new Set(bank.questions.map((q) => q.id))
    expect(pokryte.size).toBe(vBance.size)
    for (const id of pokryte) expect(vBance.has(id)).toBe(true)
  })

  it('počty u položky sedí se seznamem otázek i s rozpadem po okruzích', () => {
    for (const p of normy.polozky) {
      expect(p.otazek).toBe(p.otazky.length)
      expect(Object.values(p.podleOkruhu).reduce((a, n) => a + n, 0)).toBe(p.otazky.length)
    }
  })

  it('rozpad po edicích pokrývá přesně tytéž otázky', () => {
    // Edice rozhoduje o odpovědi. Kdyby se otázka v rozpadu ztratila, zmizela
    // by právě ta, která odkazuje na starší edici.
    for (const p of normy.polozky) {
      const vEdicich = Object.values(p.otazkyPodleEdice).flat()
      if (vEdicich.length === 0) continue
      expect(vEdicich.slice().sort()).toEqual(p.otazky.slice().sort())
    }
  })

  it('najde předpisy odkazované ve víc edicích', () => {
    const pasti = vicEdic(normy)
    for (const p of pasti) {
      expect(p.edice.length).toBeGreaterThan(1)
      expect(Object.keys(p.otazkyPodleEdice).length).toBeGreaterThan(1)
    }
    // Pojistka proti tiché ztrátě: 62305-3 má v bance jednu otázku na ed. 2.
    const lps = pasti.find((p) => p.klic === '62305-3')
    expect(lps?.otazkyPodleEdice['ed. 2']).toEqual(['2027-ez4-060'])
  })

  it('najde předpisy, které banka píše dvěma způsoby', () => {
    for (const p of nejednotneZapsane(normy)) {
      expect(p.tvary.length).toBeGreaterThan(1)
      expect(p.tvary).toContain(p.oznaceni)
    }
  })

  it('podíl nejcitovanějších je mezi nulou a jedničkou a roste', () => {
    const p1 = podilNejcitovanejsich(normy, 1)
    const p5 = podilNejcitovanejsich(normy, 5)
    expect(p1).toBeGreaterThan(0)
    expect(p5).toBeGreaterThanOrEqual(p1)
    expect(podilNejcitovanejsich(normy, normy.polozky.length)).toBeCloseTo(1, 10)
  })

  it('nejcitovanější jsou seřazené sestupně', () => {
    const top = nejcitovanejsi(normy, 10)
    for (let i = 1; i < top.length; i++) {
      expect(top[i - 1]!.otazek).toBeGreaterThanOrEqual(top[i]!.otazek)
    }
  })

  it('mapa se netváří jako ověřená a popisky jsou buď pořádné, nebo žádné', () => {
    expect(skupiny.stavCeleho).toBe('navrh')
    expect(skupiny.varovani).toMatch(/neověřil|neověřen|vlastní/)
    for (const p of normy.polozky) {
      if (p.popis !== null) expect(p.popis.trim().length).toBeGreaterThan(10)
    }
  })
})
