import { sql } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'

import { db } from '@/lib/db'
import { RLSViolationError, withOptionalRLS, withRLS } from '@/lib/db/with-rls'
import type { TxInstance } from '@/lib/db/with-rls'

// Mock the db module
vi.mock('@/lib/db', () => ({
  db: {
    transaction: vi.fn()
  }
}))

// Helper to create a minimal mock transaction
function createMockTx(overrides: Partial<TxInstance> = {}): TxInstance {
  return {
    execute: vi.fn(),
    ...overrides
  } as unknown as TxInstance
}

describe('RLS Helper Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('withRLS', () => {
    it('should set user context and execute callback', async () => {
      const userId = 'user-123'
      const expectedResult = { id: 'result-1' }
      const mockTx = createMockTx()

      // Mock the transaction
      vi.mocked(db.transaction).mockImplementation(async callback => {
        return callback(mockTx)
      })

      const callback = vi.fn().mockResolvedValue(expectedResult)

      const result = await withRLS(userId, callback)

      // Verify set_config was called with correct user ID
      expect(mockTx.execute).toHaveBeenCalledWith(
        sql`SELECT set_config('app.current_user_id', ${userId}, true)`
      )

      // Verify callback was called with transaction
      expect(callback).toHaveBeenCalledWith(mockTx)

      // Verify result is returned
      expect(result).toEqual(expectedResult)
    })

    it('should safely handle special characters in userId', async () => {
      const userId = "user'; DROP TABLE users; --"
      const mockTx = createMockTx()

      vi.mocked(db.transaction).mockImplementation(async callback => {
        return callback(mockTx)
      })

      await withRLS(userId, async () => {})

      // Verify set_config is called with parameterized query (safe from injection)
      expect(mockTx.execute).toHaveBeenCalledWith(
        sql`SELECT set_config('app.current_user_id', ${userId}, true)`
      )
    })

    it('should throw RLSViolationError for RLS policy violations', async () => {
      const userId = 'user-123'
      const rlsError = new Error(
        'new row violates row-level security policy for table "chats"'
      )

      vi.mocked(db.transaction).mockRejectedValue(rlsError)

      await expect(withRLS(userId, async () => {})).rejects.toThrow(
        RLSViolationError
      )

      await expect(withRLS(userId, async () => {})).rejects.toThrow(
        `Access denied for user ${userId}`
      )
    })

    it('should re-throw non-RLS errors unchanged', async () => {
      const userId = 'user-123'
      const genericError = new Error('Database connection failed')

      vi.mocked(db.transaction).mockRejectedValue(genericError)

      await expect(withRLS(userId, async () => {})).rejects.toThrow(
        genericError
      )
    })

    it('should handle RLS errors without Error instance', async () => {
      const userId = 'user-123'
      const rlsErrorString = 'row-level security policy violation'

      vi.mocked(db.transaction).mockRejectedValue(rlsErrorString)

      await expect(withRLS(userId, async () => {})).rejects.toThrow(
        RLSViolationError
      )
    })

    it('should execute callback with transaction result', async () => {
      const userId = 'user-123'
      const mockFrom = vi.fn().mockResolvedValue([{ id: 'chat-1' }])
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom })
      const mockTx = createMockTx({
        select: mockSelect
      })

      vi.mocked(db.transaction).mockImplementation(async callback => {
        return callback(mockTx)
      })

      const result = await withRLS(userId, async tx => {
        return tx.select().from('chats' as never)
      })

      expect(result).toEqual([{ id: 'chat-1' }])
    })
  })

  describe('withOptionalRLS', () => {
    it('should use withRLS when userId is provided', async () => {
      const userId = 'user-123'
      const expectedResult = { id: 'result-1' }
      const mockTx = createMockTx()

      vi.mocked(db.transaction).mockImplementation(async callback => {
        return callback(mockTx)
      })

      const callback = vi.fn().mockResolvedValue(expectedResult)

      const result = await withOptionalRLS(userId, callback)

      // Verify transaction was used (withRLS path)
      expect(db.transaction).toHaveBeenCalled()
      expect(mockTx.execute).toHaveBeenCalledWith(
        sql`SELECT set_config('app.current_user_id', ${userId}, true)`
      )
      expect(result).toEqual(expectedResult)
    })

    it('should use direct db connection when userId is null', async () => {
      const expectedResult = { id: 'result-1' }
      const callback = vi.fn().mockResolvedValue(expectedResult)

      const result = await withOptionalRLS(null, callback)

      // Verify transaction was NOT used (direct db path)
      expect(db.transaction).not.toHaveBeenCalled()

      // Verify callback was called with db directly
      expect(callback).toHaveBeenCalledWith(db)

      expect(result).toEqual(expectedResult)
    })

    it('should handle empty string as no userId', async () => {
      const expectedResult = { id: 'result-1' }
      const callback = vi.fn().mockResolvedValue(expectedResult)

      const result = await withOptionalRLS('', callback)

      // Empty string should be treated as no userId
      expect(db.transaction).not.toHaveBeenCalled()
      expect(callback).toHaveBeenCalledWith(db)
      expect(result).toEqual(expectedResult)
    })
  })

  describe('RLSViolationError', () => {
    it('should be an instance of Error', () => {
      const error = new RLSViolationError()
      expect(error).toBeInstanceOf(Error)
    })

    it('should have correct name property', () => {
      const error = new RLSViolationError()
      expect(error.name).toBe('RLSViolationError')
    })

    it('should use default message when not provided', () => {
      const error = new RLSViolationError()
      expect(error.message).toBe('Row level security policy violation')
    })

    it('should use custom message when provided', () => {
      const customMessage = 'Access denied for user 123'
      const error = new RLSViolationError(customMessage)
      expect(error.message).toBe(customMessage)
    })

    it('should maintain stack trace', () => {
      const error = new RLSViolationError('Test error')
      expect(error.stack).toBeDefined()
      expect(error.stack).toContain('RLSViolationError')
    })
  })
})
