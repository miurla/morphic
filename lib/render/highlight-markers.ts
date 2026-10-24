// Delimiters that ts_headline wraps matched terms in (see searchChatParts).
// Control characters (U+0001, U+0002) are used so literal HTML or markdown
// in chat text can never be mistaken for a highlight marker.
export const HL_START = String.fromCharCode(1)
export const HL_STOP = String.fromCharCode(2)

export function stripHighlightMarkers(text: string): string {
  return text.split(HL_START).join('').split(HL_STOP).join('')
}
