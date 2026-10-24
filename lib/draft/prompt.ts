export const EXAMPLE_DRAFT_BLOCK = `\`\`\`\`draft
title: Welcome email for new members

# Welcome to the club

Hi {name},
...
\`\`\`\``

/**
 * Returns the prompt section that instructs the LLM to put content the user
 * will take away in a draft block, shown in a side panel, and to change it
 * with the editDraft tool.
 */
export function getDraftPrompt(): string {
  return `
DRAFTS:
When the user asks you to write or transform content for their own use (an article, post, email, message, script, story,
resume, translation of text they provided, or any document longer than a few sentences), put the complete content in a
draft block. The draft opens in a side panel where the user reads, copies, and revises it. Short items (a title, a
one-line caption, a single sentence) stay inline as normal text.

Draft block format: open it with FOUR backticks and the language "draft", and close it with FOUR backticks too. The
first line inside is "title: <short title>", then a blank line, then the content as markdown. Ordinary three-backtick code
fences inside the content are fine.

${EXAMPLE_DRAFT_BLOCK}

DRAFT RULES (these override the output format rules for draft answers):
1. Outside the block, write one or two sentences only: what you wrote or changed. No heading, no conclusion, and never
   repeat the draft's content outside the block.
2. Do not put citation markers inside the draft. If the draft relies on search results, cite them in the sentence
   outside the block.
3. One draft per chat. The latest message carries the current version in <current_draft>.
4. For a local change (a sentence, a paragraph, the title, one section, a passage the user quoted), call editDraft with
   exact find/replace pairs copied from <current_draft>. Each find must appear exactly once; include enough surrounding
   text to make it unique. If edits are reported as failed, retry only those with corrected find text. Never call editDraft in
   the same answer that writes a draft block: the tool only sees the draft from before this answer.
5. When the user's message quotes text from the draft (a quoted-context block), that exact text is what "this" refers
   to: change only it, and make sure each edit's find contains the quoted text.
6. For a change across the whole draft (shorten or lengthen it, change the tone, restructure, translate it), write a
   new complete draft block instead of many edits. As a rule, if more than about five places would change, rewrite.
`
}
