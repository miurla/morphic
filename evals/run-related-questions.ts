#!/usr/bin/env bun
/**
 * Measure the related questions emission rate of a deployed search mode
 * configuration against a fixed dataset.
 *
 *   bun run eval:related-questions
 *   bun run eval:related-questions -- --trials 3 --model openai:gpt-5.6-luna
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
            'Usage: bun run eval:related-questions [options]',
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
  const { datasetDescription, loadRelatedQuestionsDataset } = await import(
    './lib/dataset'
  )
  const { applyGate } = await import('./lib/gate')
  type Threshold = import('./lib/gate').Threshold
  const { setupTracing } = await import('./lib/otel')
  const {
    relatedQuestionsEvaluator,
    relatedQuestionsRunEvaluator,
    summarizeRelatedQuestions
  } = await import('./evaluators/related-questions')
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
  const data = loadRelatedQuestionsDataset({
    trials: args.trials,
    ids: args.ids
  })
  const tracing = setupTracing()

  console.log(`mode:        ${args.mode}`)
  console.log(`model:       ${model}`)
  console.log(`items:       ${data.length} (${args.trials} trial(s) per query)`)
  console.log(`concurrency: ${args.concurrency}\n`)

  const langfuse = new LangfuseClient()

  const result = await langfuse.experiment.run({
    name: 'related-questions',
    runName: args.runName,
    description: datasetDescription,
    metadata: { mode: args.mode, model, trials: args.trials },
    data,
    task: taskConfig.createTask({ model, tracingEnabled: true }),
    evaluators: [relatedQuestionsEvaluator],
    runEvaluators: [relatedQuestionsRunEvaluator],
    maxConcurrency: args.concurrency
  })

  console.log(await result.format({ includeItemResults: true }))

  // The runner drops an item whose task threw, which silently shrinks the
  // denominator of every rate below. A run that lost items is not a valid
  // measurement, so completion is gated like any other metric.
  const completionRate = result.itemResults.length / data.length
  if (result.itemResults.length < data.length) {
    console.log(
      `\n${data.length - result.itemResults.length} of ${data.length} item(s) failed and were skipped.`
    )
    console.log(
      'Note: with skipped items the "Input" and "Expected" lines printed above are misaligned (a Langfuse formatter bug). The scores and traces are correct.'
    )
  }

  const summary = summarizeRelatedQuestions(result.itemResults)
  const config = thresholds['related-questions'] as Record<string, Threshold>

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
          samples: summary.substantiveCount,
          threshold: config.emissionRate
        },
        {
          metric: 'falsePositiveRate',
          value: summary.falsePositiveRate,
          samples: summary.trivialCount,
          threshold: config.falsePositiveRate
        },
        {
          metric: 'wellFormedRate',
          value: summary.wellFormedRate,
          samples: summary.emittedCount,
          threshold: config.wellFormedRate
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
