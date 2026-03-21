const COOKIE_CHANGE_EVENT = 'morphic-cookie-change'

export function setCookie(name: string, value: string, days = 30) {
  if (typeof document === 'undefined') return

  const date = new Date()
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000)
  const expires = `expires=${date.toUTCString()}`
  document.cookie = `${name}=${value};${expires};path=/`
  window.dispatchEvent(new CustomEvent(COOKIE_CHANGE_EVENT, { detail: name }))
}

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null

  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [cookieName, cookieValue] = cookie.trim().split('=')
    if (cookieName === name) {
      return cookieValue
    }
  }
  return null
}

export function deleteCookie(name: string) {
  if (typeof document === 'undefined') return

  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
  window.dispatchEvent(new CustomEvent(COOKIE_CHANGE_EVENT, { detail: name }))
}

export function subscribeToCookieChange(onChange: () => void) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  window.addEventListener(COOKIE_CHANGE_EVENT, onChange)
  return () => window.removeEventListener(COOKIE_CHANGE_EVENT, onChange)
}
