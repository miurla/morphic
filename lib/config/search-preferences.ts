import { getCookie, setCookie } from '@/lib/utils/cookies'

export interface SearchPreferences {
  language: string
  region: string
  safeSearch: 'off' | 'moderate' | 'strict'
  showNews: boolean
  showAds: boolean
}

export const DEFAULT_SEARCH_PREFERENCES: SearchPreferences = {
  language: 'en',
  region: 'US',
  safeSearch: 'moderate',
  showNews: true,
  showAds: false
}

const COOKIE_NAME = 'searchPreferences'

export function getSearchPreferences(): SearchPreferences {
  const raw = getCookie(COOKIE_NAME)
  if (!raw) return { ...DEFAULT_SEARCH_PREFERENCES }

  try {
    const parsed = JSON.parse(decodeURIComponent(raw))
    return {
      language: parsed.language || DEFAULT_SEARCH_PREFERENCES.language,
      region: parsed.region || DEFAULT_SEARCH_PREFERENCES.region,
      safeSearch: ['off', 'moderate', 'strict'].includes(parsed.safeSearch)
        ? parsed.safeSearch
        : DEFAULT_SEARCH_PREFERENCES.safeSearch,
      showNews:
        typeof parsed.showNews === 'boolean'
          ? parsed.showNews
          : DEFAULT_SEARCH_PREFERENCES.showNews,
      showAds:
        typeof parsed.showAds === 'boolean'
          ? parsed.showAds
          : DEFAULT_SEARCH_PREFERENCES.showAds
    }
  } catch {
    return { ...DEFAULT_SEARCH_PREFERENCES }
  }
}

export function setSearchPreferences(prefs: Partial<SearchPreferences>) {
  const current = getSearchPreferences()
  const merged = { ...current, ...prefs }
  setCookie(COOKIE_NAME, encodeURIComponent(JSON.stringify(merged)), 365)
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'ru', name: 'Русский' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'zh', name: '中文' },
  { code: 'ar', name: 'العربية' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'pl', name: 'Polski' },
  { code: 'sv', name: 'Svenska' },
  { code: 'da', name: 'Dansk' },
  { code: 'fi', name: 'Suomi' },
  { code: 'nb', name: 'Norsk' },
  { code: 'cs', name: 'Čeština' },
  { code: 'ro', name: 'Română' },
  { code: 'uk', name: 'Українська' },
  { code: 'th', name: 'ไทย' },
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'id', name: 'Bahasa Indonesia' }
] as const

export const REGIONS = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'PT', name: 'Portugal' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BE', name: 'Belgium' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'AT', name: 'Austria' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'PL', name: 'Poland' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'RO', name: 'Romania' },
  { code: 'RU', name: 'Russia' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'TR', name: 'Turkey' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'CN', name: 'China' },
  { code: 'IN', name: 'India' },
  { code: 'TH', name: 'Thailand' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'PH', name: 'Philippines' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'SG', name: 'Singapore' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'EG', name: 'Egypt' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'IL', name: 'Israel' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CL', name: 'Chile' },
  { code: 'CO', name: 'Colombia' },
  { code: 'NZ', name: 'New Zealand' }
] as const

export const SAFE_SEARCH_OPTIONS = [
  { value: 'off' as const, label: 'None', description: 'No filtering applied' },
  {
    value: 'moderate' as const,
    label: 'Moderate',
    description: 'Filter explicit images, allow explicit text'
  },
  {
    value: 'strict' as const,
    label: 'Strict',
    description: 'Filter all explicit content'
  }
] as const
