import { describe, expect, it } from 'vitest'
import bankJson from '../src/data/questions.2027.json'
import type { Bank } from '../src/domain/types'

const bank = bankJson as unknown as Bank

/** Testy nad skutečnou naimportovanou bankou, ne nad fixturou. */
describe('skutečná banka 2027', () => {
  it('má 430 otázek ve čtyřech okruzích', () => {
    expect(bank.questions).toHaveLength(430)
    expect(bank.bankVersion).toBe('2027.1')
    expect(bank.validFrom).toBe('2027-01-01')
  })

  it('počty po okruzích souhlasí s očekáváním ze zdroje', () => {
    const ocekavano: Record<string, number> = { ez1: 90, ez2: 100, ez3: 140, ez4: 100 }
    for (const [circuit, kolik] of Object.entries(ocekavano)) {
      expect(bank.questions.filter((q) => q.circuit === circuit)).toHaveLength(kolik)
    }
  })

  it('nemá duplicitní ID ani mezery v číslování', () => {
    const ids = bank.questions.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)

    for (const circuit of ['ez1', 'ez2', 'ez3', 'ez4']) {
      const cisla = bank.questions.filter((q) => q.circuit === circuit).map((q) => q.number).sort((a, b) => a - b)
      expect(cisla[0]).toBe(1)
      expect(cisla[cisla.length - 1]).toBe(cisla.length)
    }
  })

  it('každá otázka má text i normativní odkaz', () => {
    for (const q of bank.questions) {
      expect(q.text.length).toBeGreaterThan(10)
      expect(q.normativeRef.length).toBeGreaterThan(3)
    }
  })

  it('nezůstaly artefakty konverze z Wordu', () => {
    const spatne = bank.questions.filter(
      (q) => /HYPERLINK| |​/.test(q.text + q.normativeRef) || /\s{2,}/.test(q.text),
    )
    expect(spatne.map((q) => q.id)).toEqual([])
  })

  it('otázka ez1/34 se značkou 34/ je v bance', () => {
    const q = bank.questions.find((x) => x.id === '2027-ez1-034')
    expect(q?.sourceMarker).toBe('34/')
  })

  it('prvních 12 otázek ez4 je nečíslovaných a přesto naimportovaných', () => {
    const ez4 = bank.questions.filter((q) => q.circuit === 'ez4')
    expect(ez4.filter((q) => !q.numberedInSource)).toHaveLength(12)
    expect(ez4.filter((q) => q.numberedInSource)).toHaveLength(88)
  })

  it('nese dohledatelný původ včetně kontrolního součtu', () => {
    expect(bank.provenance.zipUrl).toContain('ticr.eu')
    expect(bank.provenance.zipSha256).toMatch(/^[0-9a-f]{64}$/)
    expect(bank.provenance.files).toHaveLength(4)
  })
})
