import { describe, expect, it } from 'vitest'

import { summarizeGenui } from '@/lib/analytics/genui-summary'

const imageBlock = [
  '```spec',
  '{"op":"add","path":"/root","value":"grid"}',
  '{"op":"add","path":"/elements/grid","value":{"type":"Grid","props":{"columns":2},"children":["img1","img2"]}}',
  '{"op":"add","path":"/elements/img1","value":{"type":"Image","props":{"src":"https://example.com/a.jpg"},"children":[]}}',
  '{"op":"add","path":"/elements/img2","value":{"type":"Image","props":{"src":"https://example.com/b.jpg"},"children":[]}}',
  '```'
].join('\n')

const relatedBlock = [
  '```spec',
  '{"op":"add","path":"/root","value":"main"}',
  '{"op":"add","path":"/elements/main","value":{"type":"Stack","props":{},"children":["q1"]}}',
  '{"op":"add","path":"/elements/q1","value":{"type":"Button","props":{"text":"Q1","variant":"link"},"children":[]}}',
  '```'
].join('\n')

describe('summarizeGenui', () => {
  it('returns null when there are no spec blocks', () => {
    expect(summarizeGenui('just some markdown text')).toBeNull()
  })

  it('counts images in content blocks and excludes the related block', () => {
    const text = `Here are some photos.\n\n${imageBlock}\n\nMore text.\n\n${relatedBlock}`
    const summary = summarizeGenui(text)

    expect(summary).toEqual({
      blockCount: 2,
      contentBlockCount: 1,
      imageCount: 2,
      hasImage: true,
      hasRelated: true,
      componentTypes: ['Grid', 'Image']
    })
  })

  it('reports no image when only a related block is present', () => {
    const summary = summarizeGenui(`Answer.\n\n${relatedBlock}`)

    expect(summary).toMatchObject({
      blockCount: 1,
      contentBlockCount: 0,
      imageCount: 0,
      hasImage: false,
      hasRelated: true
    })
  })
})
