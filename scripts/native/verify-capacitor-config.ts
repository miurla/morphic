/**
 * Verifies capacitor.config.ts meets production safety invariants.
 *
 * Run: bun run cap:verify
 *
 * Checks:
 * - capacitor.config.ts exists and exports a valid config
 * - loggingBehavior is 'none'
 * - server.cleartext is false
 * - server.url is HTTPS
 * - webDir exists on disk
 * - No .env files in native directories
 */

import { existsSync, readdirSync } from 'fs'
import { resolve } from 'path'

const ROOT = resolve(import.meta.dir, '../../')

interface VerifyResult {
  pass: boolean
  label: string
  detail?: string
}

const results: VerifyResult[] = []

function check(label: string, pass: boolean, detail?: string) {
  results.push({ pass, label, detail })
}

// 1. Import and validate capacitor config
let config: any
try {
  const configModule = await import(resolve(ROOT, 'capacitor.config.ts'))
  config = configModule.default
  check('capacitor.config.ts exports a config', Boolean(config))
} catch (err: any) {
  check('capacitor.config.ts is importable', false, err.message)
}

if (config) {
  // 2. loggingBehavior
  check(
    'loggingBehavior is "none"',
    config.loggingBehavior === 'none',
    `got: ${JSON.stringify(config.loggingBehavior)}`
  )

  // 3. server.cleartext
  check(
    'server.cleartext is false',
    config.server?.cleartext === false,
    `got: ${JSON.stringify(config.server?.cleartext)}`
  )

  // 4. server.url is HTTPS
  const serverUrl: string = config.server?.url ?? ''
  check(
    'server.url uses HTTPS',
    serverUrl.startsWith('https://'),
    `got: ${JSON.stringify(serverUrl)}`
  )

  // 5. webDir exists
  const webDirPath = resolve(ROOT, config.webDir ?? '')
  check(
    `webDir ("${config.webDir}") exists on disk`,
    existsSync(webDirPath),
    `path: ${webDirPath}`
  )
}

// 6. No .env files in native directories
const nativeDirs = ['ios', 'android', '.capacitor']
for (const dir of nativeDirs) {
  const dirPath = resolve(ROOT, dir)
  if (existsSync(dirPath)) {
    try {
      const files = readdirSync(dirPath, { recursive: true }) as string[]
      const envFiles = files.filter(
        f =>
          typeof f === 'string' && (f.endsWith('.env') || f.includes('.env.'))
      )
      check(
        `No .env files in ${dir}/`,
        envFiles.length === 0,
        envFiles.length > 0 ? `found: ${envFiles.join(', ')}` : undefined
      )
    } catch {
      // Directory might not be readable; skip silently
    }
  }
}

// Report
console.log('\n  Capacitor Config Verification\n')

let failed = 0
for (const r of results) {
  const icon = r.pass ? '✓' : '✗'
  const color = r.pass ? '\x1b[32m' : '\x1b[31m'
  const reset = '\x1b[0m'
  console.log(
    `  ${color}${icon}${reset} ${r.label}${r.detail && !r.pass ? ` — ${r.detail}` : ''}`
  )
  if (!r.pass) failed++
}

console.log('')

if (failed > 0) {
  console.error(`  ${failed} check(s) failed. See docs/NATIVE_SAFETY.md.\n`)
  process.exit(1)
} else {
  console.log('  All checks passed.\n')
}
