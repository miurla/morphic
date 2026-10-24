/**
 * Drafts are written as a ````draft fenced block in the answer text and edited
 * with the editDraft tool. Four backticks let the content hold ordinary code
 * fences. The first line inside the block is "title: ...".
 *
 * Everything here is pure: the server rebuilds the current draft from history
 * on each turn, and the client rebuilds the same versions for the panel.
 */

const FENCE_OPEN = '````draft\n'
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
}

const FENCE_LINE = /^`{3,}/
const BARE_THREE = /^```[ \t]*$/

/**
 * Where a block closes. Models sometimes close a ````draft block with three
 * backticks. Inner code fences come in pairs, so when the body has an odd
 * number of fence lines the last bare ``` line is taken as the close.
 */
function findClose(text: string, bodyStart: number) {
  const strict = text.indexOf(FENCE_CLOSE, bodyStart - 1)
  if (strict >= 0) {
    return { bodyEnd: strict, end: strict + FENCE_CLOSE.length }
  }

  const lines = text.slice(bodyStart).split('\n')
  let fenceLines = 0
  let lastBare = -1
  for (let i = 0; i < lines.length; i++) {
    if (!FENCE_LINE.test(lines[i])) continue
    fenceLines++
    if (BARE_THREE.test(lines[i])) lastBare = i
  }
  if (fenceLines % 2 === 0 || lastBare < 0) return null

  const before = lines.slice(0, lastBare).join('\n')
  const bodyEnd = bodyStart + before.length
  return {
    bodyEnd,
    end: bodyEnd + (lastBare > 0 ? 1 : 0) + lines[lastBare].length
  }
}

function locateDraftBlocks(text: string): BlockLocation[] {
  const blocks: BlockLocation[] = []
  let from = 0
  while (true) {
    const open = text.indexOf(FENCE_OPEN, from)
    if (open < 0) break
    const bodyStart = open + FENCE_OPEN.length
    const close = findClose(text, bodyStart)
    if (!close) {
      blocks.push({
        open,
        bodyStart,
        bodyEnd: text.length,
        end: text.length,
        closed: false
      })
      break
    }
    blocks.push({ open, bodyStart, ...close, closed: true })
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

/** Replace each closed draft block with what the callback returns. */
export function replaceDraftBlocks(
  text: string,
  replace: (draft: { title: string; content: string }) => string
): string {
  if (!text.includes(FENCE_OPEN)) return text
  let out = ''
  let from = 0
  for (const block of locateDraftBlocks(text)) {
    if (!block.closed) break
    out +=
      text.slice(from, block.open) +
      replace(parseBody(text.slice(block.bodyStart, block.bodyEnd)))
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

type MessageLike = {
  id: string
  role: string
  parts?: Array<Record<string, unknown> & { type: string }>
}

/**
 * Rebuild every version of the chat's draft from its messages. A closed draft
 * block starts a new version; a completed editDraft call edits the latest.
 * One draft per chat: a new block replaces the previous draft.
 */
export function buildDraftVersions(messages: MessageLike[]): DraftVersion[] {
  const versions: DraftVersion[] = []
  for (const message of messages) {
    if (message.role !== 'assistant') continue
    for (const part of message.parts ?? []) {
      if (part.type === 'text' && typeof part.text === 'string') {
        for (const block of parseDraftBlocks(part.text)) {
          if (!block.closed) continue
          versions.push({
            version: versions.length + 1,
            title: block.title,
            content: block.content,
            kind: 'write',
            messageId: message.id
          })
        }
      } else if (
        part.type === `tool-${EDIT_DRAFT_TOOL}` &&
        part.state === 'output-available'
      ) {
        const latest = versions.at(-1)
        const edits = (part.input as { edits?: DraftEdit[] } | undefined)?.edits
        if (!latest || !Array.isArray(edits)) continue
        const result = applyDraftEdits(latest.content, edits)
        if (result.applied === 0) continue
        versions.push({
          version: versions.length + 1,
          title: latest.title,
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
 * Replace closed draft blocks in a historical answer with a one-line stub. The
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
