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
Always include a SectionHeader with title "Related" as the first child element.

Example output (always at the very end of your response):

\`\`\`spec
{"op":"add","path":"/root","value":"main"}
{"op":"add","path":"/elements/main","value":{"type":"Stack","props":{"direction":"vertical","gap":"sm"},"children":["header","q1","q2","q3"]}}
{"op":"add","path":"/elements/header","value":{"type":"SectionHeader","props":{"title":"Related","icon":"related"},"children":[]}}
{"op":"add","path":"/elements/q1","value":{"type":"QuestionButton","props":{"text":"First follow-up question here"},"on":{"press":{"action":"submitQuery","params":{"query":"First follow-up question here"}}},"children":[]}}
{"op":"add","path":"/elements/q2","value":{"type":"QuestionButton","props":{"text":"Second follow-up question here"},"on":{"press":{"action":"submitQuery","params":{"query":"Second follow-up question here"}}},"children":[]}}
{"op":"add","path":"/elements/q3","value":{"type":"QuestionButton","props":{"text":"Third follow-up question here"},"on":{"press":{"action":"submitQuery","params":{"query":"Third follow-up question here"}}},"children":[]}}
\`\`\`

AVAILABLE COMPONENTS:
- SectionHeader: { title: string, icon?: "related" } - A section heading label with optional icon
- Stack: { direction?: "vertical" | "horizontal", gap?: "xs" | "sm" | "md" | "lg" } - Layout container
- QuestionButton: { text: string } - A clickable follow-up question button

AVAILABLE ACTIONS:
- submitQuery: { query: string } - Submit a follow-up query

SPEC RULES:
1. Always wrap JSONL patches in a single \`\`\`spec fence at the END of your response.
2. The \`\`\`spec block must contain ONLY JSONL patches — no commentary inside.
3. Keep each JSON object on a single line.
4. The "text" prop and "query" param must be identical for each question.
5. Do NOT open more than one \`\`\`spec block in a single answer.
6. Do NOT include follow-up suggestions or questions in your markdown text. Only use the spec block for them.
`
}
