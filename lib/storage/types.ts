import { Chat } from '@/lib/types'

export interface StorageProvider {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<string | null>
  del(key: string): Promise<number>
  zrange(key: string, start: number, stop: number, options?: { rev: boolean }): Promise<string[]>
  zrem(key: string, member: string): Promise<number>
  zadd(key: string, score: number, member: string): Promise<number | null>
  hgetall<T extends Record<string, unknown>>(key: string): Promise<T | null>
  hmset(key: string, value: Record<string, any>): Promise<'OK' | number>
}
