import * as dotenv from 'dotenv'
import postgres from 'postgres'

import 'dotenv/config'

if (!process.env.DATABASE_URL) {
  dotenv.config({ path: '.env.local' })
}

type BackfillTarget = {
  id: string
  url: string
}

const args = new Set(process.argv.slice(2))
const apply = args.has('--apply')
const allowSkipped = args.has('--allow-skipped')
const explicitBaseUrl = process.argv
  .slice(2)
  .find(arg => arg.startsWith('--base-url='))
  ?.slice('--base-url='.length)
const baseUrls = [
  explicitBaseUrl,
  process.env.R2_PUBLIC_URL,
  process.env.LEGACY_R2_PUBLIC_URL
]
  .filter((value): value is string => Boolean(value))
  .map(value => value.replace(/\/+$/, ''))

if (baseUrls.length === 0) {
  console.error(
    'Set R2_PUBLIC_URL, LEGACY_R2_PUBLIC_URL, or pass --base-url=https://...'
  )
  process.exit(1)
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

function keyFromUrl(url: string) {
  for (const baseUrl of baseUrls) {
    if (url === baseUrl) return null
    if (url.startsWith(`${baseUrl}/`)) {
      return decodeURIComponent(url.slice(baseUrl.length + 1))
    }
  }

  return null
}

async function tableExists(sql: postgres.Sql, tableName: string) {
  const [row] = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
    ) AS "exists"
  `

  return Boolean(row?.exists)
}

async function backfillParts(sql: postgres.Sql) {
  const rows = await sql<BackfillTarget[]>`
    SELECT id, file_url AS url
    FROM parts
    WHERE type = 'file'
      AND file_key IS NULL
      AND file_url IS NOT NULL
  `

  let converted = 0
  let skipped = 0

  for (const row of rows) {
    const key = keyFromUrl(row.url)
    if (!key) {
      skipped++
      continue
    }

    converted++
    if (apply) {
      await sql`
        UPDATE parts
        SET file_key = ${key}
        WHERE id = ${row.id}
          AND file_key IS NULL
      `
    }
  }

  return { total: rows.length, converted, skipped }
}

async function backfillFiles(sql: postgres.Sql) {
  if (!(await tableExists(sql, 'files'))) {
    return { total: 0, converted: 0, skipped: 0, missing: true }
  }

  const rows = await sql<BackfillTarget[]>`
    SELECT id, url
    FROM files
    WHERE object_key IS NULL
      AND url IS NOT NULL
  `

  let converted = 0
  let skipped = 0

  for (const row of rows) {
    const key = keyFromUrl(row.url)
    if (!key) {
      skipped++
      continue
    }

    converted++
    if (apply) {
      await sql`
        UPDATE files
        SET object_key = ${key}
        WHERE id = ${row.id}
          AND object_key IS NULL
      `
    }
  }

  return { total: rows.length, converted, skipped, missing: false }
}

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, {
    ssl:
      process.env.DATABASE_SSL_DISABLED === 'true'
        ? false
        : { rejectUnauthorized: false },
    prepare: false
  })

  try {
    const [partsResult, filesResult] = await Promise.all([
      backfillParts(sql),
      backfillFiles(sql)
    ])

    console.log(
      JSON.stringify(
        {
          mode: apply ? 'apply' : 'dry-run',
          baseUrls,
          parts: partsResult,
          files: filesResult
        },
        null,
        2
      )
    )

    if (!apply) {
      console.log('Re-run with --apply to update rows.')
    }

    const skipped = partsResult.skipped + filesResult.skipped
    if (apply && skipped > 0 && !allowSkipped) {
      throw new Error(
        `Backfill left ${skipped} URL(s) without object keys. Add the missing --base-url value and rerun, or pass --allow-skipped to accept unavailable legacy attachments.`
      )
    }
  } finally {
    await sql.end()
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
