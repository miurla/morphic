#!/usr/bin/env bun
/**
 * Measure how often a deployed search mode configuration presents found items
 * as SourceCards, and how often it uses them where it should not.
 *
 *   bun run eval:source-cards
 *   bun run eval:source-cards -- --mode quick --trials 3
 *
 * See evals/README.md for what this measures and why.
 */
import { config as dotenvConfig } from 'dotenv'

dotenvConfig({ path: '.env.local' })

// The search mode prompts branch on whether a general search provider is
// configured, so an unset key would silently measure a different prompt than
// the deployed one. Pinned before anything reads it. The fixture search tool
// means no request ever reaches Brave.
process.env.BRAVE_SEARCH_API_KEY ||= 'eval-pinned-general-provider'

type Mode = 'quick' | 'adaptive'

type Args = {
  model?: string
  mode: Mode
  trials: number
  concurrency: number
  runName?: string
  gate: boolean
  ids?: string[]
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    trials: 1,
    concurrency: 5,
    gate: true,
    mode: 'adaptive'
  }

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
      case '--mode': {
        const mode = next()
        if (mode !== 'quick' && mode !== 'adaptive') {
          throw new Error('--mode must be quick or adaptive')
        }
        args.mode = mode
        break
      }
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
      case '--no-gate':
        args.gate = false
        break
      case '--help':
        console.log(
          [
            'Usage: bun run eval:source-cards [options]',
            '',
            '  --mode <quick|adaptive>  search mode to evaluate (default: adaptive)',
            '  --model <id>             provider:model to evaluate (default: the selected mode model)',
            '  --trials <n>             generations per dataset item (default: 1)',
            '  --concurrency <n>        parallel generations (default: 5)',
            '  --run-name <name>        exact Langfuse run name (default: name + timestamp)',
            '  --items <a,b>            run only these dataset item ids',
            '  --no-gate                report metrics without failing on threshold violations'
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
  const { LangfuseClient } = await import('@langfuse/client')
  const { loadSourceCardsDataset, sourceCardsDatasetDescription } =
    await import('./lib/source-cards')
  const { applyGate } = await import('./lib/gate')
  type Threshold = import('./lib/gate').Threshold
  const { setupTracing } = await import('./lib/otel')
  const {
    sourceCardsEvaluator,
    sourceCardsRunEvaluator,
    summarizeSourceCards
  } = await import('./evaluators/source-cards')
  const adaptiveTask = await import('./tasks/adaptive-answer')
  const quickTask = await import('./tasks/quick-answer')
  const thresholds = (await import('./thresholds.json')).default

  const taskConfig =
    args.mode === 'quick'
      ? {
          createTask: quickTask.createQuickAnswerTask,
          defaultModel: quickTask.DEFAULT_MODEL
        }
      : {
          createTask: adaptiveTask.createAdaptiveAnswerTask,
          defaultModel: adaptiveTask.DEFAULT_MODEL
        }
  const model = args.model ?? taskConfig.defaultModel
  const data = loadSourceCardsDataset({ trials: args.trials, ids: args.ids })
  const tracing = setupTracing()

  console.log(`mode:        ${args.mode}`)
  console.log(`model:       ${model}`)
  console.log(`items:       ${data.length} (${args.trials} trial(s) per query)`)
  console.log(`concurrency: ${args.concurrency}\n`)

  const langfuse = new LangfuseClient()

  const result = await langfuse.experiment.run({
    name: 'source-cards',
    runName: args.runName,
    description: sourceCardsDatasetDescription,
    metadata: { mode: args.mode, model, trials: args.trials },
    data,
    task: taskConfig.createTask({ model, tracingEnabled: true }),
    evaluators: [sourceCardsEvaluator],
    runEvaluators: [sourceCardsRunEvaluator],
    maxConcurrency: args.concurrency
  })

  console.log(await result.format({ includeItemResults: true }))

  const completionRate = result.itemResults.length / data.length
  const summary = summarizeSourceCards(result.itemResults)
  console.log('\nsummary:', JSON.stringify(summary, null, 2))

  const config = thresholds['source-cards'] as Record<string, Threshold>

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
          metric: 'emissionRate',
          value: summary.emissionRate,
          samples: summary.listingCount,
          threshold: config.emissionRate
        },
        {
          metric: 'misuseRate',
          value: summary.misuseRate,
          samples: summary.otherCount,
          threshold: config.misuseRate
        },
        {
          metric: 'wellFormedRate',
          value: summary.wellFormedRate,
          samples: summary.emittedCount,
          threshold: config.wellFormedRate
        },
        {
          metric: 'groundedRate',
          value: summary.groundedRate,
          samples: summary.cardCount,
          threshold: config.groundedRate
        },
        {
          metric: 'misattributedRate',
          value: summary.misattributedRate,
          samples: summary.cardCount,
          threshold: config.misattributedRate
        },
        {
          metric: 'roundupMisuseRate',
          value: summary.roundupMisuseRate,
          samples: summary.roundupCount,
          threshold: config.roundupMisuseRate
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
