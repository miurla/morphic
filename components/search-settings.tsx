'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

import {
  IconArrowLeft,
  IconFilter,
  IconKey,
  IconLanguage,
  IconMapPin,
  IconNews,
  IconSpeakerphone
} from '@tabler/icons-react'
import { toast } from 'sonner'

import {
  LANGUAGES,
  REGIONS,
  SAFE_SEARCH_OPTIONS
} from '@/lib/config/search-preferences'
import { useSearchPreferences } from '@/lib/hooks/use-search-preferences'
import { getCookie, setCookie } from '@/lib/utils/cookies'

import { Label } from './ui/label'
import { PasswordInput } from './ui/password-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './ui/select'
import { Separator } from './ui/separator'
import { Switch } from './ui/switch'

export function SearchSettings() {
  const { preferences, setPreferences } = useSearchPreferences()
  const [openrouterKey, setOpenrouterKey] = useState(() => {
    if (typeof window !== 'undefined') {
      return getCookie('openrouter_api_key') || ''
    }
    return ''
  })

  const handleKeyChange = (val: string) => {
    setOpenrouterKey(val)
    setCookie('openrouter_api_key', val, 365)
  }

  const handleBlur = () => {
    toast.success('OpenRouter API Key saved', { duration: 1500 })
  }

  const update = (
    key: string,
    value: string | boolean,
    label: string
  ) => {
    setPreferences({ [key]: value })
    toast.success(`${label} updated`, { duration: 1500 })
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <IconArrowLeft className="size-4" />
          Back to search
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Search Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Customize how search results are filtered and displayed across all
          providers.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {/* ── Language ───────────────────────────────────────────────── */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <div className="mt-0.5 rounded-lg bg-primary/10 p-2">
                <IconLanguage className="size-5 text-primary" />
              </div>
              <div>
                <Label className="text-sm font-semibold">
                  Interface Language
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Preferred language for search results and interface text
                </p>
              </div>
            </div>
            <Select
              value={preferences.language}
              onValueChange={v => update('language', v, 'Language')}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map(l => (
                  <SelectItem key={l.code} value={l.code}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Region ────────────────────────────────────────────────── */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <div className="mt-0.5 rounded-lg bg-primary/10 p-2">
                <IconMapPin className="size-5 text-primary" />
              </div>
              <div>
                <Label className="text-sm font-semibold">Region</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Country to bias local results, news, and currency
                </p>
              </div>
            </div>
            <Select
              value={preferences.region}
              onValueChange={v => update('region', v, 'Region')}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REGIONS.map(r => (
                  <SelectItem key={r.code} value={r.code}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Safe Search ───────────────────────────────────────────── */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <div className="mt-0.5 rounded-lg bg-primary/10 p-2">
                <IconFilter className="size-5 text-primary" />
              </div>
              <div>
                <Label className="text-sm font-semibold">
                  Filter Adult Content
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Control how explicit content is filtered in results
                </p>
              </div>
            </div>
            <Select
              value={preferences.safeSearch}
              onValueChange={v =>
                update(
                  'safeSearch',
                  v as 'off' | 'moderate' | 'strict',
                  'Safe search'
                )
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SAFE_SEARCH_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>
                    <div className="flex flex-col">
                      <span>{o.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        {/* ── News on Homepage ──────────────────────────────────────── */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex gap-3">
              <div className="mt-0.5 rounded-lg bg-primary/10 p-2">
                <IconNews className="size-5 text-primary" />
              </div>
              <div>
                <Label htmlFor="show-news" className="text-sm font-semibold">
                  News on Homepage
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Show trending news stories on the homepage
                </p>
              </div>
            </div>
            <Switch
              id="show-news"
              checked={preferences.showNews}
              onCheckedChange={v => update('showNews', v, 'News')}
            />
          </div>
        </div>

        {/* ── Ads / Sponsored ───────────────────────────────────────── */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex gap-3">
              <div className="mt-0.5 rounded-lg bg-primary/10 p-2">
                <IconSpeakerphone className="size-5 text-primary" />
              </div>
              <div>
                <Label htmlFor="show-ads" className="text-sm font-semibold">
                  Ads / Sponsored Content
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Allow sponsored content to appear on the homepage
                </p>
              </div>
            </div>
            <Switch
              id="show-ads"
              checked={preferences.showAds}
              onCheckedChange={v => update('showAds', v, 'Ads preference')}
            />
          </div>
        </div>

        {/* ── OpenRouter API Key ────────────────────────────────────── */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <div className="mt-0.5 rounded-lg bg-primary/10 p-2">
                <IconKey className="size-5 text-primary" />
              </div>
              <div className="flex-1">
                <Label htmlFor="openrouter-key" className="text-sm font-semibold">
                  OpenRouter API Key (Optional)
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Provide your own OpenRouter key to access more models. Saved securely in your browser.
                </p>
              </div>
            </div>
            <div className="w-full">
              <PasswordInput
                id="openrouter-key"
                value={openrouterKey}
                onChange={e => handleKeyChange(e.target.value)}
                onBlur={handleBlur}
                placeholder="sk-or-v1-..."
                className="w-full pr-10"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
