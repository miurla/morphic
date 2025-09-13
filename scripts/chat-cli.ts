#!/usr/bin/env tsx

import { config as dotenvConfig } from 'dotenv'
import { Readable } from 'stream'
import type { ReadableStream as NodeReadableStream } from 'stream/web'

// Load environment variables from .env.local
dotenvConfig({ path: '.env.local' })

// Constants
const DEFAULT_MESSAGE = 'Hello, how are you?'

interface ChatApiConfig {
  apiUrl: string
  message: string
  chatId?: string
  modelType?: 'speed' | 'quality'
  searchMode?: 'quick' | 'planning' | 'adaptive' | boolean
  trigger?: 'submit-message' | 'regenerate-message'
  messageId?: string
}

interface UIMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content?: string
  parts: Array<{
    type: string
    text?: string
    [key: string]: any
  }>
  createdAt: Date
}

interface ChatPayload {
  chatId: string
  trigger: 'submit-message' | 'regenerate-message'
  message?: UIMessage
  messageId?: string
  isNewChat?: boolean
}

class ChatApiTester {
  private config: ChatApiConfig

  private validateUrl(url?: string): string | undefined {
    if (!url) return undefined

    try {
      const parsed = new URL(url)
      // Only allow localhost and local network
      if (
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname.startsWith('192.168.') ||
        parsed.hostname.startsWith('10.0.') ||
        parsed.hostname.startsWith('172.16.') ||
        parsed.hostname.startsWith('172.17.') ||
        parsed.hostname.startsWith('172.18.') ||
        parsed.hostname.startsWith('172.19.') ||
        parsed.hostname.startsWith('172.20.') ||
        parsed.hostname.startsWith('172.21.') ||
        parsed.hostname.startsWith('172.22.') ||
        parsed.hostname.startsWith('172.23.') ||
        parsed.hostname.startsWith('172.24.') ||
        parsed.hostname.startsWith('172.25.') ||
        parsed.hostname.startsWith('172.26.') ||
        parsed.hostname.startsWith('172.27.') ||
        parsed.hostname.startsWith('172.28.') ||
        parsed.hostname.startsWith('172.29.') ||
        parsed.hostname.startsWith('172.30.') ||
        parsed.hostname.startsWith('172.31.') ||
        parsed.hostname.endsWith('.local')
      ) {
        return url
      }
      console.error('❌ Only local URLs are allowed for security')
      process.exit(1)
    } catch {
      console.error('❌ Invalid URL format')
      process.exit(1)
    }
  }

  constructor(config: Partial<ChatApiConfig> = {}) {
    this.config = {
      apiUrl:
        this.validateUrl(config.apiUrl) || 'http://localhost:3000/api/chat',
      message: config.message || DEFAULT_MESSAGE,
      chatId: config.chatId || this.generateId(),
      modelType: config.modelType || 'speed',
      searchMode: config.searchMode ?? 'adaptive',
      trigger: config.trigger || 'submit-message',
      messageId: config.messageId
    }
  }

  private generateId(): string {
    return `chat_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  }

  private createUserMessage(text: string, messageId?: string): UIMessage {
    // Limit message length for safety
    const sanitizedText = text.slice(0, 10000)

    return {
      id: messageId || this.generateId(),
      role: 'user',
      content: sanitizedText,
      parts: [
        {
          type: 'text',
          text: sanitizedText
        }
      ],
      createdAt: new Date()
    }
  }

  private loadCookiesFromEnv(): string | undefined {
    if (process.env.MORPHIC_COOKIES) {
      console.log('🍪 Using cookies from MORPHIC_COOKIES environment variable')
      return process.env.MORPHIC_COOKIES
    }
    return undefined
  }

  async sendMessage(message?: string): Promise<void> {
    // Load cookies from env
    const cookies = this.loadCookiesFromEnv()

    const payload: ChatPayload = {
      chatId: this.config.chatId!,
      trigger: this.config.trigger || 'submit-message'
    }

    // Add message for submit trigger or messageId for regenerate
    if (this.config.trigger === 'regenerate-message') {
      if (!this.config.messageId) {
        console.error('❌ Message ID is required for regeneration')
        process.exit(1)
      }
      payload.messageId = this.config.messageId
      // Only include message if we're editing a user message
      if (message && message !== DEFAULT_MESSAGE) {
        // Use the same messageId for the edited message
        const userMessage = this.createUserMessage(
          message,
          this.config.messageId
        )
        payload.message = userMessage
      }
    } else {
      const userMessage = this.createUserMessage(message || this.config.message)
      payload.message = userMessage
      // Add isNewChat flag - always true for CLI since we generate new chatId each time
      payload.isNewChat = true
    }

    console.log('🚀 Sending request to:', this.config.apiUrl)
    console.log('📦 Payload:', JSON.stringify(payload, null, 2))
    console.log('🤖 Model Type:', this.config.modelType)
    console.log('🔍 Search Mode:', this.config.searchMode)
    console.log('💬 Chat ID:', this.config.chatId)
    console.log('\n---\n')

    // Build cookie string
    let cookieString = ''
    if (cookies) {
      // If cookies from env exist, append our settings to them
      cookieString = cookies
      if (!cookieString.includes('modelType=')) {
        cookieString += `; modelType=${this.config.modelType}`
      }
      if (!cookieString.includes('searchMode=')) {
        const searchModeValue = this.config.searchMode === false ? 'disabled' : this.config.searchMode
        cookieString += `; searchMode=${searchModeValue}`
      }
    } else {
      // If no cookies from env, just use our settings
      const searchModeValue = this.config.searchMode === false ? 'disabled' : this.config.searchMode
      cookieString = [
        `modelType=${this.config.modelType}`,
        `searchMode=${searchModeValue}`
      ].join('; ')
    }

    const headers = {
      'Content-Type': 'application/json',
      Cookie: cookieString
    }

    // Only show headers in debug mode, without sensitive data
    if (process.env.DEBUG) {
      console.log('🔐 Request headers:')
      console.log(`   Content-Type: ${headers['Content-Type']}`)
      console.log(`   Cookie: [REDACTED]`)
    }

    try {
      const response = await fetch(this.config.apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(
          `HTTP ${response.status}: ${response.statusText}\n${errorText}`
        )
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      console.log('📡 Response received, starting stream...\n')

      // Convert Web Streams API to Node.js stream
      // Type assertion needed due to Node.js/Web Streams API type mismatch
      // response.body is guaranteed to be a ReadableStream at this point
      const webStream = response.body as unknown as NodeReadableStream<any>
      const nodeReadable = Readable.fromWeb(webStream)

      // Create parser stream

      // Process SSE stream
      const textDecoder = new TextDecoder()
      let buffer = ''
      let hasReceivedData = false

      for await (const chunk of nodeReadable) {
        buffer += textDecoder.decode(chunk, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.trim() === '') continue

          // Debug: log raw lines
          if (process.env.DEBUG) {
            console.log(`🔍 Raw line: ${line}`)
          }

          if (line.startsWith('data: ')) {
            hasReceivedData = true
            const data = line.slice(6)
            if (data === '[DONE]') {
              console.log('\n\n✅ Stream finished')
              continue
            }

            try {
              const parsed = JSON.parse(data)

              if (parsed.type === 'text') {
                process.stdout.write(parsed.text || '')
              } else if (parsed.type === 'text-delta') {
                process.stdout.write(parsed.delta || '')
              } else if (parsed.type === 'reasoning') {
                console.log(`\n🤔 Reasoning: ${parsed.text}`)
              } else if (parsed.type?.startsWith('tool-')) {
                console.log(`\n🔧 Tool: ${parsed.type}`)
                console.log(`   State: ${parsed.state}`)
                if (parsed.input) {
                  console.log(`   Input: ${JSON.stringify(parsed.input)}`)
                }
                if (parsed.output) {
                  console.log(`   Output: ${JSON.stringify(parsed.output)}`)
                }
              } else if (parsed.type === 'finish') {
                console.log('\n\n✅ Stream completed')
              } else if (parsed.type === 'error') {
                console.error(
                  `\n❌ Error: ${parsed.error || parsed.errorText || JSON.stringify(parsed)}`
                )
              } else if (process.env.DEBUG) {
                // Only show raw event types in debug mode
                console.log(`\n📦 Event type: ${parsed.type || 'unknown'}`)
              }
            } catch (error) {
              if (process.env.DEBUG) {
                console.log(`📄 Parse error for data`)
              }
            }
          } else if (line.startsWith('event: ')) {
            const eventName = line.slice(7)
            console.log(`📨 Event: ${eventName}`)
          }
        }
      }

      if (!hasReceivedData) {
        console.log('\n⚠️  No data received from stream')
      }

      console.log('\n\n✨ Request completed successfully')
    } catch (error) {
      console.error(
        '\n❌ Error:',
        error instanceof Error ? error.message : error
      )
      process.exit(1)
    }
  }
}

// Parse command line arguments
function parseArgs(): Partial<ChatApiConfig> {
  const args = process.argv.slice(2)
  const config: Partial<ChatApiConfig> = {}

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '-m':
      case '--message':
        config.message = args[++i]
        break
      case '-u':
      case '--url':
        config.apiUrl = args[++i]
        break
      case '-c':
      case '--chat-id':
        config.chatId = args[++i]
        break
      case '-s':
      case '--search':
        config.searchMode = 'adaptive'
        break
      case '--no-search':
        config.searchMode = false
        break
      case '--search-mode':
        const searchMode = args[++i]
        if (['quick', 'planning', 'adaptive'].includes(searchMode)) {
          config.searchMode = searchMode as 'quick' | 'planning' | 'adaptive'
        } else {
          console.error('❌ Invalid search mode. Use: quick, planning, or adaptive')
          process.exit(1)
        }
        break
      case '--model-type':
        const modelType = args[++i]
        if (['speed', 'quality'].includes(modelType)) {
          config.modelType = modelType as 'speed' | 'quality'
        } else {
          console.error('❌ Invalid model type. Use: speed or quality')
          process.exit(1)
        }
        break
      case '-t':
      case '--trigger':
        const trigger = args[++i]
        if (
          trigger === 'regenerate' ||
          trigger === 'regenerate-message'
        ) {
          config.trigger = 'regenerate-message'
        } else {
          config.trigger = 'submit-message'
        }
        break
      case '--message-id':
        config.messageId = args[++i]
        break
      case '-h':
      case '--help':
        console.log(`
Chat API Test Script

Usage: bun scripts/chat-cli.ts [options]

Options:
  -m, --message <text>    Message to send (default: "Hello, how are you?")
  -u, --url <url>         API URL (default: http://localhost:3000/api/chat)
  -c, --chat-id <id>      Chat ID (default: auto-generated)
  -s, --search            Enable search mode with adaptive strategy (default)
  --no-search             Disable search mode
  --search-mode <type>    Search strategy: quick, planning, or adaptive
  --model-type <type>     Model type: speed (default) or quality
  -t, --trigger <type>    Trigger type: submit (default) or regenerate
  --message-id <id>       Message ID (required for regenerate)
  -h, --help              Show this help message

Examples:
  # Simple test
  bun scripts/chat-cli.ts -m "What is the weather like?"
  
  # Without search mode
  bun scripts/chat-cli.ts -m "Tell me a joke" --no-search
  
  # With quality model type
  bun scripts/chat-cli.ts -m "Tell me a joke" --model-type quality
  
  # Continue existing chat
  bun scripts/chat-cli.ts -c "chat_123" -m "Tell me more"
  
  # Regenerate assistant message
  bun scripts/chat-cli.ts -c "chat_123" -t regenerate --message-id "msg_123"
  
  # Edit user message and regenerate
  bun scripts/chat-cli.ts -c "chat_123" -t regenerate --message-id "msg_123" -m "New message"
  
Note: Without authentication, you may get "User not authenticated" errors.

Authentication:

1. Add to .env.local: MORPHIC_COOKIES="your-cookie-string"
2. The script will automatically load cookies when it runs

To get cookies:
1. Open DevTools > Network tab
2. Make any request in Morphic
3. Click on the request > Headers > Request Headers > Cookie
4. Copy the entire Cookie value
5. Add to .env.local as MORPHIC_COOKIES="copied-value"
`)
        process.exit(0)
    }
  }

  return config
}

// Main execution
async function main() {
  const config = parseArgs()
  const tester = new ChatApiTester(config)

  await tester.sendMessage(config.message)
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
