/**
 * E2E test: verify that an LLM actually emits well-formed inline image
 * spec blocks when given the researcher system prompt and a mocked search
 * tool returning image results.
 *
 * This test hits a real LLM API and is therefore gated behind the
 * `RUN_LLM_E2E=1` environment variable. CI runs without the flag and the
 * test is skipped. To run locally:
 *
 *   RUN_LLM_E2E=1 OPENAI_API_KEY=sk-... bun run test llm-image-output.e2e
 */
import { generateText, stepCountIs, tool } from 'ai'
import { describe, expect, test } from 'vitest'
import { z } from 'zod'

import { getAdaptiveModePrompt } from '@/lib/agents/prompts/search-mode-prompts'
import { getModel } from '@/lib/utils/registry'

import { parseSpecBlock } from '../parse-spec-block'

const RUN = process.env.RUN_LLM_E2E === '1'
const MODEL = process.env.LLM_E2E_MODEL || 'openai:gpt-4o-mini'

const FIXTURE_IMAGES = [
  {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/MtFuji_FujiCity.jpg/1280px-MtFuji_FujiCity.jpg',
    description: 'Mount Fuji seen from Fuji City'
  },
  {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/070722_Mt.Fuji_Yoshidaguchi_Trail.jpg/1280px-070722_Mt.Fuji_Yoshidaguchi_Trail.jpg',
    description: 'Yoshida trail on Mount Fuji'
  },
  {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/MtFuji_FujiCity_winter.jpg/1280px-MtFuji_FujiCity_winter.jpg',
    description: 'Mount Fuji in winter'
  }
]

const FIXTURE_RESULTS = [
  {
    title: 'Mount Fuji - Wikipedia',
    url: 'https://en.wikipedia.org/wiki/Mount_Fuji',
    content:
      'Mount Fuji is the tallest mountain in Japan, standing 3,776 meters. It is an active stratovolcano located on Honshu island.'
  }
]

function createMockSearchTool() {
  return tool({
    description:
      'Search the web for information. Returns text results and related images.',
    inputSchema: z.object({
      query: z.string(),
      type: z.enum(['optimized', 'general']).optional(),
      max_results: z.number().optional()
    }),
    async execute({ query }) {
      return {
        state: 'complete' as const,
        query,
        results: FIXTURE_RESULTS,
        images: FIXTURE_IMAGES,
        number_of_results: FIXTURE_RESULTS.length,
        toolCallId: 'mock-search-1'
      }
    }
  })
}

function extractSpecBlocks(markdown: string): string[] {
  const blocks: string[] = []
  const regex = /```spec\n([\s\S]*?)```/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(markdown)) !== null) {
    blocks.push(match[1])
  }
  return blocks
}

describe.skipIf(!RUN)('LLM inline image output (E2E)', () => {
  test('LLM emits inline image spec block using search tool images', async () => {
    const { text } = await generateText({
      model: getModel(MODEL),
      system: getAdaptiveModePrompt(),
      tools: {
        search: createMockSearchTool()
      },
      stopWhen: stepCountIs(6),
      prompt:
        'Show me photos of Mount Fuji and a brief description. Please include relevant images inline.'
    })

    console.log('[E2E] Model output:\n', text)

    const blocks = extractSpecBlocks(text)
    expect(blocks.length).toBeGreaterThanOrEqual(1)

    // Parse every spec block and check at least one contains an Image.
    const fixtureSrcs = new Set(FIXTURE_IMAGES.map(i => i.url))
    let imageCount = 0
    let hasRelatedQuestions = false

    for (const source of blocks) {
      const spec = parseSpecBlock(source)
      for (const el of Object.values(spec.elements) as Array<{
        type: string
        props: Record<string, unknown>
      }>) {
        if (el.type === 'Image') {
          imageCount++
          const src = el.props.src as string
          // src MUST be one of the fixture image URLs — no fabrication.
          expect(fixtureSrcs.has(src)).toBe(true)
        }
        if (el.type === 'Button') {
          hasRelatedQuestions = true
        }
      }
    }

    expect(imageCount).toBeGreaterThanOrEqual(1)
    // The related-questions block must still be emitted alongside images.
    expect(hasRelatedQuestions).toBe(true)
  }, 120_000)
})
