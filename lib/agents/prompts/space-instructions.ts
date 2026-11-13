export function buildSpaceInstructions(
  space: { about: string; style: string } | null | undefined
): string {
  if (!space) return ''
  const body = [space.about.trim(), space.style.trim()]
    .filter(Boolean)
    .join('\n')
  if (!body) return ''

  return `## Space instructions
The user groups their work into spaces; these instructions apply to every
chat in this space. They override the defaults above for output language,
tone, structure, length, and formatting. They do not change the search,
fetch, and citation rules above.
<space_instructions>
${body}
</space_instructions>`
}
