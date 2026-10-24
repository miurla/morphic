import { describe, expect, test } from 'vitest'

import { analyzeSourceCards, loadSourceCardsDataset } from '../source-cards'

const URLS = ['https://a.example/', 'https://b.example/', 'https://c.example/']

function cardsBlock(items: { title: string; url: string }[]): string {
  const keys = items.map((_, i) => `c${i}`)
  return [
    '```spec',
    '{"op":"add","path":"/root","value":"grid"}',
    `{"op":"add","path":"/elements/grid","value":{"type":"Grid","props":{"columns":2},"children":${JSON.stringify(keys)}}}`,
    ...items.flatMap((item, i) => [
      `{"op":"add","path":"/elements/c${i}","value":{"type":"Card","props":{"href":${JSON.stringify(item.url)}},"children":["t${i}"]}}`,
      `{"op":"add","path":"/elements/t${i}","value":{"type":"Text","props":{"text":${JSON.stringify(item.title)},"weight":"semibold"},"children":[]}}`
    ]),
    '```'
  ].join('\n')
}

describe('analyzeSourceCards', () => {
  test('accepts grounded, well-formed cards', () => {
    const answer = `Lead-in.\n\n${cardsBlock([
      { title: 'Alpha', url: URLS[0] },
      { title: 'Beta', url: URLS[1] }
    ])}\n\nClosing.`
    const analysis = analyzeSourceCards(answer, URLS)

    expect(analysis.emitted).toBe(true)
    expect(analysis.wellFormed).toBe(true)
    expect(analysis.ungroundedUrls).toEqual([])
    expect(analysis.duplicatedAsList).toBe(false)
  })

  test('reports URLs that are not search results', () => {
    const answer = cardsBlock([
      { title: 'Alpha', url: URLS[0] },
      { title: 'Made up', url: 'https://invented.example/' }
    ])
    const analysis = analyzeSourceCards(answer, URLS)

    expect(analysis.ungroundedUrls).toEqual(['https://invented.example/'])
  })

  test('reports cards that link an article instead of the item page', () => {
    const answer = cardsBlock([
      { title: 'Alpha', url: URLS[0] },
      { title: 'Gamma', url: URLS[2] }
    ])
    const analysis = analyzeSourceCards(answer, URLS, new Set([URLS[2]]))

    expect(analysis.ungroundedUrls).toEqual([])
    expect(analysis.misattributedUrls).toEqual([URLS[2]])
  })

  test('does not count cards the root does not reach', () => {
    const answer = [
      '```spec',
      '{"op":"add","path":"/root","value":"note"}',
      '{"op":"add","path":"/elements/note","value":{"type":"Text","props":{"text":"Nothing linked here"},"children":[]}}',
      `{"op":"add","path":"/elements/c1","value":{"type":"Card","props":{"href":"${URLS[0]}"},"children":[]}}`,
      `{"op":"add","path":"/elements/c2","value":{"type":"Card","props":{"href":"${URLS[1]}"},"children":[]}}`,
      '```'
    ].join('\n')
    const analysis = analyzeSourceCards(answer, URLS)

    expect(analysis.cards).toEqual([])
    expect(analysis.wellFormed).toBe(false)
  })

  test('flags a single card as malformed', () => {
    const analysis = analyzeSourceCards(
      cardsBlock([{ title: 'Alpha', url: URLS[0] }]),
      URLS
    )

    expect(analysis.emitted).toBe(true)
    expect(analysis.wellFormed).toBe(false)
  })

  test('detects the same items repeated as a list', () => {
    const answer = `${cardsBlock([
      { title: 'Alpha', url: URLS[0] },
      { title: 'Beta', url: URLS[1] }
    ])}\n\n- **Alpha:** good\n- **Beta:** also good`
    expect(analyzeSourceCards(answer, URLS).duplicatedAsList).toBe(true)
  })

  test('ignores answers without cards, including other spec blocks', () => {
    const answer = [
      'Plain answer.',
      '',
      '```spec',
      '{"op":"add","path":"/root","value":"main"}',
      '```'
    ].join('\n')
    const analysis = analyzeSourceCards(answer, URLS)

    expect(analysis.emitted).toBe(false)
    expect(analysis.wellFormed).toBe(false)
  })
})

describe('loadSourceCardsDataset', () => {
  test('expands trials and labels categories', () => {
    const items = loadSourceCardsDataset({ trials: 2 })
    const listing = items.filter(item => item.metadata.category === 'listing')

    expect(items.length % 2).toBe(0)
    expect(listing.length).toBeGreaterThan(0)
    expect(listing.every(item => item.expectedOutput.emitsCards)).toBe(true)
  })
})
