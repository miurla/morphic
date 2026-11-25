import { chatMessages } from './messages/chat'
import { commonMessages } from './messages/common'
import { tutorMessages } from './messages/tutor'
import { workspaceMessages } from './messages/workspace'
import type { Locale } from './config'

export type TranslationValues = Record<string, string | number>
export type Translator = (message: string, values?: TranslationValues) => string

export const chineseMessages: Readonly<Record<string, string>> = {
  ...commonMessages,
  ...chatMessages,
  ...workspaceMessages,
  ...tutorMessages
}

/** English source text is also the fallback, so missing entries never show keys. */
export function translate(
  locale: Locale,
  message: string,
  values?: TranslationValues
): string {
  const translated =
    locale === 'zh-CN' && Object.hasOwn(chineseMessages, message)
      ? chineseMessages[message]
      : message
  return translated.replace(/\{(\w+)\}/g, (match, key: string) =>
    values && Object.hasOwn(values, key) ? String(values[key]) : match
  )
}

export function createTranslator(locale: Locale): Translator {
  return (message, values) => translate(locale, message, values)
}
