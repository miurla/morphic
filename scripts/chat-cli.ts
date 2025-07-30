#!/usr/bin/env tsx

import { config as dotenvConfig } from 'dotenv'
import { Readable } from 'stream'

// Load environment variables from .env.local
dotenvConfig({ path: '.env.local' })

interface ChatApiConfig {
  apiUrl: string
  message: string
  chatId?: string
  selectedModel?: {
    id: string
    name: string
    provider: string
    providerId: string
    enabled: boolean
    toolCallType: string
  }
  searchMode?: boolean
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
        parsed.hostname.startsWith('10.') ||
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
      message: config.message || 'Hello, how are you?',
      chatId: config.chatId || this.generateId(),
      selectedModel: config.selectedModel || {
        id: 'gpt-4o-mini',
        name: 'GPT-4o mini',
        provider: 'OpenAI',
        providerId: 'openai',
        enabled: true,
        toolCallType: 'native'
      },
      searchMode: config.searchMode ?? true
    }
  }

  private generateId(): string {
    return `chat_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  }

  private createUserMessage(text: string): UIMessage {
    // Limit message length for safety
    const sanitizedText = text.slice(0, 10000)

    return {
      id: this.generateId(),
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
    const userMessage = this.createUserMessage(message || this.config.message)

    // Load cookies from env
    const cookies = this.loadCookiesFromEnv()

    const payload = {
      message: userMessage,
      chatId: this.config.chatId,
      trigger: 'submit-user-message'
    }

    console.log('🚀 Sending request to:', this.config.apiUrl)
    console.log('📦 Payload:', JSON.stringify(payload, null, 2))
    console.log('🤖 Selected Model:', this.config.selectedModel?.name)
    console.log('🔍 Search Mode:', this.config.searchMode)
    console.log('💬 Chat ID:', this.config.chatId)
    console.log('\n---\n')

    const headers = {
      'Content-Type': 'application/json',
      Cookie:
        cookies ||
        [
          `selectedModel=${encodeURIComponent(JSON.stringify(this.config.selectedModel))}`,
          `search-mode=${this.config.searchMode}`
        ]
          .filter(Boolean)
          .join('; ')
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
      const nodeReadable = Readable.fromWeb(response.body as any)

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
        config.searchMode = true
        break
      case '--no-search':
        config.searchMode = false
        break
      case '--model':
        const modelId = args[++i]
        // Map common model names
        const modelMap: Record<string, any> = {
          'gpt-4o': {
            id: 'gpt-4o',
            name: 'GPT-4o',
            provider: 'OpenAI',
            providerId: 'openai',
            enabled: true,
            toolCallType: 'native'
          },
          'gpt-4o-mini': {
            id: 'gpt-4o-mini',
            name: 'GPT-4o mini',
            provider: 'OpenAI',
            providerId: 'openai',
            enabled: true,
            toolCallType: 'native'
          },
          'claude-3-5-sonnet': {
            id: 'claude-3-5-sonnet-latest',
            name: 'Claude 3.5 Sonnet',
            provider: 'Anthropic',
            providerId: 'anthropic',
            enabled: true,
            toolCallType: 'native'
          }
        }
        config.selectedModel = modelMap[modelId] || modelMap['gpt-4o-mini']
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
  -s, --search            Enable search mode (default: true)
  --no-search             Disable search mode
  --model <name>          Model to use: gpt-4o, gpt-4o-mini, claude-3-5-sonnet
  -h, --help              Show this help message

Examples:
  # Simple test
  bun scripts/chat-cli.ts -m "What is the weather like?"
  
  # Without search mode
  bun scripts/chat-cli.ts -m "Tell me a joke" --no-search
  
  # With specific model
  bun scripts/chat-cli.ts -m "Tell me a joke" --model claude-3-5-sonnet
  
  # Continue existing chat
  bun scripts/chat-cli.ts -c "chat_123" -m "Tell me more"
  
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

  await tester.sendMessage()
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
