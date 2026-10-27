#!/usr/bin/env bun
/**
 * Measure whether the deployed configuration leaves a chat's draft alone when
 * the user asks for something else, and still changes it when asked to.
 *
 *   bun run eval:draft-edits
 *   bun run eval:draft-edits -- --trials 3
 *
 * See evals/README.md for what this measures and why.
 */
import { config as dotenvConfig } from 'dotenv'

dotenvConfig({ path: '.env.local' })

// See run-source-cards.ts: the mode prompts branch on this key.
process.env.BRAVE_SEARCH_API_KEY ||= 'eval-pinned-general-provider'

type Args = {
  model?: string
  trials: number
  concurrency: number
  runName?: string
  gate: boolean
  ids?: string[]
  synthetic: boolean
  out?: string
}

function parseArgs(argv: string[]): Args {
  const args: Args = { trials: 1, concurrency: 5, gate: true, synthetic: true }

  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]
    const next = () => {
      const value = argv[++i]
      if (value === undefined) throw new Error(`${flag} requires a value`)
      return value
    }

    switch (flag) {
      case '--model':
        args.model = next()
        break
      case '--trials':
        args.trials = Number(next())
        break
      case '--concurrency':
        args.concurrency = Number(next())
        break
      case '--run-name':
        args.runName = next()
        break
      case '--items':
        args.ids = next()
          .split(',')
          .map(id => id.trim())
          .filter(Boolean)
        break
      case '--no-synthetic':
        args.synthetic = false
        break
      case '--out':
        args.out = next()
        break
      case '--no-gate':
        args.gate = false
        break
      case '--help':
        console.log(
          [
            'Usage: bun run eval:draft-edits [options]',
            '',
            '  --model <id>          provider:model for every item (default: each item mode model)',
            '  --trials <n>          generations per dataset item (default: 1)',
            '  --concurrency <n>     parallel generations (default: 5)',
            '  --run-name <name>     exact Langfuse run name (default: name + timestamp)',
            '  --items <a,b>         run only these item ids',
            '  --no-synthetic        run only the local production seeds',
            '  --out <name>          write per-item results as JSON to evals/_local/<name>',
            '  --no-gate             report metrics without failing on threshold violations'
          ].join('\n')
        )
        process.exit(0)
        break
      default:
        throw new Error(`Unknown argument: ${flag}`)
    }
  }

  if (!Number.isFinite(args.trials) || args.trials < 1) {
    throw new Error('--trials must be a positive number')
  }
  if (!Number.isFinite(args.concurrency) || args.concurrency < 1) {
    throw new Error('--concurrency must be a positive number')
  }

  return args
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  // Imported after dotenv: the provider registry reads API keys at module load.
  const { mkdirSync, writeFileSync } = await import('fs')
  const path = await import('path')
  const { LangfuseClient } = await import('@langfuse/client')
  const {
    analyzeDraftTurn,
    draftEditsDatasetDescription,
    LOCAL_SEEDS_PATH,
    loadDraftEditsDataset
  } = await import('./lib/draft-edits')
  const { applyGate } = await import('./lib/gate')
  type Threshold = import('./lib/gate').Threshold
  const { setupTracing } = await import('./lib/otel')
  const { draftEditsEvaluator, draftEditsRunEvaluator, summarizeDraftEdits } =
    await import('./evaluators/draft-edits')
  const { createDraftTurnTask, DEFAULT_MODEL } = await import(
    './tasks/draft-turn'
  )
  const thresholds = (await import('./thresholds.json')).default

  // Outputs can quote production drafts, so they only go to the gitignored
  // folder that holds the seeds.
  const outPath =
    args.out &&
    path.join(path.dirname(LOCAL_SEEDS_PATH), path.basename(args.out))
  if (outPath === LOCAL_SEEDS_PATH) {
    throw new Error('--out must not overwrite the production seeds')
  }

  const data = loadDraftEditsDataset({
    trials: args.trials,
    ids: args.ids,
    includeSynthetic: args.synthetic
  })
  const production = data.filter(item => item.metadata.source === 'production')
  const tracing = setupTracing()

  console.log(`model:       ${args.model ?? DEFAULT_MODEL}`)
  console.log(`items:       ${data.length} (${args.trials} trial(s) per turn)`)
  console.log(
    `production:  ${production.length} ${production.length === 0 ? `(no seeds at ${LOCAL_SEEDS_PATH})` : ''}`
  )
  console.log(`concurrency: ${args.concurrency}\n`)

  const langfuse = new LangfuseClient()

  const result = await langfuse.experiment.run({
    name: 'draft-edits',
    runName: args.runName,
    description: draftEditsDatasetDescription,
    metadata: { model: args.model ?? 'per-mode', trials: args.trials },
    data,
    task: createDraftTurnTask({ model: args.model, tracingEnabled: true }),
    evaluators: [draftEditsEvaluator],
    runEvaluators: [draftEditsRunEvaluator],
    maxConcurrency: args.concurrency
  })

  // Item outputs can quote production drafts, so only ids and verdicts print.
  for (const itemResult of result.itemResults) {
    const metadata = itemResult.item.metadata as {
      itemId: string
      category: 'unrelated' | 'new' | 'edit'
      trial: number
    }
    const analysis = analyzeDraftTurn(
      itemResult.output as never,
      metadata.category
    )
    console.log(
      `${analysis.correct ? 'ok  ' : 'FAIL'} ${metadata.category.padEnd(9)} ${metadata.itemId}#${metadata.trial} edit=${analysis.calledEdit} block=${analysis.wroteBlock}`
    )
  }

  if (outPath) {
    mkdirSync(path.dirname(outPath), { recursive: true })
    writeFileSync(
      outPath,
      JSON.stringify(
        result.itemResults.map(itemResult => ({
          metadata: itemResult.item.metadata,
          output: itemResult.output
        })),
        null,
        1
      )
    )
  }

  const completionRate = result.itemResults.length / data.length
  const summary = summarizeDraftEdits(result.itemResults)
  console.log('\ncompletionRate:', completionRate.toFixed(3))
  console.log('summary:', JSON.stringify(summary, null, 2))

  const config = thresholds['draft-edits'] as Record<string, Threshold>

  try {
    if (args.gate) {
      applyGate(result, [
        {
          metric: 'completionRate',
          value: completionRate,
          samples: data.length,
          threshold: config.completionRate
        },
        {
          metric: 'hijackRate',
          value: summary.hijackRate,
          samples: summary.unrelatedCount,
          threshold: config.hijackRate
        },
        {
          metric: 'newBlockRate',
          value: summary.newBlockRate,
          samples: summary.newCount,
          threshold: config.newBlockRate
        },
        {
          metric: 'editSuccessRate',
          value: summary.editSuccessRate,
          samples: summary.editCount,
          threshold: config.editSuccessRate
        }
      ])
    }
  } finally {
    await tracing.flush()
    if (result.datasetRunUrl) console.log(`\n${result.datasetRunUrl}`)
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
