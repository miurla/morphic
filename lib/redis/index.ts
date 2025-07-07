import { getRedisClient } from './config'

export { getRedisClient, redisConfig, RedisWrapper } from './config'

// For convenience, export a default redis instance getter
export const redis = {
  async get(key: string): Promise<string | null> {
    const client = await getRedisClient()
    const result = await client.hgetall(key)
    return result ? JSON.stringify(result) : null
  },
  
  async set(key: string, value: string): Promise<void> {
    const client = await getRedisClient()
    await client.hmset(key, { data: value })
  },
  
  async setex(key: string, seconds: number, value: string): Promise<void> {
    const client = await getRedisClient()
    await client.hmset(key, { data: value, expiry: Date.now() + (seconds * 1000) })
  },
  
  async del(key: string): Promise<number> {
    const client = await getRedisClient()
    return await client.del(key)
  }
}
