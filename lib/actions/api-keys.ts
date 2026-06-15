'use server'

import { cookies } from 'next/headers'

export async function setOpenRouterKey(key: string) {
  const cookieStore = await cookies()
  
  if (!key) {
    cookieStore.delete('openrouter_api_key')
  } else {
    // Note: since this is a user preference for their own API calls, 
    // it's sent to the server. We keep it httpOnly and secure to protect it.
    cookieStore.set('openrouter_api_key', key, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365 // 1 year
    })
  }
}

export async function getOpenRouterKey(): Promise<string> {
  try {
    const cookieStore = await cookies()
    return cookieStore.get('openrouter_api_key')?.value || ''
  } catch (e) {
    return ''
  }
}
