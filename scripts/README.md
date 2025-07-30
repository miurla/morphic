# Scripts

This directory contains utility scripts for testing and development.

## chat-cli.ts

A command-line interface for testing the chat API without a browser client. This script allows you to interact with the chat API directly, making it easier to debug server-side issues and test API functionality.

### Features

- Send messages to the chat API via command line
- Real-time Server-Sent Events (SSE) streaming output
- Support for different AI models
- Search mode enabled by default
- Chat session continuity
- Secure authentication via environment variables
- URL validation for security (localhost only)

### Setup

1. **Add authentication to `.env.local`**:
   ```env
   MORPHIC_COOKIES="your-cookie-string-here"
   ```

### Usage

```bash
# Using npm script (recommended)
bun chat -m "Hello, how are you?"

# Direct usage
bun scripts/chat-cli.ts -m "Hello, how are you?"

# Disable search mode
bun chat -m "Tell me a joke" --no-search

# Use a specific model
bun chat -m "Explain quantum computing" --model claude-3-5-sonnet

# Continue an existing chat
bun chat -c "chat_123" -m "Tell me more"

# Show help
bun chat --help
```

### Options

- `-m, --message <text>` - Message to send (default: "Hello, how are you?")
- `-u, --url <url>` - API URL (default: http://localhost:3000/api/chat, localhost only)
- `-c, --chat-id <id>` - Chat ID for session continuity (default: auto-generated)
- `-s, --search` - Enable search mode (default: true)
- `--no-search` - Disable search mode
- `--model <name>` - AI model to use: `gpt-4o`, `gpt-4o-mini`, `claude-3-5-sonnet`
- `-h, --help` - Show help message

### Output Format

The script displays:

- 🚀 Request details
- 🤖 Selected model
- 🔍 Search mode status
- 💬 Chat ID for reference
- Real-time AI responses with proper formatting
- 🔧 Tool usage (when search mode is enabled)
- ✅ Completion status

### Security Features

- **Authentication**: Uses environment variables only (no file-based auth)
- **URL Validation**: Only allows localhost and local network URLs
- **No Sensitive Logging**: Cookies are never displayed in logs
- **Input Sanitization**: Message length limited to 10,000 characters

### Requirements

- Bun runtime
- Local development server running (`bun dev`)
- Valid authentication cookies in `.env.local`

### Troubleshooting

If you encounter "User not authenticated" errors:

1. Ensure you're logged into Morphic in your browser
2. Get fresh cookies from DevTools
3. Update `MORPHIC_COOKIES` in `.env.local`
4. Cookies expire after ~1 hour, so refresh them if needed

For other issues:

- Check the development server is running: `bun dev`
- Verify `.env.local` exists and contains `MORPHIC_COOKIES`
- Use `DEBUG=1` prefix for verbose output
