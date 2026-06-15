'use client'

import type { ComponentType, FormEvent } from 'react'
import { useEffect, useState } from 'react'
import Link from 'next/link'

import { ArrowLeft as IconArrowLeft, Xmark as IconBan, Bookmark as IconBookmark, CheckCircle as IconCircleCheck, Filter as IconFilter, Key as IconKey, Language as IconLanguage, MapPin as IconMapPin, JournalPage as IconNews, ShieldCheck as IconShieldCheck, Megaphone as IconSpeakerphone, Trash as IconTrash, ProfileCircle as IconUserCircle, SoundOff as IconVolumeOff } from 'iconoir-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  LANGUAGES,
  REGIONS,
  SAFE_SEARCH_OPTIONS
} from '@/lib/config/search-preferences'
import { useSearchPreferences } from '@/lib/hooks/use-search-preferences'
import { getCookie, setCookie } from '@/lib/utils/cookies'
import {
  PERSONALIZATION_COOKIE_NAME,
  parsePersonalizationCookie,
  sanitizePersonalizationSettings,
  serializePersonalizationCookie,
  type PersonalizationSettings
} from '@/lib/agents/personalization'

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
import { Textarea } from './ui/textarea'

type SourcePreferenceValue = 'trust' | 'prefer' | 'mute' | 'block'

type SourcePreferenceItem = {
  id: string
  profileId?: string | null
  target: string
  targetType: 'domain' | 'url'
  domain: string
  preference: SourcePreferenceValue
  note?: string | null
}

type SourcePreferenceProfileItem = {
  id: string
  name: string
  slug: string
  description?: string | null
  settings: {
    includeTerms: string[]
    excludeTerms: string[]
  }
  isActive: boolean
}

const SOURCE_PREFERENCE_OPTIONS: Array<{
  value: SourcePreferenceValue
  label: string
  description: string
  icon: ComponentType<{ className?: string }>
}> = [
  {
    value: 'trust',
    label: 'Trust',
    description: 'Rely on more',
    icon: IconShieldCheck
  },
  {
    value: 'prefer',
    label: 'Prefer',
    description: 'Rank higher',
    icon: IconCircleCheck
  },
  {
    value: 'mute',
    label: 'Avoid',
    description: 'Rank lower',
    icon: IconVolumeOff
  },
  {
    value: 'block',
    label: 'Never use',
    description: 'Exclude results',
    icon: IconBan
  }
]

function getPreferenceOption(value: SourcePreferenceValue) {
  return (
    SOURCE_PREFERENCE_OPTIONS.find(option => option.value === value) ??
    SOURCE_PREFERENCE_OPTIONS[1]
  )
}

export function SearchSettings() {
  const { preferences, setPreferences } = useSearchPreferences()
  const [sourcePreferences, setSourcePreferences] = useState<
    SourcePreferenceItem[]
  >([])
  const [sourcePreferenceProfiles, setSourcePreferenceProfiles] = useState<
    SourcePreferenceProfileItem[]
  >([])
  const [selectedSourceProfileId, setSelectedSourceProfileId] =
    useState('global')
  const [sourceTarget, setSourceTarget] = useState('')
  const [sourceNote, setSourceNote] = useState('')
  const [sourcePreference, setSourcePreference] =
    useState<SourcePreferenceValue>('prefer')
  const [sourceProfileName, setSourceProfileName] = useState('')
  const [sourceProfileTerms, setSourceProfileTerms] = useState('')
  const [sourcePreferencesLoading, setSourcePreferencesLoading] =
    useState(false)
  const [sourcePreferencesSaving, setSourcePreferencesSaving] = useState(false)
  const [sourceProfileSaving, setSourceProfileSaving] = useState(false)
  const [openrouterKey, setOpenrouterKey] = useState(() => {
    if (typeof window !== 'undefined') {
      return getCookie('openrouter_api_key') || ''
    }
    return ''
  })
  const [ollamaCloudKey, setOllamaCloudKey] = useState('')
  const [ollamaCloudKeyStatus, setOllamaCloudKeyStatus] = useState<
    'none' | 'user' | 'environment'
  >('none')
  const [ollamaCloudKeySaving, setOllamaCloudKeySaving] = useState(false)
  const [personalization, setPersonalization] =
    useState<PersonalizationSettings>(() => {
      if (typeof window !== 'undefined') {
        const localPersonalization = window.localStorage.getItem(
          PERSONALIZATION_COOKIE_NAME
        )
        if (localPersonalization) {
          return parsePersonalizationCookie(localPersonalization)
        }
        return parsePersonalizationCookie(
          getCookie(PERSONALIZATION_COOKIE_NAME) || undefined
        )
      }
      return sanitizePersonalizationSettings(null)
    })

  const loadSourcePreferences = async () => {
    setSourcePreferencesLoading(true)
    try {
      const response = await fetch('/api/source-preferences')
      const data = await response.json()
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Unable to load source preferences')
      }
      setSourcePreferences(data.preferences)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Unable to load source preferences'
      )
    } finally {
      setSourcePreferencesLoading(false)
    }
  }

  const loadSourcePreferenceProfiles = async () => {
    try {
      const response = await fetch('/api/source-preference-profiles')
      const data = await response.json()
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Unable to load source profiles')
      }
      setSourcePreferenceProfiles(data.profiles)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Unable to load source profiles'
      )
    }
  }

  useEffect(() => {
    void loadSourcePreferences()
    void loadSourcePreferenceProfiles()
    void loadOllamaCloudKeyStatus()
  }, [])

  const handleKeyChange = (val: string) => {
    setOpenrouterKey(val)
    setCookie('openrouter_api_key', val, 365)
  }

  const handleBlur = () => {
    toast.success('OpenRouter API Key saved', { duration: 1500 })
  }

  const loadOllamaCloudKeyStatus = async () => {
    try {
      const response = await fetch('/api/provider-keys/ollama-cloud')
      const data = await response.json()
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Unable to load Ollama Cloud key status')
      }

      setOllamaCloudKeyStatus(data.source ?? 'none')
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Unable to load Ollama Cloud key status'
      )
    }
  }

  const saveOllamaCloudKey = async () => {
    if (!ollamaCloudKey.trim()) {
      toast.error('Enter an Ollama Cloud API key before saving')
      return
    }

    setOllamaCloudKeySaving(true)
    try {
      const response = await fetch('/api/provider-keys/ollama-cloud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: ollamaCloudKey })
      })
      const data = await response.json()
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Unable to save Ollama Cloud API key')
      }

      setOllamaCloudKey('')
      setOllamaCloudKeyStatus('user')
      toast.success('Ollama Cloud API Key saved', { duration: 1500 })
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Unable to save Ollama Cloud API key'
      )
    } finally {
      setOllamaCloudKeySaving(false)
    }
  }

  const deleteOllamaCloudKey = async () => {
    setOllamaCloudKeySaving(true)
    try {
      const response = await fetch('/api/provider-keys/ollama-cloud', {
        method: 'DELETE'
      })
      const data = await response.json()
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Unable to remove Ollama Cloud API key')
      }

      setOllamaCloudKey('')
      setOllamaCloudKeyStatus(data.source ?? 'none')
      toast.success('Ollama Cloud API Key removed', { duration: 1500 })
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Unable to remove Ollama Cloud API key'
      )
    } finally {
      setOllamaCloudKeySaving(false)
    }
  }

  const persistPersonalization = async (
    settings: PersonalizationSettings,
    toastLabel?: string
  ) => {
    const serialized = serializePersonalizationCookie(settings)

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PERSONALIZATION_COOKIE_NAME, serialized)
    }

    const response = await fetch('/api/personalization', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: serialized
    })

    const data = await response.json()
    if (!response.ok || !data.ok) {
      throw new Error(data.error || 'Unable to save personalization')
    }

    if (toastLabel) {
      toast.success(`${toastLabel} updated`, { duration: 1500 })
    }
  }

  const updatePersonalization = (
    patch: Partial<PersonalizationSettings>,
    toastLabel?: string
  ) => {
    const next = sanitizePersonalizationSettings({
      ...personalization,
      ...patch
    })
    setPersonalization(next)
    void persistPersonalization(next, toastLabel).catch(error => {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Unable to save personalization'
      )
    })
  }

  const handlePersonalizationSave = async () => {
    const next = sanitizePersonalizationSettings(personalization)
    setPersonalization(next)
    try {
      await persistPersonalization(next, 'Personalization')
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Unable to save personalization'
      )
    }
  }

  const update = (key: string, value: string | boolean, label: string) => {
    setPreferences({ [key]: value })
    toast.success(`${label} updated`, { duration: 1500 })
  }

  const handleSourcePreferenceSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()
    setSourcePreferencesSaving(true)

    try {
      const response = await fetch('/api/source-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target: sourceTarget,
          preference: sourcePreference,
          note: sourceNote,
          ...(selectedSourceProfileId !== 'global' && {
            profileId: selectedSourceProfileId
          })
        })
      })
      const data = await response.json()
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Unable to save source preference')
      }

      setSourceTarget('')
      setSourceNote('')
      toast.success('Source preference saved', { duration: 1500 })
      await loadSourcePreferences()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Unable to save source preference'
      )
    } finally {
      setSourcePreferencesSaving(false)
    }
  }

  const handleSourceProfileSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault()
    setSourceProfileSaving(true)

    try {
      const terms = sourceProfileTerms
        .split(',')
        .map(term => term.trim())
        .filter(Boolean)
      const response = await fetch('/api/source-preference-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: sourceProfileName,
          includeTerms: terms
        })
      })
      const data = await response.json()
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Unable to save source profile')
      }

      setSourceProfileName('')
      setSourceProfileTerms('')
      toast.success('Source profile saved', { duration: 1500 })
      await loadSourcePreferenceProfiles()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Unable to save source profile'
      )
    } finally {
      setSourceProfileSaving(false)
    }
  }

  const handleDeleteSourcePreference = async (id: string) => {
    try {
      const response = await fetch(
        `/api/source-preferences?id=${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      )
      const data = await response.json()
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Unable to delete source preference')
      }

      setSourcePreferences(items => items.filter(item => item.id !== id))
      toast.success('Source preference removed', { duration: 1500 })
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Unable to delete source preference'
      )
    }
  }

  const handleDeleteSourceProfile = async (id: string) => {
    try {
      const response = await fetch(
        `/api/source-preference-profiles?id=${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      )
      const data = await response.json()
      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Unable to delete source profile')
      }

      setSourcePreferenceProfiles(items => items.filter(item => item.id !== id))
      setSourcePreferences(items => items.filter(item => item.profileId !== id))
      if (selectedSourceProfileId === id) {
        setSelectedSourceProfileId('global')
      }
      toast.success('Source profile removed', { duration: 1500 })
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Unable to delete source profile'
      )
    }
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

        {/* ── Personalization ──────────────────────────────────────── */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <div className="mt-0.5 rounded-lg bg-primary/10 p-2">
                  <IconUserCircle className="size-5 text-primary" />
                </div>
                <div>
                  <Label className="text-sm font-semibold">
                    Personalization
                  </Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Shape answers while preserving safety and source rules.
                  </p>
                </div>
              </div>
              <Switch
                checked={personalization.enabled}
                onCheckedChange={value =>
                  updatePersonalization({ enabled: value }, 'Personalization')
                }
                aria-label="Enable personalization"
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border bg-background px-3 py-2">
              <Label className="text-sm font-medium" htmlFor="use-for-search">
                Use in search
              </Label>
              <Switch
                id="use-for-search"
                checked={personalization.useForSearch}
                onCheckedChange={value =>
                  updatePersonalization({ useForSearch: value }, 'Search use')
                }
              />
            </div>

            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium" htmlFor="about-user">
                  What should Morphic know about you?
                </Label>
                <Textarea
                  id="about-user"
                  value={personalization.aboutUser}
                  onChange={event =>
                    setPersonalization(current =>
                      sanitizePersonalizationSettings({
                        ...current,
                        aboutUser: event.target.value
                      })
                    )
                  }
                  placeholder="Your work, interests, context, or constraints"
                  className="min-h-20 resize-y"
                />
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs font-medium" htmlFor="response-style">
                  How should Morphic respond?
                </Label>
                <Textarea
                  id="response-style"
                  value={personalization.responseStyle}
                  onChange={event =>
                    setPersonalization(current =>
                      sanitizePersonalizationSettings({
                        ...current,
                        responseStyle: event.target.value
                      })
                    )
                  }
                  placeholder="Tone, depth, formatting, or decision style"
                  className="min-h-20 resize-y"
                />
              </div>

              <div className="grid gap-1.5">
                <Label
                  className="text-xs font-medium"
                  htmlFor="personal-instructions"
                >
                  Additional instructions
                </Label>
                <Textarea
                  id="personal-instructions"
                  value={personalization.instructions}
                  onChange={event =>
                    setPersonalization(current =>
                      sanitizePersonalizationSettings({
                        ...current,
                        instructions: event.target.value
                      })
                    )
                  }
                  placeholder="Source preferences, recurring priorities, or habits"
                  className="min-h-20 resize-y"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="button" onClick={handlePersonalizationSave}>
                Save personalization
              </Button>
            </div>
          </div>
        </div>

        {/* ── Source Preferences ────────────────────────────────────── */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="flex gap-3">
              <div className="mt-0.5 rounded-lg bg-primary/10 p-2">
                <IconBookmark className="size-5 text-primary" />
              </div>
              <div>
                <Label className="text-sm font-semibold">
                  Source Preferences
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Tune domains and URLs used in search and citations.
                </p>
              </div>
            </div>

            <form
              className="flex flex-col gap-3"
              onSubmit={handleSourceProfileSubmit}
            >
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <Input
                  value={sourceProfileName}
                  onChange={event => setSourceProfileName(event.target.value)}
                  placeholder="Profile name"
                  aria-label="Source profile name"
                  required
                />
                <Input
                  value={sourceProfileTerms}
                  onChange={event => setSourceProfileTerms(event.target.value)}
                  placeholder="climate, ipcc"
                  aria-label="Source profile match terms"
                />
                <Button type="submit" disabled={sourceProfileSaving}>
                  Add profile
                </Button>
              </div>
            </form>

            {sourcePreferenceProfiles.length > 0 && (
              <div className="flex flex-col gap-2">
                {sourcePreferenceProfiles.map(profile => (
                  <div
                    key={profile.id}
                    className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <IconFilter className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate text-sm font-medium">
                          {profile.name}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {profile.settings.includeTerms.join(', ')}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      aria-label={`Remove ${profile.name}`}
                      onClick={() => handleDeleteSourceProfile(profile.id)}
                    >
                      <IconTrash className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <form
              className="flex flex-col gap-3"
              onSubmit={handleSourcePreferenceSubmit}
            >
              <div className="grid gap-3 sm:grid-cols-[1fr_150px_150px]">
                <Input
                  value={sourceTarget}
                  onChange={event => setSourceTarget(event.target.value)}
                  placeholder="example.com or https://example.com/article"
                  aria-label="Source domain or URL"
                  required
                />
                <Select
                  value={sourcePreference}
                  onValueChange={value =>
                    setSourcePreference(value as SourcePreferenceValue)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_PREFERENCE_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={selectedSourceProfileId}
                  onValueChange={setSelectedSourceProfileId}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global</SelectItem>
                    {sourcePreferenceProfiles.map(profile => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <Input
                  value={sourceNote}
                  onChange={event => setSourceNote(event.target.value)}
                  placeholder="Optional note"
                  aria-label="Source preference note"
                />
                <Button type="submit" disabled={sourcePreferencesSaving}>
                  Save
                </Button>
              </div>
            </form>

            <div className="flex flex-col gap-2">
              {sourcePreferencesLoading ? (
                <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                  Loading sources...
                </div>
              ) : sourcePreferences.length === 0 ? (
                <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                  No source preferences saved.
                </div>
              ) : (
                sourcePreferences.map(item => {
                  const option = getPreferenceOption(item.preference)
                  const Icon = option.icon

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Icon className="size-4 shrink-0 text-muted-foreground" />
                          <span className="truncate text-sm font-medium">
                            {item.target}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {option.description}
                          {item.profileId
                            ? ` · ${
                                sourcePreferenceProfiles.find(
                                  profile => profile.id === item.profileId
                                )?.name ?? 'Profile'
                              }`
                            : ' · Global'}
                          {item.note ? ` · ${item.note}` : ''}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0"
                        aria-label={`Remove ${item.target}`}
                        onClick={() => handleDeleteSourcePreference(item.id)}
                      >
                        <IconTrash className="size-4" />
                      </Button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

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
                <Label
                  htmlFor="openrouter-key"
                  className="text-sm font-semibold"
                >
                  OpenRouter API Key (Optional)
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Provide your own OpenRouter key to access more models. Saved
                  securely in your browser.
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

        {/* ── Ollama Cloud API Key ─────────────────────────────────── */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <div className="mt-0.5 rounded-lg bg-primary/10 p-2">
                <IconKey className="size-5 text-primary" />
              </div>
              <div className="flex-1">
                <Label
                  htmlFor="ollama-cloud-key"
                  className="text-sm font-semibold"
                >
                  Ollama Cloud API Key (Optional)
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {ollamaCloudKeyStatus === 'user'
                    ? 'A personal Ollama Cloud key is saved for this browser.'
                    : ollamaCloudKeyStatus === 'environment'
                      ? 'Using the server Ollama Cloud key. Add your own to override it.'
                      : 'Add your Ollama Cloud key to enable hosted Ollama models.'}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <PasswordInput
                id="ollama-cloud-key"
                value={ollamaCloudKey}
                onChange={e => setOllamaCloudKey(e.target.value)}
                placeholder="ollama..."
                className="w-full pr-10"
                autoComplete="off"
              />
              <Button
                type="button"
                onClick={saveOllamaCloudKey}
                disabled={ollamaCloudKeySaving}
                className="sm:w-24"
              >
                Save
              </Button>
              {ollamaCloudKeyStatus === 'user' && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={deleteOllamaCloudKey}
                  disabled={ollamaCloudKeySaving}
                  className="sm:w-24"
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
