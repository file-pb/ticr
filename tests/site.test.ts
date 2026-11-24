import { describe, expect, it } from 'vitest'
import sitJson from '../src/data/site.json'
import type { SitData } from '../src/domain/site'
import { poradiMoznosti, sestavUkoly, vyhodnot } from '../src/domain/site'
import { popisSchematu } from '../src/ui/SitSchema'
import { mulberry32 } from '../src/domain/rng'

const data = sitJson as unknown as SitData

describe('trenažér druhů sítí', () => {
  it('každá úloha má správnou odpověď mezi svými možnostmi', () => {
    const ukoly = sestavUkoly(data, mulberry32(1))
    expect(ukoly.length).toBeGreaterThan(0)
    for (const u of ukoly) {
      expect(u.moznosti.map((m) => m.id)).toContain(u.spravnaId)
      expect(u.moznosti.length).toBeGreaterThan(1)
      expect(new Set(u.moznosti.map((m) => m.id)).size).toBe(u.moznosti.length)
    }
  })

  it('zadání ani schéma neprozradí kód sítě', () => {
    // Obrázek je v trenažéru zadáním. Kdyby kód stál v popisku nebo v textu
    // pro čtečku, úloha by se dala přečíst bez znalosti.
    const ukoly = sestavUkoly(data, mulberry32(2))
    for (const u of ukoly) {
      for (const d of data.druhy) {
        expect(u.zadani).not.toContain(d.kod)
      }
    }
    for (const d of data.druhy) {
      const popis = popisSchematu(d.schema)
      for (const jiny of data.druhy) {
        expect(popis).not.toContain(jiny.kod)
      }
    }
  })

  it('schéma určuje druh sítě jednoznačně', () => {
    const podpisy = data.druhy.map((d) => JSON.stringify(d.schema))
    expect(new Set(podpisy).size).toBe(data.druhy.length)
  })

  it('každý druh dostane úlohu na schéma i na znaky', () => {
    const ukoly = sestavUkoly(data, mulberry32(3))
    for (const d of data.druhy) {
      expect(ukoly.filter((u) => u.typ === 'schema' && u.spravnaId === d.id)).toHaveLength(1)
      expect(ukoly.filter((u) => u.typ === 'znaky' && u.spravnaId === d.id)).toHaveLength(1)
    }
  })

  it('stejný seed dá stejnou sérii', () => {
    const a = sestavUkoly(data, mulberry32(7)).map((u) => u.id)
    const b = sestavUkoly(data, mulberry32(7)).map((u) => u.id)
    expect(a).toEqual(b)
  })

  it('pořadí možností je přeházené, ale úplné', () => {
    const ukol = sestavUkoly(data, mulberry32(5))[0]!
    const poradi = poradiMoznosti(ukol, mulberry32(9))
    expect(poradi.slice().sort()).toEqual(ukol.moznosti.map((m) => m.id).sort())
  })

  it('lze omezit typ úloh', () => {
    const jenSchema = sestavUkoly(data, mulberry32(4), { typy: ['schema'] })
    expect(jenSchema).toHaveLength(data.druhy.length)
    expect(jenSchema.every((u) => u.typ === 'schema')).toBe(true)
  })

  it('vyhodnocení počítá jen zodpovězené a vyjmenuje chyby', () => {
    const ukoly = sestavUkoly(data, mulberry32(6), { typy: ['schema'] })
    const prvni = ukoly[0]!
    const druhy = ukoly[1]!
    const spatna = druhy.moznosti.find((m) => m.id !== druhy.spravnaId)!.id
    const v = vyhodnot(ukoly, { [prvni.id]: prvni.spravnaId, [druhy.id]: spatna })
    expect(v).toEqual({ zodpovezeno: 2, spravne: 1, chybne: [druhy.id] })
  })

  it('trenažér se nikde netváří jako ověřený', () => {
    expect(data.stavCeleho).toBe('navrh')
    expect(data.varovani).toMatch(/neověřil|neověřen/)
    expect(data.doloz).toContain('ČSN')
  })
})
