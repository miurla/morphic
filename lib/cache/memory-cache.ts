import { Chat } from '@/lib/db/schema'
import { UIMessage } from '@/lib/types/ai'

// LRU cache entry type
type CacheEntry<T> = {
  value: T
  expiry: number
  lastAccessed: number
}

// In-memory cache with TTL and LRU eviction
class MemoryCache<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private ttl: number
  private maxEntries: number
  private stats = { hits: 0, misses: 0 }

  constructor(ttlSeconds: number = 60, maxEntries: number = 1000) {
    this.ttl = ttlSeconds * 1000 // Convert to milliseconds
    this.maxEntries = maxEntries
  }

  set(key: string, value: T): void {
    try {
      // If we're at capacity, evict LRU entry
      if (this.cache.size >= this.maxEntries) {
        this.evictLRU()
      }

      const now = Date.now()
      const expiry = now + this.ttl
      this.cache.set(key, { value, expiry, lastAccessed: now })
    } catch (error) {
      console.error('Cache set error:', error)
      // Fail silently, don't impact main flow
    }
  }

  private evictLRU(): void {
    let oldestKey: string | null = null
    let oldestTime = Infinity

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
    }
  }

  get(key: string): T | null {
    try {
      const item = this.cache.get(key)

      if (!item) {
        this.stats.misses++
        return null
      }

      const now = Date.now()
      if (now > item.expiry) {
        this.cache.delete(key)
        this.stats.misses++
        return null
      }

      // Update last accessed time
      item.lastAccessed = now
      this.stats.hits++
      return item.value
    } catch (error) {
      console.error('Cache get error:', error)
      this.stats.misses++
      return null
    }
  }

  delete(key: string): void {
    try {
      this.cache.delete(key)
    } catch (error) {
      console.error('Cache delete error:', error)
    }
  }

  deletePattern(pattern: string): void {
    try {
      // Delete all keys that start with the pattern
      for (const key of this.cache.keys()) {
        if (key.startsWith(pattern)) {
          this.cache.delete(key)
        }
      }
    } catch (error) {
      console.error('Cache deletePattern error:', error)
    }
  }

  clear(): void {
    try {
      this.cache.clear()
    } catch (error) {
      console.error('Cache clear error:', error)
    }
  }

  // Clean up expired entries periodically
  cleanup(): void {
    try {
      const now = Date.now()
      for (const [key, item] of this.cache.entries()) {
        if (now > item.expiry) {
          this.cache.delete(key)
        }
      }
    } catch (error) {
      console.error('Cache cleanup error:', error)
    }
  }

  // Get cache statistics
  getStats() {
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate:
        this.stats.hits > 0
          ? this.stats.hits / (this.stats.hits + this.stats.misses)
          : 0
    }
  }
}

// Get cache configuration from environment variables
const getCacheConfig = () => {
  const ttl = process.env.CHAT_CACHE_TTL
  const maxEntries = process.env.CHAT_CACHE_MAX_ENTRIES

  const ttlValue = ttl ? parseInt(ttl, 10) : 300 // Default: 5 minutes
  const maxEntriesValue = maxEntries ? parseInt(maxEntries, 10) : 1000 // Default: 1000 entries

  // Validate configuration
  const validTtl = Math.max(10, Math.min(3600, ttlValue)) // Min: 10s, Max: 1 hour
  const validMaxEntries = Math.max(100, Math.min(10000, maxEntriesValue)) // Min: 100, Max: 10000

  return { ttl: validTtl, maxEntries: validMaxEntries }
}

// Cache instances with configurable TTLs and size limits
const config = getCacheConfig()
export const chatCache = new MemoryCache<Chat & { messages: UIMessage[] }>(
  config.ttl,
  config.maxEntries
)

// Store interval reference for cleanup
let cleanupInterval: NodeJS.Timeout | null = null

// Setup cleanup interval
if (typeof setInterval !== 'undefined') {
  cleanupInterval = setInterval(() => {
    chatCache.cleanup()

    // Log stats periodically in development
    if (process.env.NODE_ENV === 'development') {
      const stats = chatCache.getStats()
      console.log(
        `Cache stats - Size: ${stats.size}, Hit rate: ${(stats.hitRate * 100).toFixed(2)}%`
      )
    }
  }, 60000) // Run cleanup every minute
}

// Cleanup function for graceful shutdown
export const cleanupCacheInterval = () => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval)
    cleanupInterval = null
  }
  chatCache.clear()
}

// Setup graceful shutdown handlers
if (typeof process !== 'undefined' && process.on) {
  // Graceful shutdown on SIGINT (Ctrl+C)
  process.on('SIGINT', () => {
    console.log('\nGracefully shutting down cache...')
    cleanupCacheInterval()
    // Let the process exit naturally after cleanup
    process.exitCode = 0
  })

  // Graceful shutdown on SIGTERM
  process.on('SIGTERM', () => {
    console.log('\nGracefully shutting down cache...')
    cleanupCacheInterval()
    // Let the process exit naturally after cleanup
    process.exitCode = 0
  })

  // Cleanup before exit
  process.on('beforeExit', () => {
    cleanupCacheInterval()
  })
}
