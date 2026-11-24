'use client'

import { useId } from 'react'

import { normalizePreference } from '@/lib/i18n/config'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './ui/select'
import { useI18n } from './language-provider'

export function LanguageSelector() {
  const { preference, setPreference, t } = useI18n()
  const id = useId()
  return (
    <section className="grid gap-3">
      <div className="grid gap-1">
        <label htmlFor={id} className="text-sm font-medium">
          {t('Language')}
        </label>
        <p id={`${id}-description`} className="text-sm text-muted-foreground">
          {t(
            'Choose the language for the interface and new AI responses in this browser.'
          )}
        </p>
      </div>
      <Select
        value={preference}
        onValueChange={value => setPreference(normalizePreference(value))}
      >
        <SelectTrigger id={id} aria-describedby={`${id}-description`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="auto">{t('Follow browser')}</SelectItem>
          <SelectItem value="zh-CN">简体中文</SelectItem>
          <SelectItem value="en">English</SelectItem>
        </SelectContent>
      </Select>
    </section>
  )
}
