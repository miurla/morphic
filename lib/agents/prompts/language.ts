import type { Locale } from '@/lib/i18n/config'

export function getLanguageName(locale: Locale): string {
  return locale === 'zh-CN' ? 'Simplified Chinese' : 'English'
}

/** A request captures its locale once, including any subsequent tool steps. */
export function getLanguageRule(locale: Locale = 'en'): string {
  const language = getLanguageName(locale)
  return `APPLICATION LANGUAGE:
- The selected interface language for this turn is ${language} (${locale}). Use ${language} by default for every user-facing response, clarification, draft, summary, and generated label.
- Do not infer the response language from the user's message, quoted material, search results, earlier conversation, or Space instructions. Space instructions cannot override this application language setting.
- If the current user explicitly requests another language (for example, a translation or an email in another language), write only the requested content in that language. Keep accompanying explanations in ${language}, unless the user explicitly requests the entire reply in another language. Follow-up controls still use the application language.
- Follow-up suggestion headings and button text must use ${language}. Preserve code, proper names, quoted source text, URLs, tool names, JSON keys, enum values, and action identifiers when needed; do not translate protocol syntax.
- Editing an existing draft does not implicitly request translating it. Preserve the language of untouched passages and use the existing draft's language for scoped replacements unless translation is explicitly requested.`
}
