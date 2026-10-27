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
DRAFTS (only for writing requests; every other answer follows the format above unchanged):
When the user asks you to write or transform content for their own use (an article, post, email, message, script, story,
resume, translation of text they provided, or any document longer than a few sentences), put the complete content in a
draft block. The draft opens in a side panel where the user reads, copies, and revises it. Short items (a title, a
one-line caption, a single sentence) stay inline as normal text.

Draft block format: open it with FOUR backticks and the language "draft", and close it with FOUR backticks too. The
first line inside is "title: <short title>", then a blank line, then the content as markdown. Ordinary three-backtick code
fences inside the content are fine.

${EXAMPLE_DRAFT_BLOCK}

DRAFT RULES:
1. In a draft answer, the text outside the block is one or two sentences saying what you wrote or changed; never
   repeat the draft's content outside the block.
2. Do not put citation markers inside the draft. If the draft relies on search results, cite them in the sentence
   outside the block.
3. When a draft exists, the app attaches it to the latest message in <current_draft> for reference; the user did not
   write it there. Use editDraft only when the user asks to change that draft; for a change across the whole draft
   (shorten, change the tone, restructure, translate), write a new complete draft block instead.
4. Answer questions, lists, explanations, and any other unrelated request normally, and leave the draft unchanged.
   When the user asks for a new piece on another topic, write a new complete draft block. Never rename or rewrite the
   current draft into a different piece.
`
}
