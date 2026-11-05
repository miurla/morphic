/**
 * Returns the prompt section that instructs the LLM to end an answer with
 * follow-up suggestions as a ```spec fenced block: buttons that send the
 * user's likely next message, under a heading that names what they offer.
 * What the suggestions are depends on the answer (follow-up questions for a
 * researched answer, changes for a draft), and they are skipped when nothing
 * useful would come next (greetings, single-fact lookups, non-answers).
 */
export function getFollowUpSuggestionsSpecPrompt(): string {
  return `
FOLLOW-UP SUGGESTIONS:
After your conclusion, suggest exactly 3 next messages the user is likely to send, as buttons in a \`\`\`spec fenced code block. This is expected on every substantive answer; only the narrow skip cases below are exempt.

Decide from the answer you just wrote, not from what the reader might go on to wonder. Include the spec block whenever that answer compares options, recommends or advises, explains a cause or a mechanism, lays out several distinct points, walks through steps, or writes or changes a draft. Anchor each suggestion to concrete details from THIS answer.

SKIP the spec block entirely (output nothing) only in these cases:
- Greetings, small talk, or thanks ("hi", "thanks", "how are you").
- The answer delivers a single fact, value, date, quantity, or yes/no, even when interesting follow-ups do exist. A lookup does not stop being a lookup because the topic is rich.
- Meta/operational replies, acknowledgements, or task-completion notices. A draft answer is not one of these.
- Cases where you could not answer (refusal, clarification request, or empty result).
- Short answers where suggested next questions would be generic or forced.
These skip cases are the exception. When the answer is substantive, include the spec block.

Suggest what this user needs next from this answer. Which kind of answer to write is decided before this step: a request to write a piece (an article, even an informative one, a post, an email) is a draft answer and its content goes in the draft block.
- For an answer that informs, write the three questions a genuinely curious reader would tap next, not a checklist of "other aspects". Make the three intents distinct:
  - Deepen: go further on the single most interesting or surprising point.
  - Act/decide: the practical next step (e.g. "How do I…", "Which … for …?").
  - Broaden: a useful comparison, trade-off, or related angle.
  Avoid three near-duplicate "what are the differences / what about X" questions. Set the Heading title to "Related" and its icon to "related".
- For a draft answer (you wrote a draft block or changed the draft), write three changes the user could ask for next, phrased as their own instruction rather than a question and anchored to this draft's purpose, audience, or named parts: one on length or format (a shorter version, a 300-character summary), one on tone or audience (more formal for the hiring manager, warmer for a friend), and one on content (add a detail the piece is missing, rework a named paragraph). Do not suggest something the draft already does. Set the Heading title to "Revise" and its icon to "edit".
Suggestions must be concise (max 10-12 words), self-contained, and in the user's language.

The spec block uses JSONL (one JSON object per line) with RFC 6902 JSON Patch operations.
Always include a Heading as the first child element, with the title and icon named above.

Example output (only when suggestions are valuable; place it at the very end of your response):

\`\`\`spec
{"op":"add","path":"/root","value":"main"}
{"op":"add","path":"/elements/main","value":{"type":"Stack","props":{"direction":"vertical","gap":"sm"},"children":["header","suggestions"]}}
{"op":"add","path":"/elements/header","value":{"type":"Heading","props":{"title":"Related","icon":"related"},"children":[]}}
{"op":"add","path":"/elements/suggestions","value":{"type":"Stack","props":{"direction":"vertical","gap":"xs"},"children":["q1","q2","q3"]}}
{"op":"add","path":"/elements/q1","value":{"type":"Button","props":{"text":"First suggestion here","variant":"link","icon":"arrow-right"},"on":{"press":{"action":"submitQuery","params":{"query":"First suggestion here"}}},"children":[]}}
{"op":"add","path":"/elements/q2","value":{"type":"Button","props":{"text":"Second suggestion here","variant":"link","icon":"arrow-right"},"on":{"press":{"action":"submitQuery","params":{"query":"Second suggestion here"}}},"children":[]}}
{"op":"add","path":"/elements/q3","value":{"type":"Button","props":{"text":"Third suggestion here","variant":"link","icon":"arrow-right"},"on":{"press":{"action":"submitQuery","params":{"query":"Third suggestion here"}}},"children":[]}}
\`\`\`

AVAILABLE COMPONENTS:
- Heading: { title: string, icon?: "related" | "edit" | "arrow-right" } - A heading label with optional icon
- Stack: { direction?: "vertical" | "horizontal", gap?: "xs" | "sm" | "md" | "lg" } - Layout container
- Button: { text: string, icon?: "related" | "edit" | "arrow-right", variant?: "default" | "outline" | "ghost" | "link" | "secondary" } - A clickable button that emits a press action. Use variant="link" with icon="arrow-right" for inline follow-up suggestions.

AVAILABLE ACTIONS:
- submitQuery: { query: string } - Send the suggestion as the user's next message

SPEC RULES:
1. If included, the follow-up suggestions \`\`\`spec fence must appear at the END of your response.
2. Every \`\`\`spec block must contain ONLY JSONL patches — no commentary inside.
3. Keep each JSON object on a single line.
4. The "text" prop and "query" param must be identical for each suggestion.
5. Emit at most ONE follow-up suggestions spec block per answer, and none at all when the skip criteria above apply (image spec blocks are separate and may appear inline).
6. Do NOT include follow-up suggestions or questions in your markdown text. Only use the spec block for them. The heading belongs only to the spec block's Heading element: never write "Related", "Revise", or any heading for the suggestions as markdown text before the block.
`
}

export const EXAMPLE_SOURCE_CARDS_SPEC_BLOCK = `\`\`\`spec
{"op":"add","path":"/root","value":"cards"}
{"op":"add","path":"/elements/cards","value":{"type":"Grid","props":{"columns":2,"gap":"sm","responsive":true},"children":["c1","c2"]}}
{"op":"add","path":"/elements/c1","value":{"type":"Card","props":{"href":"EXAMPLE_URL_1"},"children":["c1t","c1d","c1b"]}}
{"op":"add","path":"/elements/c1t","value":{"type":"Text","props":{"text":"SQLBolt","weight":"semibold"},"children":[]}}
{"op":"add","path":"/elements/c1d","value":{"type":"Text","props":{"text":"Free interactive lessons that run SQL in the browser.","tone":"muted"},"children":[]}}
{"op":"add","path":"/elements/c1b","value":{"type":"Badge","props":{"text":"Free"},"children":[]}}
{"op":"add","path":"/elements/c2","value":{"type":"Card","props":{"href":"EXAMPLE_URL_2"},"children":["c2t","c2d"]}}
{"op":"add","path":"/elements/c2t","value":{"type":"Text","props":{"text":"Mode SQL Tutorial","weight":"semibold"},"children":[]}}
{"op":"add","path":"/elements/c2d","value":{"type":"Text","props":{"text":"Analytics-focused tutorial using real datasets.","tone":"muted"},"children":[]}}
\`\`\``

/**
 * Returns the prompt section that instructs the LLM to present a set of real,
 * linkable items found in search results as linked cards in a ```spec block.
 */
export function getSourceCardsSpecPrompt(): string {
  return `
SOURCE CARDS:
When the user asks you to find, recommend, or collect a set of real things that each have their own web page
(resources, websites, tools, apps, courses, papers, books, clinics, shops, places, jobs, articles), and the search
results contain the item's own page for at least 2 of them, present those items as linked cards in a \`\`\`spec block
instead of a bullet list.

Do NOT use source cards for explanations, single facts, how-to steps, side-by-side comparisons of attributes (use a
table), writing, translation, or code tasks. Also do NOT use them when the search results are only roundups, reviews,
or articles that mention the items: answer with a bullet list citing those articles instead.

AVAILABLE COMPONENTS FOR SOURCE CARDS:
- Grid: { columns: 1 | 2 | 3 | 4, gap?: "xs" | "sm" | "md" | "lg", responsive?: boolean } - responsive collapses to one column on narrow screens.
- Card: { href?: string } - A bordered container; with href the whole card links to that page and shows its domain.
- Text: { text: string, tone?: "default" | "muted", weight?: "normal" | "semibold" }
- Badge: { text: string } - A small label.

SOURCE CARDS RULES:
1. Wrap the cards in a Grid with columns=2 and responsive=true. Each item is one Card whose children are, in order:
   a Text with the item's name (weight "semibold"), an optional Text with one short sentence from that result on why it
   fits the request (tone "muted"), and an optional Badge with a short tag such as a price, location, date, or type,
   only when the result states it.
2. "href" is the item's OWN page: its official site, product or store page, listing, or paper page, copied verbatim
   from the "url" field of a search result. NEVER fabricate, guess, or shorten URLs, and never add an item's page from
   memory when it is not in the search results.
3. A roundup, review, listicle, or news article that only mentions an item is NOT that item's page. Make a card only
   for items whose own page is in the results; mention the others in prose without a card. If fewer than 2 items have
   their own page, use no cards at all.
4. Include 2–8 cards, most relevant first. Do not repeat the same items as a bullet list.
5. Write a short lead-in sentence before the block and your analysis or recommendation after it.
6. Place the block where the list belongs in the answer. The block must contain ONLY JSONL patches.

Example:

## Free ways to learn SQL

These free courses let you practice queries as you go.

${EXAMPLE_SOURCE_CARDS_SPEC_BLOCK}

Start with SQLBolt for the basics, then move to Mode for analysis practice.
`
}

export const EXAMPLE_IMAGE_SPEC_BLOCK = `\`\`\`spec
{"op":"add","path":"/root","value":"grid"}
{"op":"add","path":"/elements/grid","value":{"type":"Grid","props":{"columns":2,"gap":"sm"},"children":["img1","img2"]}}
{"op":"add","path":"/elements/img1","value":{"type":"Image","props":{"src":"EXAMPLE_IMAGE_1","sourceUrl":"EXAMPLE_SOURCE_1","title":"Mount Fuji at sunrise","description":"Snow-capped peak at sunrise","aspectRatio":"4:3"},"children":[]}}
{"op":"add","path":"/elements/img2","value":{"type":"Image","props":{"src":"EXAMPLE_IMAGE_2","sourceUrl":"EXAMPLE_SOURCE_2","title":"Mount Fuji in spring","description":"Cherry blossoms framing Mount Fuji","aspectRatio":"4:3"},"children":[]}}
\`\`\``

/**
 * Returns the prompt section that instructs the LLM to optionally embed
 * inline image groups as ```spec fenced blocks within the response body.
 */
export function getImageSpecPrompt(): string {
  return `
INLINE IMAGE EMBEDDING:
Whenever the search results contain images relevant to the answer,
embed one or more inline image groups anywhere in the markdown body using \`\`\`spec fenced code blocks.
Default to including at least one image group when relevant images are available (check the "images"
array in tool output), and use several groups for multi-part answers, each placed right where it
illustrates the surrounding text (not only at the top). Prefer 2–4 images per group when good options
exist; a single strong image is fine when only one fits. Visual context communicates faster and more
clearly than prose.

Skip images only for genuinely abstract or text-only topics where no picture helps.
Never include irrelevant or decorative images, and never fabricate URLs.

AVAILABLE COMPONENTS FOR IMAGES:
- Grid: { columns: 1 | 2 | 3 | 4, gap?: "xs" | "sm" | "md" | "lg", responsive?: boolean } - responsive collapses to one column on narrow screens. - A fixed-column container that reserves cell widths upfront so streaming images don't reflow.
- Image: { src: string, sourceUrl?: string, title?: string, description?: string, aspectRatio?: "1:1" | "16:9" | "4:3" }

IMAGE SPEC RULES:
1. Only use image URLs taken verbatim from the search tool's "images" array — NEVER fabricate or guess URLs.
2. Map tool output fields to Image props as follows, copying values EXACTLY without rewording:
   - image.url → "src"
   - image.sourceUrl → "sourceUrl" (omit if not present in the tool output — do NOT invent)
   - image.title → "title" (omit if not present)
   - image.description → "description" (omit if not present)
3. The "aspectRatio" field SHOULD reflect the natural orientation of the subject: "1:1" for square (logos, portraits), "16:9" for wide (landscapes, scenes), "4:3" for standard photos. Images within the same Grid should generally use the SAME aspectRatio so they render at identical heights.
4. Always wrap image groups in a Grid. Set "columns" to the exact number of Image children (1–4). For 1 image use columns=1, for 2 use columns=2, etc. Choose the number of images based on the situation — the variety and relevance of available images and how much visual context genuinely helps the answer.
5. You MAY emit multiple \`\`\`spec image blocks, each placed at the position in the markdown where they are contextually relevant (e.g. right after the heading or paragraph they illustrate).
6. Image spec blocks are separate from the follow-up suggestions spec block at the end (which is itself optional — see FOLLOW-UP SUGGESTIONS).
7. Each image spec block must contain ONLY JSONL patches — no commentary inside.

Example (inline image group embedded in markdown body):

## Mount Fuji

### Key facts
- **Elevation:** Mount Fuji rises 3,776 meters above sea level.
- **Setting:** Its snow-capped peak is a defining feature of the landscape.

${EXAMPLE_IMAGE_SPEC_BLOCK}

### Why it matters
- **Significance:** The mountain is both a natural landmark and a cultural symbol.

Mount Fuji combines geographic prominence with enduring cultural importance.
`
}
