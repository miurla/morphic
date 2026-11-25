import { JSDOM } from 'jsdom'
import { fromBuffer } from 'yauzl'

import { getTutorDocumentFormat } from './document-formats'
import { TutorError } from './errors'
import { MAX_PDF_TEXT_CHARACTERS, parsePdf } from './pdf'
import type { ParsedPdf, ParsedPdfBlock } from './types'

const MAX_DOCX_XML_BYTES = 8 * 1024 * 1024
const WORD_NAMESPACE =
  'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const STRICT_WORD_NAMESPACE = 'http://purl.oclc.org/ooxml/wordprocessingml/main'
const SEGMENT_CHARACTERS = 10_000

function invalidDocx() {
  return new TutorError(
    'The file is not a valid DOCX document.',
    'INVALID_DOCX'
  )
}

/** Read only the main XML and its content-type declaration, with bounded inflation. */
function readDocxXml(bytes: Uint8Array): Promise<Map<string, string>> {
  return new Promise((resolve, reject) => {
    fromBuffer(Buffer.from(bytes), { lazyEntries: true }, (error, zip) => {
      if (error || !zip) {
        reject(invalidDocx())
        return
      }
      const files = new Map<string, string>()
      let entries = 0
      let totalSize = 0
      let finished = false
      const fail = () => {
        if (finished) return
        finished = true
        zip.close()
        reject(invalidDocx())
      }
      zip.on('error', fail)
      zip.on('entry', entry => {
        entries++
        totalSize += entry.uncompressedSize
        if (
          entries > 2000 ||
          totalSize > 64 * 1024 * 1024 ||
          entry.generalPurposeBitFlag & 1
        ) {
          fail()
          return
        }
        const limit =
          entry.fileName === 'word/document.xml'
            ? MAX_DOCX_XML_BYTES
            : entry.fileName === '[Content_Types].xml'
              ? 64 * 1024
              : 0
        if (!limit) {
          zip.readEntry()
          return
        }
        if (entry.uncompressedSize > limit || files.has(entry.fileName)) {
          fail()
          return
        }
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) {
            fail()
            return
          }
          const chunks: Buffer[] = []
          let size = 0
          stream.on('error', fail)
          stream.on('data', (chunk: Buffer) => {
            size += chunk.length
            if (size > limit) {
              stream.destroy()
              fail()
            } else chunks.push(chunk)
          })
          stream.on('end', () => {
            if (finished) return
            try {
              files.set(
                entry.fileName,
                decodeDocumentText(Buffer.concat(chunks))
              )
              zip.readEntry()
            } catch {
              fail()
            }
          })
        })
      })
      zip.on('end', () => {
        if (finished) return
        if (
          !files.has('word/document.xml') ||
          !files.has('[Content_Types].xml')
        ) {
          fail()
          return
        }
        finished = true
        resolve(files)
      })
      zip.readEntry()
    })
  })
}

export function decodeDocumentText(bytes: Uint8Array): string {
  try {
    const encoding =
      bytes[0] === 0xff && bytes[1] === 0xfe
        ? 'utf-16le'
        : bytes[0] === 0xfe && bytes[1] === 0xff
          ? 'utf-16be'
          : 'utf-8'
    const text = new TextDecoder(encoding, { fatal: true }).decode(bytes)
    // Reject binary files renamed to .txt/.md, including NUL and escape controls.
    if (/[\u0000-\u0008\u000b\u000e-\u001f\u007f]/.test(text))
      throw new Error('Binary content')
    return text.replace(/\r\n?/g, '\n')
  } catch {
    throw new TutorError(
      'The document is not readable text. Save it as UTF-8 or UTF-16 and try again.',
      'INVALID_TEXT'
    )
  }
}

type TextBlock = { text: string; heading?: boolean }

async function extractDocx(bytes: Uint8Array): Promise<TextBlock[]> {
  const files = await readDocxXml(bytes)
  const dom = new JSDOM('')
  try {
    const parser = new dom.window.DOMParser()
    const parseXml = (xml: string) => {
      // Office documents do not need DTDs or entities. Do not resolve any.
      if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw invalidDocx()
      const document = parser.parseFromString(xml, 'application/xml')
      if (document.getElementsByTagName('parsererror').length)
        throw invalidDocx()
      return document
    }
    const types = parseXml(files.get('[Content_Types].xml')!)
    const mainType = Array.from(
      types.getElementsByTagNameNS('*', 'Override')
    ).find(element => element.getAttribute('PartName') === '/word/document.xml')
    if (
      mainType?.getAttribute('ContentType') !==
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml'
    )
      throw invalidDocx()
    const document = parseXml(files.get('word/document.xml')!)
    const namespace = document.documentElement.namespaceURI
    if (
      document.documentElement.localName !== 'document' ||
      (namespace !== WORD_NAMESPACE && namespace !== STRICT_WORD_NAMESPACE)
    )
      throw invalidDocx()
    const body = document.getElementsByTagNameNS(namespace, 'body')[0]
    if (!body) throw invalidDocx()
    // Paragraphs inside table cells stay in reading order. Only w:t runs are
    // extracted; field instructions, scripts, and external resources are ignored.
    return Array.from(body.getElementsByTagNameNS(namespace, 'p')).map(
      paragraph => {
        const runs = Array.from(
          paragraph.getElementsByTagNameNS(namespace, '*')
        )
        const text = runs
          .filter(run => {
            // Text boxes may contain nested paragraphs. Each run belongs only to
            // its nearest paragraph, otherwise a nested paragraph is read twice.
            let owner = run.parentElement
            while (
              owner &&
              !(owner.namespaceURI === namespace && owner.localName === 'p')
            )
              owner = owner.parentElement
            if (owner !== paragraph) return false
            for (
              let parent = run.parentElement;
              parent;
              parent = parent.parentElement
            ) {
              if (
                parent.namespaceURI === namespace &&
                parent.localName === 'del'
              )
                return false
            }
            return true
          })
          .map(run => {
            if (run.localName === 't') return run.textContent ?? ''
            if (run.localName === 'tab') return '\t'
            if (run.localName === 'br' || run.localName === 'cr') return '\n'
            return ''
          })
          .join('')
          .trim()
        const style = paragraph.getElementsByTagNameNS(namespace, 'pStyle')[0]
        return {
          text,
          heading: /^(Heading[1-6]|Title|Subtitle)$/i.test(
            style?.getAttributeNS(namespace, 'val') ?? ''
          )
        }
      }
    )
  } catch (error) {
    if (error instanceof TutorError) throw error
    throw invalidDocx()
  } finally {
    dom.window.close()
  }
}

/** Non-PDF regions identify logical text segments, never physical page positions. */
function textBlocksToDocument(blocks: TextBlock[]): ParsedPdf {
  const content = blocks.filter(block => block.text.trim())
  if (!content.length)
    throw new TutorError(
      'No readable text was found in this document.',
      'NO_TEXT'
    )
  if (
    content.reduce((sum, block) => sum + block.text.length, 0) >
    MAX_PDF_TEXT_CHARACTERS
  )
    throw new TutorError(
      'This document contains too much text. Split it into smaller files.',
      'DOCUMENT_TEXT_LIMIT'
    )
  const parsed: ParsedPdfBlock[] = []
  let segment = 1
  let size = 0
  for (const block of content) {
    // Keep paragraphs intact where possible; avoid splitting surrogate pairs.
    const characters = Array.from(block.text)
    for (
      let offset = 0;
      offset < characters.length;
      offset += SEGMENT_CHARACTERS
    ) {
      const text = characters
        .slice(offset, offset + SEGMENT_CHARACTERS)
        .join('')
      if (size && size + text.length > SEGMENT_CHARACTERS) {
        segment++
        size = 0
      }
      parsed.push({
        text,
        heading: block.heading && offset === 0,
        region: { page: segment, x: 0, y: 0, width: 1, height: 1 }
      })
      size += text.length
    }
  }
  return { pageCount: segment, blocks: parsed, warnings: [] }
}

export async function parseTutorDocument(
  bytes: Uint8Array,
  filename: string
): Promise<ParsedPdf> {
  const format = getTutorDocumentFormat(filename)
  if (format === 'pdf') return parsePdf(bytes)
  if (format === 'docx') return textBlocksToDocument(await extractDocx(bytes))
  if (format === 'txt' || format === 'md') {
    const text = decodeDocumentText(bytes)
    const blocks: TextBlock[] = []
    let paragraph: string[] = []
    const flush = () => {
      if (paragraph.length) blocks.push({ text: paragraph.join('\n').trim() })
      paragraph = []
    }
    for (const line of text.split('\n')) {
      if (format === 'md' && /^#{1,6}\s+\S/.test(line)) {
        flush()
        blocks.push({ text: line.trim(), heading: true })
      } else if (!line.trim()) flush()
      else paragraph.push(line)
    }
    flush()
    return textBlocksToDocument(blocks)
  }
  throw new TutorError(
    'Upload a PDF, TXT, Markdown, or DOCX document.',
    'UNSUPPORTED_FILE_TYPE'
  )
}
