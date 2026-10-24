/**
 * Drafts are written as a ````draft fenced block in the answer text and edited
 * with the editDraft tool. Four backticks let the content hold ordinary code
 * fences. The first line inside the block is "title: ...".
 *
 * Everything here is pure: the server rebuilds the current draft from history
 * on each turn, and the client rebuilds the same versions for the panel.
 */

const FENCE_OPEN = '````draft\n'
// Models sometimes open with three backticks; that block ends at the first
// bare fence, as markdown reads it.
const OPENER = /(?:^|\n)(`{3,4})draft[ \t]*\n/g
const FENCE_CLOSE = '\n````'
const TITLE_LINE = /^title:[ \t]*(.*)\n?/

export const EDIT_DRAFT_TOOL = 'editDraft'

export type DraftBlock = {
  title: string
  content: string
  /** False while the block is still streaming. */
  closed: boolean
}

export type DraftEdit = { find: string; replace: string }

export type DraftEditFailure = {
  find: string
  reason: 'not found' | 'not unique'
}

export type DraftVersion = {
  version: number
  title: string
  content: string
  kind: 'write' | 'edit'
  messageId: string
  /** Set on edit versions: how many edits applied and which failed. */
  applied?: number
  failed?: DraftEditFailure[]
  /** Set on a write whose block never closed because the answer stopped. */
  interrupted?: boolean
}

function parseBody(body: string): { title: string; content: string } {
  const title = TITLE_LINE.exec(body)
  if (!title) return { title: '', content: body }
  return {
    title: title[1].trim(),
    content: body.slice(title[0].length).replace(/^\n/, '')
  }
}

type BlockLocation = {
  open: number
  bodyStart: number
  bodyEnd: number
  /** Offset just past the closing fence, or the text length while open. */
  end: number
  closed: boolean
  ticks: number
}

const STRICT_CLOSE = /\n````[ \t]*(?=\n|$)/g
const FENCE_LINE = /^`{3,}/
const BARE_THREE = /^```[ \t]*$/
const SENTENCE = /^\p{L}.*[.?!。？！]$/u

/**
 * Whether a line can follow a draft close: nothing yet, a blank line, a
 * labeled block, or a sentence. Code right after a bare fence, which rarely
 * ends like a sentence, is an inner block's content.
 */
function followsLikeClose(line: string | undefined) {
  return (
    line === undefined ||
    !line.trim() ||
    (FENCE_LINE.test(line) && !BARE_THREE.test(line)) ||
    SENTENCE.test(line.trim())
  )
}

/** Whether text after a draft close opens no unlabeled fence, as answers do. */
function opensNoBareFence(lines: string[]) {
  let inFence = false
  for (const line of lines) {
    if (!FENCE_LINE.test(line)) continue
    if (inFence) {
      if (BARE_THREE.test(line)) inFence = false
    } else if (BARE_THREE.test(line)) {
      return false
    } else {
      inFence = true
    }
  }
  return true
}

/**
 * Where a block closes, searched only up to the next draft opener. Models
 * sometimes close a ````draft block with three backticks, which reads the same
 * as an unlabeled code fence opening inside the draft. A bare ``` line outside
 * any inner fence is taken as the close only when what follows it looks like
 * the rest of an answer: a blank line or a labeled block such as spec next,
 * and no unlabeled fence later, which the rest of an inner code block would
 * open.
 */
function findClose(text: string, bodyStart: number, ticks: number) {
  // A three-backtick block cannot hold fences, so it ends at the first bare
  // one; a ```draft line inside it is content, as markdown reads it.
  if (ticks === 3) {
    const bare = /(?:^|\n)`{3,}[ \t]*(?=\n|$)/g
    bare.lastIndex = bodyStart - 1
    const close = bare.exec(text)
    if (!close) return null
    return {
      bodyEnd: Math.max(bodyStart, close.index),
      end: close.index + close[0].length
    }
  }

  // Only a four-backtick opener starts the next draft. A ```draft fence inside
  // this one is an example in its content.
  const next = text.indexOf(`\n${FENCE_OPEN}`, bodyStart - 1)
  const limit = next < 0 ? text.length : next

  STRICT_CLOSE.lastIndex = bodyStart - 1
  const strict = STRICT_CLOSE.exec(text)
  if (strict && strict.index < limit) {
    return { bodyEnd: strict.index, end: strict.index + strict[0].length }
  }

  const lines = text.slice(bodyStart, limit).split('\n')
  let inFence = false
  let offset = bodyStart
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (FENCE_LINE.test(line)) {
      const bare = BARE_THREE.test(line)
      if (
        !inFence &&
        bare &&
        followsLikeClose(lines[i + 1]) &&
        opensNoBareFence(lines.slice(i + 1))
      ) {
        const bodyEnd = Math.max(bodyStart, offset - 1)
        return { bodyEnd, end: offset + line.length }
      }
      inFence = inFence ? !bare : true
    }
    offset += line.length + 1
  }
  return null
}

function locateDraftBlocks(text: string): BlockLocation[] {
  const blocks: BlockLocation[] = []
  let from = 0
  while (true) {
    OPENER.lastIndex = from
    const opener = OPENER.exec(text)
    if (!opener) break
    const open = opener.index + (opener[0].startsWith('\n') ? 1 : 0)
    const bodyStart = opener.index + opener[0].length
    const close = findClose(text, bodyStart, opener[1].length)
    if (!close) {
      blocks.push({
        open,
        bodyStart,
        bodyEnd: text.length,
        end: text.length,
        closed: false,
        ticks: opener[1].length
      })
      break
    }
    blocks.push({
      open,
      bodyStart,
      ...close,
      closed: true,
      ticks: opener[1].length
    })
    from = close.end
  }
  return blocks
}

/** Every draft block in a text, in order. The last one may still be open. */
export function parseDraftBlocks(text: string): DraftBlock[] {
  return locateDraftBlocks(text).map(block => ({
    ...parseBody(text.slice(block.bodyStart, block.bodyEnd)),
    closed: block.closed
  }))
}

/**
 * Replace each draft block with what the callback returns. An unclosed block
 * runs to the end of the text; in history it is one an answer stopped inside.
 */
export function replaceDraftBlocks(
  text: string,
  replace: (draft: { title: string; content: string }) => string
): string {
  if (!text.includes('```draft')) return text
  let out = ''
  let from = 0
  for (const block of locateDraftBlocks(text)) {
    out +=
      text.slice(from, block.open) +
      replace(parseBody(text.slice(block.bodyStart, block.bodyEnd)))
    from = block.end
  }
  return out + text.slice(from)
}

/**
 * Rewrite a ````draft block closed with three backticks to close with four, so
 * markdown ends the fence where the draft ends and renders the rest of the
 * answer after it instead of inside the fence.
 */
export function normalizeDraftFences(text: string): string {
  if (!text.includes('````draft')) return text
  let out = ''
  let from = 0
  for (const block of locateDraftBlocks(text)) {
    if (!block.closed || block.ticks !== 4) continue
    if (text.startsWith(FENCE_CLOSE, block.bodyEnd)) continue
    out += text.slice(from, block.bodyEnd) + FENCE_CLOSE
    from = block.end
  }
  return out + text.slice(from)
}

/**
 * Parse the inside of a draft fence as a markdown code renderer receives it.
 * A block closed with three backticks reaches the renderer unclosed, with the
 * stray close and any text after it in the body, so it goes through the same
 * close detection as the rest of the text.
 */
export function parseDraftFenceBody(body: string): {
  title: string
  content: string
} {
  const [block] = parseDraftBlocks(FENCE_OPEN + body.replace(/\n$/, ''))
  return block
    ? { title: block.title, content: block.content }
    : parseBody(body)
}

/** The draft's own top-level heading, which edits keep current, else its title. */
export function draftDisplayTitle(draft: { title: string; content: string }) {
  const heading = /^#[ \t]+(.+)$/m.exec(draft.content)
  return heading?.[1].trim() || draft.title
}

/**
 * Apply edits in order. An edit whose find text is missing or appears more
 * than once is skipped and reported, so the server and the client, applying
 * the same edits to the same text, always reach the same result.
 */
export function applyDraftEdits(
  content: string,
  edits: DraftEdit[]
): { content: string; applied: number; failed: DraftEditFailure[] } {
  let out = content
  let applied = 0
  const failed: DraftEditFailure[] = []
  for (const edit of edits) {
    if (!edit.find) {
      failed.push({ find: edit.find, reason: 'not found' })
      continue
    }
    const first = out.indexOf(edit.find)
    if (first < 0) {
      failed.push({ find: edit.find, reason: 'not found' })
      continue
    }
    if (out.indexOf(edit.find, first + 1) >= 0) {
      failed.push({ find: edit.find, reason: 'not unique' })
      continue
    }
    out =
      out.slice(0, first) + edit.replace + out.slice(first + edit.find.length)
    applied++
  }
  return { content: out, applied, failed }
}

export type DraftChange = { title?: string; edits?: DraftEdit[] }

/**
 * Apply an editDraft call to a draft. A new title counts as one change; it is
 * for drafts without a top-level heading, whose title lives outside the text.
 */
export function applyDraftChange(
  draft: { title: string; content: string },
  change: DraftChange
): {
  title: string
  content: string
  applied: number
  failed: DraftEditFailure[]
} {
  const result = applyDraftEdits(
    draft.content,
    Array.isArray(change.edits) ? change.edits : []
  )
  const title = change.title?.trim()
  const renamed = Boolean(title) && title !== draft.title
  return {
    title: renamed ? title! : draft.title,
    content: result.content,
    applied: result.applied + (renamed ? 1 : 0),
    failed: result.failed
  }
}

/** The version later turns edit: the latest one whose block was completed. */
export function currentDraftVersion(
  versions: DraftVersion[]
): DraftVersion | null {
  for (let i = versions.length - 1; i >= 0; i--) {
    if (!versions[i].interrupted) return versions[i]
  }
  return null
}

type MessageLike = {
  id: string
  role: string
  parts?: Array<Record<string, unknown> & { type: string }>
}

/**
 * Rebuild every version of the chat's draft from its messages. A draft block
 * starts a new version; a completed editDraft call edits the current one.
 * One draft per chat: a new block replaces the previous draft.
 *
 * A block an answer stopped inside is kept as an interrupted version, so its
 * partial text stays readable, but it never becomes the draft later turns
 * edit. An edit replays only when the tool saw the same draft: the tool holds
 * the turn-start version, so an edit after a block written in the same answer,
 * or one the tool rejected, is skipped.
 */
export function buildDraftVersions(messages: MessageLike[]): DraftVersion[] {
  const versions: DraftVersion[] = []
  for (const message of messages) {
    if (message.role !== 'assistant') continue
    let wroteHere = false
    for (const part of message.parts ?? []) {
      if (part.type === 'text' && typeof part.text === 'string') {
        for (const block of parseDraftBlocks(part.text)) {
          wroteHere = true
          if (!block.closed && !block.content.trim()) continue
          versions.push({
            version: versions.length + 1,
            title: block.title,
            content: block.content,
            kind: 'write',
            messageId: message.id,
            ...(!block.closed && { interrupted: true })
          })
        }
      } else if (
        part.type === `tool-${EDIT_DRAFT_TOOL}` &&
        part.state === 'output-available'
      ) {
        const current = currentDraftVersion(versions)
        const input = part.input as DraftChange | undefined
        const output = part.output as { applied?: unknown } | undefined
        if (!current || wroteHere || !input) continue
        if (output?.applied === 0) continue
        const result = applyDraftChange(current, input)
        if (result.applied === 0) continue
        versions.push({
          version: versions.length + 1,
          title: result.title,
          content: result.content,
          kind: 'edit',
          messageId: message.id,
          applied: result.applied,
          failed: result.failed
        })
      }
    }
  }
  return versions
}

/**
 * Replace draft blocks in a historical answer with a one-line stub. The
 * stub depends only on the block, so a message replays identically on every
 * turn and the prompt-cache prefix holds.
 */
export function compactDraftBlocks(text: string): string {
  return replaceDraftBlocks(
    text,
    ({ title, content }) =>
      `[Draft "${title}" written here (${content.length} characters). The current version is attached to the latest user message.]`
  )
}

/** The current draft, as attached to the latest user message for the model. */
export function formatCurrentDraft(version: DraftVersion): string {
  return [
    `<current_draft title="${version.title.replace(/"/g, "'")}" version="${version.version}">`,
    version.content,
    '</current_draft>'
  ].join('\n')
}
