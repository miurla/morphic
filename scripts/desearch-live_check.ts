import { DesearchSearchProvider } from '../lib/tools/search/providers/desearch'

async function live_check() {
  const result = await new DesearchSearchProvider().search('bittensor', 5)
  console.log(`Result count: ${result.number_of_results}`)
  console.log(`First title: ${result.results[0]?.title ?? ''}`)
}

live_check().catch(() => {
  process.exitCode = 1
})
