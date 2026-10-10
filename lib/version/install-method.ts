/**
 * Resolves the install-method label shown in the sidebar footer.
 * Precedence: explicit `MORPHIC_INSTALL_METHOD` (used verbatim, so operators
 * can set any value such as `docker` or `unraid`), then Vercel detection via
 * the platform-provided `VERCEL` env var, then `source`.
 */
export function resolveInstallMethod(
  env: Record<string, string | undefined>
): string {
  const explicit = env.MORPHIC_INSTALL_METHOD
  if (explicit !== undefined && explicit.trim() !== '') {
    return explicit
  }
  if (env.VERCEL) {
    return 'vercel'
  }
  return 'source'
}
