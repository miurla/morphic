import { StorageProvider } from './types'

export class LocalStorageProvider implements StorageProvider {
  private getFullKey(key: string): string {
    return `morphic:${key}`
  }

  async get(key: string): Promise<string | null> {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(this.getFullKey(key))
  }

  async set(key: string, value: string): Promise<string | null> {
    if (typeof window === 'undefined') return null
    localStorage.setItem(this.getFullKey(key), value)
    return 'OK'
  }

  async del(key: string): Promise<number> {
    if (typeof window === 'undefined') return 0
    localStorage.removeItem(this.getFullKey(key))
    return 1
  }

  async zrange(
    key: string,
    start: number,
    stop: number,
    options?: { rev: boolean }
  ): Promise<string[]> {
    if (typeof window === 'undefined') return []
    const listKey = this.getFullKey(`zset:${key}`)
    const list = JSON.parse(localStorage.getItem(listKey) || '[]')
    const sorted = options?.rev ? list.reverse() : list
    return sorted.slice(start, stop === -1 ? undefined : stop + 1)
  }

  async zrem(key: string, member: string): Promise<number> {
    if (typeof window === 'undefined') return 0
    const listKey = this.getFullKey(`zset:${key}`)
    const list = JSON.parse(localStorage.getItem(listKey) || '[]')
    const filtered = list.filter((item: string) => item !== member)
    localStorage.setItem(listKey, JSON.stringify(filtered))
    return list.length - filtered.length
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    if (typeof window === 'undefined') return 0
    const listKey = this.getFullKey(`zset:${key}`)
    const list = JSON.parse(localStorage.getItem(listKey) || '[]')
    if (!list.includes(member)) {
      list.push(member)
      localStorage.setItem(listKey, JSON.stringify(list))
      return 1
    }
    return 0
  }

  async hgetall<T extends Record<string, unknown>>(key: string): Promise<T | null> {
    if (typeof window === 'undefined') return null
    const value = localStorage.getItem(this.getFullKey(key))
    return value ? JSON.parse(value) : null
  }

  async hmset(key: string, value: Record<string, any>): Promise<'OK' | number> {
    if (typeof window === 'undefined') return 0
    localStorage.setItem(this.getFullKey(key), JSON.stringify(value))
    return 'OK'
  }
}
