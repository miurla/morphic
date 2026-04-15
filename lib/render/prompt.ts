/**
 * Returns the prompt section that instructs the LLM to output
 * related questions as a ```spec fenced block at the end of its response.
 */
export function getRelatedQuestionsSpecPrompt(): string {
  return `
RELATED QUESTIONS (MANDATORY):
After your conclusion, you MUST generate exactly 3 follow-up questions in a \`\`\`spec fenced code block.
Each question should explore a different aspect of the topic not yet covered.
Questions must be concise (max 10-12 words) and in the user's language.

The spec block uses JSONL (one JSON object per line) with RFC 6902 JSON Patch operations.
Always include a Heading with title "Related" as the first child element.

Example output (always at the very end of your response):

\`\`\`spec
{"op":"add","path":"/root","value":"main"}
{"op":"add","path":"/elements/main","value":{"type":"Stack","props":{"direction":"vertical","gap":"sm"},"children":["header","questions"]}}
{"op":"add","path":"/elements/header","value":{"type":"Heading","props":{"title":"Related","icon":"related"},"children":[]}}
{"op":"add","path":"/elements/questions","value":{"type":"Stack","props":{"direction":"vertical","gap":"xs"},"children":["q1","q2","q3"]}}
{"op":"add","path":"/elements/q1","value":{"type":"Button","props":{"text":"First follow-up question here","variant":"link","icon":"arrow-right"},"on":{"press":{"action":"submitQuery","params":{"query":"First follow-up question here"}}},"children":[]}}
{"op":"add","path":"/elements/q2","value":{"type":"Button","props":{"text":"Second follow-up question here","variant":"link","icon":"arrow-right"},"on":{"press":{"action":"submitQuery","params":{"query":"Second follow-up question here"}}},"children":[]}}
{"op":"add","path":"/elements/q3","value":{"type":"Button","props":{"text":"Third follow-up question here","variant":"link","icon":"arrow-right"},"on":{"press":{"action":"submitQuery","params":{"query":"Third follow-up question here"}}},"children":[]}}
\`\`\`

AVAILABLE COMPONENTS:
- Heading: { title: string, icon?: "related" | "arrow-right" } - A heading label with optional icon
- Stack: { direction?: "vertical" | "horizontal", gap?: "xs" | "sm" | "md" | "lg" } - Layout container
- Button: { text: string, icon?: "related" | "arrow-right", variant?: "default" | "outline" | "ghost" | "link" | "secondary" } - A clickable button that emits a press action. Use variant="link" with icon="arrow-right" for inline follow-up suggestions.

AVAILABLE ACTIONS:
- submitQuery: { query: string } - Submit a follow-up query

SPEC RULES:
1. The related questions \`\`\`spec fence must appear at the END of your response.
2. Every \`\`\`spec block must contain ONLY JSONL patches — no commentary inside.
3. Keep each JSON object on a single line.
4. The "text" prop and "query" param must be identical for each question.
5. Emit exactly ONE related questions spec block per answer (image spec blocks are separate and may appear inline).
6. Do NOT include follow-up suggestions or questions in your markdown text. Only use the spec block for them.
`
}

/**
 * Returns the prompt section that instructs the LLM to optionally embed
 * inline image groups as ```spec fenced blocks within the response body.
 */
export function getImageSpecPrompt(): string {
  return `
INLINE IMAGE EMBEDDING:
When images would meaningfully enhance the answer (e.g. visual subjects, people, places, products, events),
embed one or more inline image groups anywhere in the markdown body using \`\`\`spec fenced code blocks.
Actively include images whenever they help the reader's understanding of the answer — visual context often
communicates faster and more clearly than prose.

Use this when:
- The search tool results contain relevant images (check the "images" array in tool output).
- A picture helps the reader understand the topic (subjects, places, products, events, diagrams, comparisons).

Skip images only for purely abstract or text-only topics where no image would add value.

AVAILABLE COMPONENTS FOR IMAGES:
- Grid: { columns: 1 | 2 | 3 | 4, gap?: "xs" | "sm" | "md" | "lg" } - A fixed-column container that reserves cell widths upfront so streaming images don't reflow.
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
6. Image spec blocks are separate from the mandatory related-questions spec block at the end.
7. Each image spec block must contain ONLY JSONL patches — no commentary inside.

Example (inline image group embedded in markdown body):

## Mount Fuji

Mount Fuji is Japan's tallest peak.

\`\`\`spec
{"op":"add","path":"/root","value":"grid"}
{"op":"add","path":"/elements/grid","value":{"type":"Grid","props":{"columns":3,"gap":"sm"},"children":["img1","img2","img3"]}}
{"op":"add","path":"/elements/img1","value":{"type":"Image","props":{"src":"https://cdn.example.com/fuji-1.jpg","sourceUrl":"https://en.wikipedia.org/wiki/Mount_Fuji","title":"Mount Fuji - Wikipedia","description":"Snow-capped peak at sunrise","aspectRatio":"4:3"},"children":[]}}
{"op":"add","path":"/elements/img2","value":{"type":"Image","props":{"src":"https://cdn.example.com/fuji-2.jpg","sourceUrl":"https://travel.example.com/mount-fuji","title":"Mount Fuji Travel Guide","aspectRatio":"4:3"},"children":[]}}
{"op":"add","path":"/elements/img3","value":{"type":"Image","props":{"src":"https://cdn.example.com/fuji-3.jpg","title":"Cherry blossoms in spring","aspectRatio":"4:3"},"children":[]}}
\`\`\`

It rises 3,776 meters above sea level...
`
}
