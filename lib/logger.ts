// lib/logger.ts

// Basic console logger implementation
type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export class Logger {
  // Simple console logging methods
  static info(message: string, ...args: unknown[]): void {
    console.log(`[INFO] ${message}`, ...args)
  }

  static warn(message: string, ...args: unknown[]): void {
    console.warn(`[WARN] ${message}`, ...args)
  }

  static error(message: string, ...args: unknown[]): void {
    console.error(`[ERROR] ${message}`, ...args)
  }

  static debug(message: string, ...args: unknown[]): void {
    // Debug logs might be too verbose for production, consider environment variable check
    // if (process.env.NODE_ENV === 'development') {
    console.debug(`[DEBUG] ${message}`, ...args)
    // }
  }

  // Placeholder for more complex logging if needed later
  // static log(level: LogLevel, message: string, context?: Record<string, unknown>) {
  //   const timestamp = new Date().toISOString();
  //   console[level](`[${level.toUpperCase()}] [${timestamp}] ${message}`, context || '');
  // }
}
