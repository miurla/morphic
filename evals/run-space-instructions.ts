#!/usr/bin/env bun
/**
 * Check that space instructions take effect without weakening search.
 *
 *   bun run eval:space-instructions
 *   bun run eval:space-instructions -- --trials 2 --mode quick --checks language-chat
 *
 * Checks, each with pinned search results:
 * - language-draft: Japanese writing requests in a space whose (Japanese)
 *   instructions ask for articles in English and chat in Japanese.
 *   Rate = an English draft block with Japanese text around it. Missing draft
 *   blocks are counted apart from language errors.
 * - language-chat: ordinary Japanese questions in the same space.
 *   Rate = Japanese answers. The control arm is the prompt before the language
 *   rule became conditional, with no space; "none" is the current prompt.
 * - language-always: ordinary Japanese questions in a space that asks for
 *   English replies, explanations included. Rate = English answers.
 * - structure: English queries, a space asking for H2 headings and a closing
 *   3-bullet summary. Rate = answers with that structure.
 * - search: informational queries, a space saying not to search the web.
 *   Rate = answers that called search. It should drop below the "none" arm.
 * - search-explicit: the same space, but each message asks to search.
 *   Rate = answers that called search. The user's request beats the space,
 *   so it should stay near the "none" arm.
 *
 * Space arms run with the per-turn note off and on, so the note's effect is
 * measured on its own. Answers expected in Japanese that mix in a Chinese
 * clause count as misses and are reported in the "zh" column.
 */
import { config as dotenvConfig } from 'dotenv'

dotenvConfig({ path: '.env.local' })

process.env.BRAVE_SEARCH_API_KEY ||= 'eval-pinned-general-provider'

import datasetJson from './datasets/related-questions.json'
import { type SearchFixture } from './lib/dataset'
import {
  classifyLanguage,
  classifyShortLanguage,
  followsStructure,
  hasChineseClause,
  splitDraft
} from './lib/space-instructions'

type Mode = 'quick' | 'adaptive'
type Check =
  | 'language-draft'
  | 'language-chat'
  | 'language-always'
  | 'structure'
  | 'search'
  | 'search-explicit'
type Arm = 'control' | 'none' | 'space' | 'space+note'

type Item = { fixture: string; query: string }

const JAPANESE_ITEMS: Item[] = [
  {
    fixture: 'mount-fuji',
    query: '富士山の主な登山ルートを比較して、それぞれ誰に向いているか教えて'
  },
  { fixture: 'mount-fuji', query: '富士山の公式な登山シーズンはいつ始まる？' },
  {
    fixture: 'ev-batteries',
    query: 'LFPとNMCのバッテリーの違いと、どんな用途に向いているかを説明して'
  },
  {
    fixture: 'postgres-indexes',
    query: 'Postgresでjsonb列を絞り込むときはどのインデックスを使うべき？'
  },
  {
    fixture: 'sleep',
    query: 'よく眠るために夜の習慣をどう変えればいいですか'
  },
  {
    fixture: 'coffee',
    query:
      'ハンドドリップ、エスプレッソ、フレンチプレスを比べておすすめを教えて'
  },
  {
    fixture: 'hybrid-work',
    query: 'ハイブリッドワークの生産性について研究では何が分かっていますか'
  },
  { fixture: 'coffee', query: 'コーヒーを淹れるお湯の温度は何度がいい？' }
]

const WRITING_ITEMS: Item[] = [
  {
    fixture: 'ev-batteries',
    query: '電気自動車のバッテリーの種類について記事を書いて'
  },
  {
    fixture: 'mount-fuji',
    query: '富士山の登山ルートを紹介するブログ記事を書いて'
  },
  {
    fixture: 'coffee',
    query: 'コーヒーの淹れ方を比較する記事を書いてください'
  },
  { fixture: 'sleep', query: '睡眠を改善する夜の習慣についての記事を作って' }
]

const ARTICLES_SPACE = {
  about: 'Researching and writing articles for my blog',
  style: '記事の本文と見出しは英語で書く。会話や説明は日本語でよい。'
}

const ALWAYS_ENGLISH_SPACE = {
  about: 'Researching and writing articles for my blog',
  style:
    'このスペースでは、日本語で話しかけても、説明も含めて常に英語で返答する。'
}

type Score = { hit: boolean; flag?: 'zh' | 'no-draft' }

const datasetItems = datasetJson.items as {
  category: string
  fixture: string
  query: string
}[]
const SUBSTANTIVE_ITEMS: Item[] = datasetItems
  .filter(item => item.category === 'substantive')
  .slice(0, 8)
const INFORMATIONAL_ITEMS: Item[] = [
  ...datasetItems.filter(item => item.category === 'substantive').slice(0, 4),
  ...datasetItems.filter(item => item.category === 'trivial').slice(0, 4)
]

const NO_SEARCH_SPACE = {
  about: 'Quick questions while I work.',
  style: 'Do not search the web. Answer from what you already know.'
}

const CHECKS: Record<
  Check,
  {
    items: Item[]
    arms: Arm[]
    space: { about: string; style: string }
    score: (output: { text: string; searchQueries: string[] }) => Score
  }
> = {
  'language-draft': {
    items: WRITING_ITEMS,
    arms: ['space', 'space+note'],
    space: ARTICLES_SPACE,
    score: ({ text }) => {
      const { draft, outside } = splitDraft(text)
      if (draft === null) return { hit: false, flag: 'no-draft' }
      if (hasChineseClause(outside)) return { hit: false, flag: 'zh' }
      return {
        hit:
          classifyShortLanguage(draft) === 'en' &&
          classifyShortLanguage(outside) === 'ja'
      }
    }
  },
  'language-chat': {
    items: JAPANESE_ITEMS,
    arms: ['control', 'none', 'space', 'space+note'],
    space: ARTICLES_SPACE,
    score: ({ text }) =>
      hasChineseClause(text)
        ? { hit: false, flag: 'zh' }
        : { hit: classifyLanguage(text) === 'ja' }
  },
  'language-always': {
    items: JAPANESE_ITEMS,
    arms: ['none', 'space', 'space+note'],
    space: ALWAYS_ENGLISH_SPACE,
    score: ({ text }) => ({ hit: classifyLanguage(text) === 'en' })
  },
  structure: {
    items: SUBSTANTIVE_ITEMS,
    arms: ['none', 'space', 'space+note'],
    space: {
      about: 'Researching topics for internal briefings.',
      style: 'Use H2 headings and end with a 3-bullet summary.'
    },
    score: output => ({ hit: followsStructure(output.text) })
  },
  search: {
    items: INFORMATIONAL_ITEMS,
    arms: ['none', 'space', 'space+note'],
    space: NO_SEARCH_SPACE,
    score: output => ({ hit: output.searchQueries.length > 0 })
  },
  'search-explicit': {
    items: INFORMATIONAL_ITEMS.map(item => ({
      ...item,
      query: `Look this up on the web: ${item.query}`
    })),
    arms: ['none', 'space', 'space+note'],
    space: NO_SEARCH_SPACE,
    score: output => ({ hit: output.searchQueries.length > 0 })
  }
}

const OLD_LANGUAGE_RULE = "- ALWAYS respond in the user's language."

function parseArgs(argv: string[]) {
  const args = {
    modes: ['quick', 'adaptive'] as Mode[],
    checks: [
      'language-draft',
      'language-chat',
      'language-always',
      'structure',
      'search',
      'search-explicit'
    ] as Check[],
    trials: 1,
    concurrency: 6
  }
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]
    const value = argv[i + 1]
    if (flag === '--mode') {
      if (value !== 'quick' && value !== 'adaptive') {
        throw new Error('--mode must be quick or adaptive')
      }
      args.modes = [value]
      i++
    } else if (flag === '--checks') {
      args.checks = value.split(',') as Check[]
      i++
    } else if (flag === '--trials') {
      args.trials = Number(value)
      i++
    } else if (flag === '--concurrency') {
      args.concurrency = Number(value)
      i++
    }
  }
  return args
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const [
    { getAdaptiveModePrompt, getQuickModePrompt, LANGUAGE_RULE },
    { attachSpaceNote, buildSpaceInstructions },
    { runAnswerTask },
    quick,
    adaptive
  ] = await Promise.all([
    import('@/lib/agents/prompts/search-mode-prompts'),
    import('@/lib/agents/prompts/space-instructions'),
    import('./tasks/run-answer-task'),
    import('./tasks/quick-answer'),
    import('./tasks/adaptive-answer')
  ])

  const fixtures = datasetJson.fixtures as Record<string, SearchFixture[]>
  const currentDate = new Date().toLocaleDateString()

  function createTask(mode: Mode, check: Check, arm: Arm) {
    const base =
      mode === 'quick' ? getQuickModePrompt() : getAdaptiveModePrompt()
    if (!base.includes(LANGUAGE_RULE)) {
      throw new Error('Language rule not found in prompt')
    }
    const prompt =
      arm === 'control' ? base.replace(LANGUAGE_RULE, OLD_LANGUAGE_RULE) : base
    const space =
      arm === 'space' || arm === 'space+note'
        ? buildSpaceInstructions(CHECKS[check].space)
        : ''
    const instructions = `${prompt}${space ? `\n\n${space}` : ''}\nCurrent date: ${currentDate}`
    const config = mode === 'quick' ? quick : adaptive

    return runAnswerTask({
      model: config.DEFAULT_MODEL,
      providerOptions: config.DEFAULT_PROVIDER_OPTIONS,
      tracingEnabled: false,
      retries: 2,
      maxSteps: 20,
      getPrompt: () => instructions,
      includeTodoWrite: mode === 'adaptive',
      telemetryFunctionId: 'eval-space-instructions',
      buildMessages: query =>
        attachSpaceNote(
          [{ role: 'user', content: query }],
          arm === 'space+note' ? space : '',
          process.env.EVAL_SPACE_NOTE || undefined
        )
    })
  }

  type Job = { mode: Mode; check: Check; arm: Arm; item: Item }
  const jobs: Job[] = []
  const tasks = new Map<string, ReturnType<typeof runAnswerTask>>()
  for (const mode of args.modes) {
    for (const check of args.checks) {
      for (const arm of CHECKS[check].arms) {
        tasks.set(`${mode}:${check}:${arm}`, createTask(mode, check, arm))
        for (const item of CHECKS[check].items) {
          for (let t = 0; t < args.trials; t++) {
            jobs.push({ mode, check, arm, item })
          }
        }
      }
    }
  }

  const results: { job: Job; score?: Score; error?: string }[] = []
  let cursor = 0
  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor++]
      const task = tasks.get(`${job.mode}:${job.check}:${job.arm}`)!
      try {
        const output = await task({
          input: { query: job.item.query, results: fixtures[job.item.fixture] }
        })
        results.push({ job, score: CHECKS[job.check].score(output) })
      } catch (error) {
        results.push({
          job,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }
  }
  await Promise.all(Array.from({ length: args.concurrency }, worker))

  console.log(
    '\ncheck            mode      arm          rate   hits/scored  no-draft  zh  errors'
  )
  for (const check of args.checks) {
    for (const mode of args.modes) {
      for (const arm of CHECKS[check].arms) {
        const rows = results.filter(
          r => r.job.check === check && r.job.mode === mode && r.job.arm === arm
        )
        const scored = rows.filter(r => r.score !== undefined)
        const hits = scored.filter(r => r.score?.hit).length
        const flagged = (flag: Score['flag']) =>
          String(scored.filter(r => r.score?.flag === flag).length)
        const rate = scored.length ? (hits / scored.length).toFixed(2) : '-'
        console.log(
          `${check.padEnd(16)} ${mode.padEnd(9)} ${arm.padEnd(12)} ${rate.padStart(4)}   ${`${hits}/${scored.length}`.padStart(11)}  ${flagged('no-draft').padStart(8)}  ${flagged('zh').padStart(2)}  ${String(rows.length - scored.length).padStart(6)}`
        )
      }
    }
  }
  for (const failed of results.filter(r => r.error)) {
    console.log(
      `error ${failed.job.check}/${failed.job.mode}/${failed.job.arm}: ${failed.error}`
    )
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
