// Exponential backoff retry utility

export interface RetryOptions {
  maxRetries?: number
  initialDelayMs?: number
  maxDelayMs?: number
  backoffMultiplier?: number
  onRetry?: (error: any, attempt: number) => void
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 100,
    maxDelayMs = 5000,
    backoffMultiplier = 2,
    onRetry
  } = options

  let lastError: any
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      
      if (attempt === maxRetries) {
        throw error
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        initialDelayMs * Math.pow(backoffMultiplier, attempt),
        maxDelayMs
      )
      
      if (onRetry) {
        onRetry(error, attempt + 1)
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError
}

// Specialized retry for database operations
export async function retryDatabaseOperation<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  return retryWithBackoff(operation, {
    maxRetries: 2,
    initialDelayMs: 200,
    maxDelayMs: 2000,
    onRetry: (error, attempt) => {
      console.log(`Retrying ${operationName} (attempt ${attempt}):`, error.message)
    }
  })
}