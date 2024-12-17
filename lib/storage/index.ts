import { StorageProvider } from './types'
import { LocalStorageProvider } from './local-storage'
import { RedisWrapper, getRedisClient } from '../redis/config'

let storageProvider: StorageProvider | null = null

// Create a wrapper class that adapts RedisWrapper to StorageProvider interface
class RedisStorageAdapter implements StorageProvider {
  constructor(private redis: RedisWrapper) {}

  async get(key: string): Promise<string | null> {
    return this.redis.get(key)
  }

  async set(key: string, value: string): Promise<string | null> {
    return this.redis.set(key, value)
  }

  async del(key: string): Promise<number> {
    return this.redis.del(key)
  }

  async zrange(
    key: string,
    start: number,
    stop: number,
    options?: { rev: boolean }
  ): Promise<string[]> {
    return this.redis.zrange(key, start, stop, options)
  }

  async zrem(key: string, member: string): Promise<number> {
    return this.redis.zrem(key, member)
  }

  async zadd(key: string, score: number, member: string): Promise<number | null> {
    return this.redis.zadd(key, score, member)
  }

  async hgetall<T extends Record<string, unknown>>(key: string): Promise<T | null> {
    return this.redis.hgetall<T>(key)
  }

  async hmset(key: string, value: Record<string, any>): Promise<'OK' | number> {
    return this.redis.hmset(key, value)
  }
}

export async function getStorageProvider(): Promise<StorageProvider> {
  if (storageProvider) return storageProvider

  const preferredStorage = process.env.STORAGE_PROVIDER?.toLowerCase() || 'redis'

  if (preferredStorage === 'local') {
    console.log('Using localStorage as configured storage provider')
    storageProvider = new LocalStorageProvider()
    return storageProvider
  }

  try {
    // Try to get Redis client first
    const redis = await getRedisClient()
    storageProvider = new RedisStorageAdapter(redis)
    return storageProvider
  } catch (error) {
    // Fallback to localStorage if Redis is not available
    console.warn('Redis not available, falling back to localStorage')
    storageProvider = new LocalStorageProvider()
    return storageProvider
  }
}
