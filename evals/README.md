# Evals

Measured checks on model behaviour, kept separate from `__tests__` because they
call real models, cost money, and produce rates rather than pass/fail.

## Layers

| Layer                | Where                 | Runs                                         | Needs keys |
| -------------------- | --------------------- | -------------------------------------------- | ---------- |
| Evaluator unit tests | `evals/lib/__tests__` | every PR, via `bun run test`                 | no         |
| Experiments          | `evals/run-*.ts`      | nightly, manual, and on prompt/model changes | yes        |

The first layer exists because an evaluator is code too. `analyzeRelatedQuestions`
is tested against recorded spec blocks so a broken evaluator cannot quietly
report a healthy rate. Those tests are part of the normal suite and run on fork
PRs, where secrets are unavailable.

## related-questions

```bash
bun run eval:related-questions                              # deployed adaptive model, 1 trial per item
bun run eval:related-questions -- --trials 3                # 3 generations per item
bun run eval:related-questions -- --model openai:some-model # candidate model
bun run eval:related-questions -- --items fuji-routes       # one item, for debugging
bun run eval:related-questions -- --help
```

Answers 22 fixed queries (10 substantive, 12 trivial) against pinned search
results and reports:

- `emissionRate`: substantive answers that carried a related questions block
- `falsePositiveRate`: trivial answers that carried one anyway
- `wellFormedRate`: emitted blocks that satisfy the spec contract (one block,
  three buttons, `submitQuery`, button text identical to the query)

Emission and well-formedness are separate metrics on purpose. A model that stops
emitting and a model that emits a broken block are different failures with
different fixes.

### Why it is built this way

- **Search results are fixed.** Live search would put retrieval variance into a
  measurement about the prompt and the model.
- **The task mirrors production.** Same prompt builder, same `providerOptions`
  from `config/models/cloud.json`, same `toModelOutput` trimming. Reasoning
  effort has moved emission rates before, so a run without provider options
  would measure something the product does not do.
- **`BRAVE_SEARCH_API_KEY` is pinned by the runner.** The adaptive prompt
  branches on whether a general search provider is configured, so an unset key
  would silently evaluate a different prompt. No request reaches Brave; the
  search tool is a fixture.
- **Each trial is its own item.** Emission is probabilistic, so one generation
  per query measures almost nothing. `--trials` repeats each query while keeping
  one item equal to one generation in Langfuse.

### What counts as trivial

An item is `trivial` only when the fixture holds exactly one unambiguous value
answering it and no comparison or procedure is implied. "How tall is Mount
Fuji" qualifies. "What is the typical energy density of an LFP pack" does not,
because the fixture puts LFP and NMC side by side and the answer naturally
becomes a comparison.

The distinction matters because the label is set by the shape of the question
while the model decides by the shape of its own answer. A loosely trivial
question draws out a structured answer, and the block that follows it is
arguably correct, which inflates `falsePositiveRate` with disagreement rather
than defects. Questions whose answers expand belong in the substantive set.

## Thresholds

`thresholds.json` gates CI. A `null` value means the metric is reported but not
enforced, which is the state a new metric starts in.

`minSamples` is the smallest denominator a threshold may be enforced on, and the
sampled rates set it at 50, which the nightly five trials reach and a local run
does not. That is not caution for its own sake: identical code measured 1.000
and 0.833 on `emissionRate` across two runs of thirty substantive samples, so a
three-trial run cannot carry a ceiling or a floor. `completionRate` declares no minimum because it counts items
that actually failed rather than sampling a probability.

`completionRate` guards the measurement itself: the experiment runner drops an
item whose task threw, which shrinks the denominator of every other rate. A run
that lost more than a tenth of its items is not a valid measurement.

Rates are read at the run level, never per item. At three trials an individual
query swings by a third from one run to the next, so a single query moving is
noise; raise `--trials` before drawing a conclusion about one of them.

**Set a baseline before enforcing anything.** Run the eval a few times on the
current production model, then commit the numbers. Committing them rather than
comparing against the previous Langfuse run is deliberate: a threshold that gets
loosened should appear in a diff with an author and a reason.

A violation throws `RegressionError`, which the Langfuse experiment GitHub
Action reads to fail the job.

## Datasets

`evals/datasets/*.json` holds hand-written, synthetic data. It is committed, so
a prompt change and the data it is measured against show up in the same review.

Anything derived from production traces (thumbs-down turns, errored turns) must
**not** be committed here. This repository is public. Put that data in a Langfuse
managed dataset and fetch it at run time:

```ts
const dataset = await langfuse.dataset.get('morphic-thumbs-down-regression')
```

`experiment.run` accepts local items and Langfuse dataset items interchangeably,
so the task and the evaluators do not change when the source does.

## Credentials

`LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL`, plus the API
key for the provider under test. The runner loads `.env.local`.

Keys are required: the experiment runner uploads item scores through the
Langfuse client whether or not spans are exported, so a keyless run fails
partway rather than degrading to a local-only run. The CI job skips itself with
a warning when they are absent, so a repository without them does not collect a
red mark on every PR that touches `evals/`.

Experiment traces are tagged by the SDK with the `sdk-experiment` environment,
so they can be excluded from production metrics without a separate project.

## Known quirk

When items are skipped, the `Input` and `Expected` lines in the printed item
list are misaligned: the Langfuse formatter pairs `itemResults[i]` with
`originalData[i]` after the failed entries have been filtered out. The scores,
the outputs, and the trace links are unaffected, because each result carries its
own item. The runner prints a warning whenever this applies.
