import { headers } from 'next/headers'

/**
 * Helper function to get base URL from headers
 * Extracts URL information from Next.js request headers
 */
export async function getBaseUrlFromHeaders(): Promise<URL> {
  const headersList = await headers()
  const baseUrl = headersList.get('x-base-url')
  const url = headersList.get('x-url')
  const host = headersList.get('x-host')
  const protocol = headersList.get('x-protocol') || 'http:'

  try {
    // Try to use the pre-constructed base URL if available
    if (baseUrl) {
      return new URL(baseUrl)
    } else if (url) {
      return new URL(url)
    } else if (host) {
      const constructedUrl = `${protocol}${
        protocol.endsWith(':') ? '//' : '://'
      }${host}`
      return new URL(constructedUrl)
    } else {
      return new URL('http://localhost:3000')
    }
  } catch (urlError) {
    // Fallback to default URL if any error occurs during URL construction
    return new URL('http://localhost:3000')
  }
}

/**
 * Resolves the base URL using environment variables or headers
 * Centralizes the base URL resolution logic used across the application
 * @returns A URL object representing the base URL
 */
export async function getBaseUrl(): Promise<URL> {
  // Check for environment variables first
  const baseUrlEnv = process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL
  
  if (baseUrlEnv) {
    try {
      const baseUrlObj = new URL(baseUrlEnv)
      console.log('Using BASE_URL environment variable:', baseUrlEnv)
      return baseUrlObj
    } catch (error) {
      console.warn(
        'Invalid BASE_URL environment variable, falling back to headers'
      )
      // Fall back to headers if the environment variable is invalid
    }
  }
  
  // If no valid environment variable is available, use headers
  return await getBaseUrlFromHeaders()
}

/**
 * Gets the base URL as a string
 * Convenience wrapper around getBaseUrl that returns a string
 * @returns A string representation of the base URL
 */
export async function getBaseUrlString(): Promise<string> {
  const baseUrlObj = await getBaseUrl()
  return baseUrlObj.toString()
}