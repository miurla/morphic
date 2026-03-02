import { sql } from 'drizzle-orm'

import { db } from '.'

// Type for transaction or database instance
export type DbInstance = typeof db
export type TxInstance = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Custom error class for RLS violations
 */
export class RLSViolationError extends Error {
  constructor(message = 'Row level security policy violation') {
    super(message)
    this.name = 'RLSViolationError'
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RLSViolationError)
    }
  }
}

/**
 * Execute database operations with Row-Level Security context
 * Sets the current user ID for the transaction scope
 *
 * @param userId - The user ID to set for RLS policies
 * @param callback - The database operations to execute
 * @returns The result of the callback function
 * @throws {RLSViolationError} If RLS policy is violated
 *
 * @example
 * ```typescript
 * const result = await withRLS(userId, async (tx) => {
 *   return tx.select().from(chats)
 * })
 * ```
 */
export async function withRLS<T>(
  userId: string,
  callback: (tx: TxInstance) => Promise<T>
): Promise<T> {
  try {
    return await db.transaction(async tx => {
      // Set the user ID for this transaction
      // Using SET LOCAL ensures it's only valid for this transaction
      // Use pg_catalog.quote_literal for safe escaping
      await tx.execute(
        sql`SELECT set_config('app.current_user_id', ${userId}, true)`
      )

      // Execute the callback with the transaction
      return await callback(tx)
    })
  } catch (error) {
    // Check for RLS policy violations
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (
      errorMessage.includes('new row violates row-level security policy') ||
      errorMessage.includes('row-level security policy')
    ) {
      throw new RLSViolationError(
        `Access denied for user ${userId}. ${errorMessage}`
      )
    }

    // Re-throw other errors
    throw error
  }
}

/**
 * Execute database operations with optional RLS context
 * If userId is null, executes without RLS context (for public operations)
 *
 * @param userId - The user ID to set for RLS policies, or null for public access
 * @param callback - The database operations to execute
 * @returns The result of the callback function
 */
export async function withOptionalRLS<T>(
  userId: string | null,
  callback: (tx: TxInstance | DbInstance) => Promise<T>
): Promise<T> {
  if (userId) {
    return withRLS(userId, callback as (tx: TxInstance) => Promise<T>)
  }

  // Execute without RLS context for public operations
  return callback(db)
}
