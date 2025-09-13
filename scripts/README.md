# Scripts

This directory contains utility scripts for testing and development.

## chat-cli.ts

A command-line interface for testing the chat API without a browser client. This script allows you to interact with the chat API directly, making it easier to debug server-side issues and test API functionality.

### Features

- Send messages to the chat API via command line
- Real-time Server-Sent Events (SSE) streaming output
- Support for model types (speed/quality) with automatic model selection
- Configurable search modes (quick/planning/adaptive) or disabled
- Chat session continuity
- Message regeneration support
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

# Use quality model type for better responses
bun chat -m "Explain quantum computing" --model-type quality

# Use planning search mode for complex queries
bun chat -m "Research the latest AI developments" --search-mode planning

# Continue an existing chat
bun chat -c "chat_123" -m "Tell me more"

# Regenerate the last assistant message
bun chat -c "chat_123" -t regenerate --message-id "msg_456"

# Show help
bun chat --help
```

### Options

- `-m, --message <text>` - Message to send (default: "Hello, how are you?")
- `-u, --url <url>` - API URL (default: http://localhost:3000/api/chat, localhost only)
- `-c, --chat-id <id>` - Chat ID for session continuity (default: auto-generated)
- `-s, --search` - Enable search mode with adaptive strategy (default)
- `--no-search` - Disable search mode
- `--search-mode <type>` - Search strategy: `quick`, `planning`, or `adaptive`
- `--model-type <type>` - Model type: `speed` (default) or `quality`
- `-t, --trigger <type>` - Trigger type: `submit` (default) or `regenerate`
- `--message-id <id>` - Message ID (required for regenerate trigger)
- `-h, --help` - Show help message

### Output Format

The script displays:

- 🚀 Request details
- 🤖 Model type (speed/quality)
- 🔍 Search mode status (quick/planning/adaptive/disabled)
- 💬 Chat ID for reference
- Real-time AI responses with proper formatting
- 🔧 Tool usage (when search mode is enabled)
- ✅ Completion status

### Model Types

- **speed**: Fast responses using optimized models (default)
- **quality**: Higher quality responses using advanced models

### Search Modes

- **quick**: Fast search with basic results
- **planning**: Comprehensive search for complex queries
- **adaptive**: Intelligent search strategy based on query type (default)
- **disabled**: No search functionality (`--no-search`)

### Advanced Usage

#### Message Regeneration

You can regenerate the last assistant message in a conversation:

```bash
# First, send a message and note the chat ID and message ID from the output
bun chat -m "Tell me about AI"

# Then regenerate the assistant's response
bun chat -c "chat_123" -t regenerate --message-id "msg_456"

# Or edit the user message and regenerate
bun chat -c "chat_123" -t regenerate --message-id "msg_456" -m "Tell me about machine learning instead"
```

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

#### Authentication Errors

If you encounter "User not authenticated" errors:

1. Ensure you're logged into Morphic in your browser
2. Get fresh cookies from DevTools
3. Update `MORPHIC_COOKIES` in `.env.local`
4. Cookies expire after ~1 hour, so refresh them if needed

#### API Errors

If you encounter "Selected provider is not enabled" errors:

1. Check that the model type is correctly configured in your system
2. Verify the development server supports the requested model type
3. Try switching between `--model-type speed` and `--model-type quality`

#### General Issues

- Check the development server is running: `bun dev`
- Verify `.env.local` exists and contains `MORPHIC_COOKIES`
- Use `DEBUG=1` prefix for verbose output
- Ensure the API URL is accessible (default: `http://localhost:3000/api/chat`)

#### Command Examples for Testing

```bash
# Test basic functionality
bun chat -m "Hello, test message" --no-search

# Test with quality model
bun chat -m "Complex analysis task" --model-type quality --search-mode planning

# Debug mode
DEBUG=1 bun chat -m "Debug test" --model-type speed
```
