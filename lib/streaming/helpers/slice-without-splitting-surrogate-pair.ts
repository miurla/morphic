export function sliceWithoutSplittingSurrogatePair(
  value: string,
  maxChars: number
): string {
  if (value.length <= maxChars) return value

  const sliced = value.slice(0, maxChars)
  const lastCodeUnit = sliced.charCodeAt(sliced.length - 1)

  return lastCodeUnit >= 0xd800 && lastCodeUnit <= 0xdbff
    ? sliced.slice(0, -1)
    : sliced
}
