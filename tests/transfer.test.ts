import { describe, expect, it } from 'vitest'
import { parseSnapshot } from '../src/storage/transfer'

describe('import pokroku', () => {
  it('přijme vlastní export', () => {
    const raw = JSON.stringify({
      format: 'ticr-pokrok',
      schemaVersion: 1,
      exportedAt: '2026-11-23T10:00:00.000Z',
      attempts: [],
      progress: [],
    })
    expect(parseSnapshot(raw).format).toBe('ticr-pokrok')
  })

  it('odmítne cizí JSON', () => {
    expect(() => parseSnapshot('{"foo":1}')).toThrow(/není export pokroku/)
  })

  it('odmítne poškozený export', () => {
    const raw = JSON.stringify({ format: 'ticr-pokrok', schemaVersion: 1, exportedAt: 'x' })
    expect(() => parseSnapshot(raw)).toThrow(/poškozený/)
  })

  it('odmítne jinou verzi schématu', () => {
    const raw = JSON.stringify({ format: 'ticr-pokrok', schemaVersion: 2, attempts: [], progress: [] })
    expect(() => parseSnapshot(raw)).toThrow()
  })
})
