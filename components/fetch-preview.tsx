import { ExternalLink, Globe } from 'lucide-react'

interface FetchPreviewProps {
  url: string
  title?: string
  contentLength?: number
  status: 'fetching' | 'success' | 'error'
  error?: string
  fetchType?: string
}

export function FetchPreview({
  url,
  title,
  contentLength,
  status,
  error,
  fetchType = 'Retrieve'
}: FetchPreviewProps) {
  const getPageTitle = () => {
    if (title) return title
    try {
      const domain = new URL(url).hostname
      return domain.replace('www.', '')
    } catch {
      return url
    }
  }

  const getFavicon = () => {
    try {
      const domain = new URL(url).hostname
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`
    } catch {
      return null
    }
  }

  if (status === 'fetching') {
    return (
      <div className="p-3 bg-card border border-border rounded-lg">
        <div className="flex items-center justify-between gap-2 w-full">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Globe className="w-4 h-4 text-muted-foreground animate-pulse shrink-0" />
            <span
              className="text-sm text-foreground font-medium block truncate min-w-0"
              title={getPageTitle()}
            >
              {getPageTitle()}
            </span>
          </div>
          <span className="text-xs text-muted-foreground animate-pulse whitespace-nowrap">
            {fetchType}...
          </span>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="p-3 bg-card border border-border rounded-lg">
        <div className="flex items-center gap-2 w-full">
          <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-destructive block flex-1 truncate min-w-0">
            {error}
          </span>
        </div>
      </div>
    )
  }

  const favicon = getFavicon()

  return (
    <div
      className="p-3 bg-card border border-border rounded-lg cursor-pointer hover:border-border/80 transition-colors"
      onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
    >
      <div className="flex items-center justify-between gap-2 w-full">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {favicon && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={favicon}
              alt="Favicon"
              className="w-4 h-4 shrink-0"
              onError={e => {
                e.currentTarget.style.display = 'none'
                e.currentTarget.nextElementSibling?.classList.remove('hidden')
              }}
            />
          )}
          <Globe
            className={`w-4 h-4 text-muted-foreground shrink-0 ${
              favicon ? 'hidden' : ''
            }`}
          />
          <span
            className="text-sm text-foreground font-medium block truncate min-w-0"
            title={getPageTitle()}
          >
            {getPageTitle()}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          {contentLength && contentLength > 0 && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {contentLength > 1000
                ? `${Math.round(contentLength / 1000)}k chars`
                : `${contentLength} chars`}
            </span>
          )}
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {fetchType}
          </span>
          <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
        </div>
      </div>
    </div>
  )
}
