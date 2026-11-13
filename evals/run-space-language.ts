#!/usr/bin/env bun
/**
 * Check that the output language follows the user by default and follows
 * space instructions when they name a language.
 *
 *   bun run eval:space-language
 *   bun run eval:space-language -- --trials 3 --mode quick
 *
 * Arms, each on Japanese queries with pinned search results:
 * - control: the prompt before the language rule became conditional, no space
 * - default: the current prompt, no space (expected Japanese)
 * - english-space: the current prompt with a space that asks for English
 */
import { config as dotenvConfig } from 'dotenv'

dotenvConfig({ path: '.env.local' })

process.env.BRAVE_SEARCH_API_KEY ||= 'eval-pinned-general-provider'

import datasetJson from './datasets/related-questions.json'
import { type SearchFixture } from './lib/dataset'
import { classifyLanguage } from './lib/space-language'

type Mode = 'quick' | 'adaptive'
type Arm = 'control' | 'default' | 'english-space'

const ITEMS: { fixture: string; query: string }[] = [
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

const ENGLISH_SPACE = {
  about: 'Researching and writing articles for my English-language blog.',
  style: 'Write in English. Lead with the key point. Short paragraphs.'
}

const OLD_LANGUAGE_RULE = "- ALWAYS respond in the user's language."

function parseArgs(argv: string[]) {
  const args = {
    modes: ['quick', 'adaptive'] as Mode[],
    arms: ['control', 'default', 'english-space'] as Arm[],
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
    } else if (flag === '--arms') {
      args.arms = value.split(',') as Arm[]
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
    { buildSpaceInstructions },
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

  function buildPrompt(mode: Mode, arm: Arm) {
    const base =
      mode === 'quick' ? getQuickModePrompt() : getAdaptiveModePrompt()
    if (!base.includes(LANGUAGE_RULE)) {
      throw new Error('Language rule not found in prompt')
    }
    const prompt =
      arm === 'control' ? base.replace(LANGUAGE_RULE, OLD_LANGUAGE_RULE) : base
    const space =
      arm === 'english-space' ? buildSpaceInstructions(ENGLISH_SPACE) : ''
    return `${prompt}${space ? `\n\n${space}` : ''}\nCurrent date: ${currentDate}`
  }

  type Job = { mode: Mode; arm: Arm; query: string; fixture: string }
  const jobs: Job[] = []
  for (const mode of args.modes) {
    for (const arm of args.arms) {
      for (const item of ITEMS) {
        for (let t = 0; t < args.trials; t++) jobs.push({ mode, arm, ...item })
      }
    }
  }

  const tasks = new Map<string, ReturnType<typeof runAnswerTask>>()
  function taskFor(mode: Mode, arm: Arm) {
    const key = `${mode}:${arm}`
    let task = tasks.get(key)
    if (!task) {
      const config = mode === 'quick' ? quick : adaptive
      const prompt = buildPrompt(mode, arm)
      task = runAnswerTask({
        model: config.DEFAULT_MODEL,
        providerOptions: config.DEFAULT_PROVIDER_OPTIONS,
        tracingEnabled: false,
        retries: 2,
        maxSteps: 20,
        getPrompt: () => prompt,
        includeTodoWrite: mode === 'adaptive',
        telemetryFunctionId: 'eval-space-language'
      })
      tasks.set(key, task)
    }
    return task
  }

  const results: { job: Job; language: string; error?: string }[] = []
  let cursor = 0
  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor++]
      try {
        const output = await taskFor(
          job.mode,
          job.arm
        )({ input: { query: job.query, results: fixtures[job.fixture] } })
        results.push({ job, language: classifyLanguage(output.text) })
      } catch (error) {
        results.push({
          job,
          language: 'error',
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }
  }
  await Promise.all(Array.from({ length: args.concurrency }, worker))

  console.log('\nmode      arm             ja  en  mixed  error  total')
  for (const mode of args.modes) {
    for (const arm of args.arms) {
      const rows = results.filter(r => r.job.mode === mode && r.job.arm === arm)
      const count = (language: string) =>
        rows.filter(r => r.language === language).length
      console.log(
        `${mode.padEnd(9)} ${arm.padEnd(15)} ${String(count('ja')).padStart(2)}  ${String(count('en')).padStart(2)}  ${String(count('mixed')).padStart(5)}  ${String(count('error')).padStart(5)}  ${String(rows.length).padStart(5)}`
      )
    }
  }
  for (const failed of results.filter(r => r.error)) {
    console.log(`error ${failed.job.mode}/${failed.job.arm}: ${failed.error}`)
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
