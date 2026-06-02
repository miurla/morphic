import { SearchSettings } from '@/components/search-settings'

export const metadata = {
  title: 'Search Settings — Morphic',
  description: 'Customize search language, region, content filtering, and homepage preferences.'
}

export default function SettingsPage() {
  return <SearchSettings />
}
