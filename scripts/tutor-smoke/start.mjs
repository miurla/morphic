/** Explicitly isolated local smoke services. Never loads application .env itself. */
import { spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { startTestProvider } from './provider.mjs'

if (!process.argv.includes('--isolated-local'))
  throw new Error(
    'Pass --isolated-local to acknowledge the fixed local test services.'
  )
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
process.chdir(root)
// We invoke Next directly, so run the same asset preparation as npm/bun dev.
await import('../copy-pdf-worker.mjs')
const output = path.join(root, '.tmp/tutor-smoke')
await mkdir(output, { recursive: true })
const environment = { ...process.env }
// An existing developer .env must not route smoke traffic to paid/production services.
for (const key of [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'AI_GATEWAY_API_KEY',
  'OLLAMA_BASE_URL',
  'TAVILY_API_KEY',
  'EXA_API_KEY',
  'BRAVE_SEARCH_API_KEY',
  'LANGFUSE_PUBLIC_KEY',
  'LANGFUSE_SECRET_KEY',
  'NEXT_PUBLIC_POSTHOG_KEY',
  'NEXT_PUBLIC_POSTHOG_HOST',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_ENDPOINT',
  'R2_ACCOUNT_ID',
  'S3_ENDPOINT',
  'R2_BUCKET_NAME',
  'TUTOR_RERANK_API_KEY',
  'TUTOR_RERANK_BASE_URL',
  'TUTOR_RERANK_MODEL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN'
])
  environment[key] = ''
Object.assign(environment, {
  AUTH_PROVIDER: 'none',
  ENABLE_AUTH: 'false',
  ANONYMOUS_USER_ID: 'tutor-smoke-user',
  DATABASE_URL:
    'postgres://tutor_test:tutor_test_local@127.0.0.1:15433/tutor_test',
  DATABASE_RESTRICTED_URL:
    'postgres://tutor_test:tutor_test_local@127.0.0.1:15433/tutor_test',
  DATABASE_SSL_DISABLED: 'true',
  TUTOR_MODEL: 'openai-compatible:tutor-smoke',
  OPENAI_COMPATIBLE_MODELS: 'tutor-smoke',
  OPENAI_COMPATIBLE_API_KEY: 'smoke-only',
  OPENAI_COMPATIBLE_API_BASE_URL: 'http://127.0.0.1:3106/v1',
  TUTOR_EMBEDDING_API_KEY: 'smoke-only',
  TUTOR_EMBEDDING_AUTH: 'bearer',
  TUTOR_EMBEDDING_BASE_URL: 'http://127.0.0.1:3106/v1',
  TUTOR_EMBEDDING_MODEL: 'tutor-smoke-embedding',
  TUTOR_EMBEDDING_DIMENSIONS: '1536',
  TUTOR_EMBEDDING_SEND_DIMENSIONS: 'true',
  TUTOR_REDIS_URL: 'redis://127.0.0.1:16380',
  LOCAL_REDIS_URL: 'redis://127.0.0.1:16380',
  REDIS_URL: 'redis://127.0.0.1:16380',
  TUTOR_RERANK_ENABLED: 'false',
  TUTOR_RETRIEVAL_MODE: 'hybrid',
  TUTOR_STORAGE_DRIVER: 'local',
  TUTOR_LOCAL_STORAGE_DIR: '.tmp/tutor-smoke-files',
  MORPHIC_CLOUD_DEPLOYMENT: 'false',
  ENABLE_LANGFUSE_TRACING: 'false',
  NEXT_TELEMETRY_DISABLED: '1',
  NODE_ENV: 'development'
})
const provider = await startTestProvider()
const children = []
for (const [name, args] of [
  ['worker', ['node_modules/tsx/dist/cli.mjs', 'scripts/tutor-worker.ts']],
  [
    'next',
    [
      'node_modules/next/dist/bin/next',
      'dev',
      '--hostname',
      '127.0.0.1',
      '--port',
      '3002'
    ]
  ]
]) {
  const log = createWriteStream(path.join(output, `${name}.log`), {
    flags: 'w'
  })
  const child = spawn(process.execPath, args, {
    cwd: root,
    env: environment,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  child.stdout.pipe(log)
  child.stderr.pipe(log)
  child.once('exit', code =>
    console.log(`[Tutor smoke] ${name} exited (${code})`)
  )
  children.push(child)
}
await writeFile(
  path.join(output, 'processes.json'),
  JSON.stringify(
    {
      supervisor: process.pid,
      children: children.map(child => child.pid),
      startedAt: new Date().toISOString()
    },
    null,
    2
  )
)
console.log(
  '[Tutor smoke] Started isolated Next :3002 + worker; logs in .tmp/tutor-smoke. Ctrl+C stops these child services.'
)
let stopping = false
async function stop() {
  if (stopping) return
  stopping = true
  for (const child of children) {
    if (process.platform === 'win32')
      spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
        windowsHide: true,
        stdio: 'ignore'
      })
    else child.kill('SIGTERM')
  }
  provider.close()
  setTimeout(() => process.exit(0), 1500)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
