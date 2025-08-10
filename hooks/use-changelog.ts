import { useEffect, useState } from 'react'

interface Changelog {
  version: string
  date: string
  features: string[]
  showUntil?: string
  dismissKey: string
}

export function useChangelog() {
  const [changelog, setChangelog] = useState<Changelog | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    async function fetchChangelog() {
      try {
        const response = await fetch('/changelog.json')
        const data = await response.json()

        if (data.current) {
          const dismissKey = data.current.dismissKey
          const isDismissed = localStorage.getItem(dismissKey)

          // Check expiration date
          if (data.current.showUntil) {
            const showUntilDate = new Date(data.current.showUntil)
            const now = new Date()
            if (now > showUntilDate) {
              return // Expired, don't show
            }
          }

          if (!isDismissed) {
            setChangelog(data.current)
            // Delay display to avoid immediate popup on page load
            setTimeout(() => setIsVisible(true), 1500)
          }
        }
      } catch (error) {
        // Silent fail - notifications are not critical
        console.debug('Failed to fetch changelog', error)
      }
    }

    fetchChangelog()
  }, [])

  const dismiss = () => {
    if (changelog) {
      localStorage.setItem(changelog.dismissKey, 'true')
      setIsVisible(false)
    }
  }

  return {
    changelog,
    isVisible,
    dismiss
  }
}
