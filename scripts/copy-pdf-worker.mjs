import { copyFile, mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const source = require.resolve('pdfjs-dist/build/pdf.worker.min.mjs')
const destination = resolve('public/pdf.worker.min.mjs')
await mkdir(dirname(destination), { recursive: true })
await copyFile(source, destination)
