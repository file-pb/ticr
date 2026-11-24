import { describe, expect, it } from 'vitest'
import citaceJson from '../src/data/zprava-citace.json'
import pruvodceJson from '../src/data/zprava.json'
import bankJson from '../src/data/questions.2027.json'
import type { CitaceData, PruvodceData } from '../src/domain/zprava'
import { klicBodu, lhutyPodleSkupin, sestavFaze, spocitejHotove } from '../src/domain/zprava'
import type { Bank } from '../src/domain/types'

const citace = citaceJson as unknown as CitaceData
const pruvodce = pruvodceJson as unknown as PruvodceData
const bank = bankJson as unknown as Bank

describe('průvodce revizní zprávou', () => {
  it('každá sekce je právě v jedné fázi a nic se neztratí', () => {
    const faze = sestavFaze(citace, pruvodce)
    const vFazich = faze.flatMap((f) => f.sekce.map((s) => s.id))
    expect(vFazich.slice().sort()).toEqual(citace.sekce.map((s) => s.id).sort())
    expect(new Set(vFazich).size).toBe(vFazich.length)
  })

  it('zpráva o revizi má patnáct náležitostí od a) po o)', () => {
    // Pojistka proti tichému výpadku: kdyby extraktor některé písmeno přeskočil,
    // průvodce by mlčky učil neúplný výčet.
    const obsah = citace.sekce.find((s) => s.id === 'zprava-obsah')!
    expect(obsah.body).toHaveLength(15)
    expect(obsah.body.map((b) => b.znak)).toEqual('abcdefghijklmno'.split(''))
    expect(obsah.zdroj).toContain('§ 10')
  })

  it('body jdou v každé sekci po sobě bez díry', () => {
    for (const s of citace.sekce) {
      const znaky = s.body.map((b) => b.znak)
      expect(znaky).toEqual(znaky.slice().sort())
      for (let i = 0; i < znaky.length; i++) {
        expect(znaky[i]).toBe(String.fromCharCode(97 + i))
      }
    }
  })

  it('žádný bod není prázdný ani zkrácený na nic', () => {
    // Prázdný řetězec projde kontrolou na doslovnost — je podřetězcem všeho.
    // Nadpis přílohy se takhle jednou skutečně vytratil, proto se hlídá zvlášť.
    for (const s of citace.sekce) {
      expect(s.uvod.length).toBeGreaterThan(10)
      for (const b of s.body) expect(b.text.length).toBeGreaterThan(10)
    }
    expect(citace.lhuty.nazev.length).toBeGreaterThan(10)
    expect(citace.lhuty.zbytek.length).toBeGreaterThan(10)
    for (const b of [...citace.lhuty.doplnky, ...citace.lhuty.doplnkyLps]) {
      expect(b.text.length).toBeGreaterThan(10)
    }
  })

  it('pořadí zkoušek je to z předpisu, ne abecední seznam pojmů', () => {
    const poradi = citace.sekce.find((s) => s.id === 'zkouska-poradi')!
    expect(poradi.uvod).toContain('v tomto pořadí')
    expect(poradi.body[0]!.text).toContain('spojitost ochranných vodičů')
    expect(poradi.body).toHaveLength(12)
  })

  it('lhůty jsou rozdělené do skupin a každá má hodnotu', () => {
    const skupiny = lhutyPodleSkupin(citace)
    expect(skupiny.length).toBeGreaterThan(1)
    const radky = skupiny.flatMap((s) => s.radky)
    expect(radky).toHaveLength(citace.lhuty.radky.length)
    for (const r of radky) {
      expect(r.co.length).toBeGreaterThan(3)
      expect(r.lhuta).toMatch(/\d/)
    }
    expect(skupiny.some((s) => s.radky.some((r) => r.co.includes('LPS')))).toBe(true)
  })

  it('odškrtávání počítá body napříč sekcemi', () => {
    const prvni = citace.sekce[0]!
    const { celkem } = spocitejHotove(citace, {})
    expect(celkem).toBe(citace.sekce.reduce((a, s) => a + s.body.length, 0))
    expect(spocitejHotove(citace, {}).hotovo).toBe(0)
    const klic = klicBodu(prvni.id, prvni.body[0]!.znak)
    expect(spocitejHotove(citace, { [klic]: true }).hotovo).toBe(1)
    // Klíč, který k žádnému bodu nepatří, se do počtu neplete.
    expect(spocitejHotove(citace, { 'nic.z': true }).hotovo).toBe(0)
  })

  it('odkazy na otázky míří do banky', () => {
    const vBance = new Set(bank.questions.map((q) => q.id))
    const vsechny = [...citace.sekce.flatMap((s) => s.otazky), ...citace.lhuty.otazky]
    expect(vsechny.length).toBeGreaterThan(0)
    for (const id of vsechny) expect(vBance.has(id)).toBe(true)
  })

  it('průvodce přiznává, co v něm není', () => {
    expect(pruvodce.comuNeni.length).toBeGreaterThan(2)
    expect(pruvodce.comuNeni.join(' ')).toMatch(/ČSN 33 1500/)
    expect(citace.zdroj.predpis).toContain('190/2022')
  })
})
