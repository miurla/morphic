# CLAUDE.md - HAIF Chat Interface Context

This document provides essential context for Claude Code to understand and work effectively with the HAIF chat interface component (Hannah).

## Project Overview

**HAIF Chat Interface (Hannah)** is the conversational AI component of the Human AI Integration Framework, featuring "Hannah" - a voice-first AI assistant that helps users design and deploy custom AI workflows, assistants, and automated solutions.

### Hannah - The AI Assistant
Hannah is the core conversational AI that:
- Provides voice-first interaction experience via ElevenLabs
- Understands natural language workflow requests
- Invisibly triggers n8n workflows via webhook integration
- Maintains conversation context through RAG system (Qdrant)
- Guides users through AI adoption with human-friendly approach
- Offers "FastTracks" - pre-built workflows and assistants

### Core Purpose
This chat interface serves as the primary AI interaction point for:
- Natural language query processing
- Pre-made template query execution  
- Multi-agent workflow orchestration
- Real-time AI conversation and solution generation
- File upload and processing capabilities
- Workflow template library and management

### Relationship to Main Frontend
- **Main Frontend (haif-2)**: User management, dashboards, solution browsing
- **This Chat Interface**: AI interactions, workflow execution, solution generation
- **Production URLs**: app.humanaifusion.com or hannah.humanaifusion.com
- **Integration**: Shared authentication, synchronized data, embedded chat sessions

## Architecture & Tech Stack

### Framework & Core Technologies
- **Framework**: Next.js 14 with App Router
- **UI Library**: Radix UI components with Tailwind CSS
- **Real-time Communication**: WebSocket and Server-Sent Events
- **AI Integration**: ElevenLabs React SDK for voice AI
- **Database**: Supabase (shared with main frontend)
- **Package Manager**: pnpm
- **Animation**: Framer Motion
- **File Handling**: Custom upload and preview components

### Key Dependencies
```json
{
  "@elevenlabs/react": "latest",
  "@elevenlabs/elevenlabs-js": "latest",
  "next": "14.2.15",
  "react": "^18.3.1",
  "ws": "latest",
  "uuid": "latest",
  "zod": "latest"
}
```

### External Services Integration
- **n8n Workflows**: Self-hosted orchestration platform triggered via webhooks
- **Qdrant Vector Database**: RAG system for conversation memory and context
- **OpenWebUI**: Chat interface framework for Hannah assistant
- **ElevenLabs**: Voice synthesis and speech recognition
- **Supabase**: Shared database and authentication with main frontend

## Project Structure

```
haif-hannah/
├── app/                           # Next.js App Router
│   ├── api/                      # API endpoints
│   │   ├── analytics-socket/     # Real-time analytics WebSocket
│   │   ├── conversations/        # Chat conversation management
│   │   ├── upload/              # File upload handling
│   │   └── signed-url/          # Secure file URL generation
│   ├── talk-to-hannah/          # Main chat interface
│   ├── fasttrack/               # FastTrack solution templates
│   ├── projects/                # Project management
│   └── analytics/               # Chat analytics dashboard
├── components/                   # React components
│   ├── @11labs/                 # ElevenLabs voice integration
│   ├── talk-to-hannah.tsx       # Main chat component
│   ├── enhanced-talk-to-hannah.tsx # Advanced chat features
│   ├── fasttrack/               # FastTrack template components
│   ├── analytics/               # Analytics and metrics components
│   ├── sidebar/                 # Chat sidebar and navigation
│   └── ui/                      # UI component library
├── lib/                         # Core utilities and logic
│   ├── contexts/                # React context providers
│   ├── hooks/                   # Custom React hooks
│   ├── fasttrack/               # FastTrack solution templates
│   ├── supabase/                # Database client and types
│   ├── utils/                   # Helper utilities
│   └── workflow-templates.ts    # N8N workflow templates
└── docs/                        # Documentation
```

## Key Features & Functionality

### 1. Conversational AI Interface
- **Real-time chat**: Instant messaging with AI agents
- **Voice Integration**: ElevenLabs voice synthesis and recognition
- **Context Awareness**: Maintains conversation context and memory
- **Multi-modal Input**: Text, voice, and file inputs supported

### 2. Template Query System
- **FastTrack Solutions**: Pre-built solution templates for common use cases
- **Workflow Templates**: N8N workflow definitions for automation
- **Solution Categories**: Organized by industry and complexity level
- **Quick Start**: One-click template deployment and execution

### 3. Multi-Agent Workflows via n8n Integration
- **Invisible Webhook Triggers**: User chat input automatically triggers n8n workflows
- **Agent Orchestration**: Hannah coordinates multiple AI agents through n8n
- **Workflow Execution**: Self-hosted n8n instance processes complex automations
- **Human-in-the-Loop**: Approval points and human oversight integration
- **Result Processing**: Formats and presents agent outputs back through Hannah
- **RAG-Enhanced Context**: Qdrant provides historical memory and entity context

### 4. File Management
- **Upload Support**: Multiple file formats (images, documents, videos)
- **File Preview**: Built-in preview for common file types
- **Secure Storage**: Supabase storage with signed URLs
- **Processing Pipeline**: AI analysis of uploaded content

## Core Components

### Main Chat Interface (`talk-to-hannah.tsx`)
```typescript
interface TalkToHannahProps {
  initialMessages?: Message[]
  initialWorkflowCode?: string
  fasttrackSolution?: FastTrackSolution
  onWorkflowGenerated?: (workflow: string) => void
}
```

Key features:
- Auto-resizing textarea for user input
- Message history with timestamps and status
- Real-time typing indicators
- Voice recording and playback
- File upload and preview integration
- Workflow code generation and display

### FastTrack Solution Templates
```typescript
interface FastTrackSolution {
  id: string
  title: string
  description: string
  category: 'chatbot' | 'workflow' | 'integration' | 'automation'
  complexity: 'beginner' | 'intermediate' | 'advanced'
  estimatedTime: string
  requirements: string[]
  template: {
    workflowCode: any
    configuration: Record<string, any>
  }
  tags: string[]
}
```

Categories include:
- **Customer Service**: Chatbots, ticket systems, FAQ automation
- **Data Analysis**: Report generation, data processing, insights
- **Integration**: API connections, data synchronization
- **Automation**: Workflow orchestration, task automation

### Workflow Templates (`workflow-templates.ts`)
N8N workflow definitions for:
- Daily AI reports
- Data processing pipelines  
- Integration workflows
- Automation scripts
- Multi-agent coordination

## Development Patterns

### Message Handling
```typescript
interface Message {
  id: string
  content: string
  isFromAI: boolean
  timestamp: Date
  status?: 'sending' | 'sent' | 'error' | 'generating'
  attachments?: FileData[]
  workflowCode?: string
}
```

### Context Management
Multiple React contexts manage different aspects:
- `SidebarContext`: Chat sidebar state and conversations
- `AnalyticsContext`: Usage metrics and performance tracking
- `ConversationContext`: Active conversation state
- `OnboardingContext`: User onboarding and help system

### Real-time Communication
- WebSocket connections for live chat
- Server-Sent Events for workflow status updates
- Real-time analytics and metrics streaming
- Live collaboration features

## API Architecture

### Core API Routes

#### `/api/conversations`
- `GET`: Retrieve conversation history
- `POST`: Create new conversation
- `PUT`: Update conversation metadata
- `DELETE`: Archive conversation

#### `/api/upload`
- `POST`: Handle file uploads
- Supports multiple file types
- Returns secure file URLs
- Integrates with AI processing pipeline

#### `/api/analytics-socket`
- WebSocket endpoint for real-time analytics
- Streams usage metrics and performance data
- Handles user behavior tracking
- Provides real-time dashboard updates

#### `/api/signed-url`
- Generates secure URLs for file access
- Implements proper access control
- Handles expiration and refresh logic

## Environment Configuration

### Required Environment Variables
```bash
# Supabase Configuration (shared with main frontend)
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# ElevenLabs Voice AI
ELEVENLABS_API_KEY=<elevenlabs-api-key>
NEXT_PUBLIC_ELEVENLABS_AGENT_ID=<agent-id>

# n8n Workflow Integration
N8N_WEBHOOK_URL=<n8n-webhook-endpoint>
N8N_API_KEY=<n8n-api-key>
NEXT_PUBLIC_N8N_WEBHOOK_BASE=<webhook-base-url>

# Qdrant RAG System
QDRANT_URL=<qdrant-instance-url>
QDRANT_API_KEY=<qdrant-api-key>
QDRANT_COLLECTION_NAME=conversation_memory

# OpenWebUI Integration
OPENWEBUI_BASE_URL=<openwebui-instance>
OPENWEBUI_API_KEY=<openwebui-api-key>

# WebSocket Configuration
WS_PORT=3001
WS_HOST=localhost
```

### Development Setup
```bash
# Install dependencies
pnpm install

# Development server
pnpm dev

# Build for production  
pnpm build

# Setup phases (configuration)
pnpm setup:phase1  # Basic setup
pnpm setup:phase2  # Advanced features
pnpm validate:phase2  # Validate configuration
```

## Integration Patterns

### Authentication Flow
1. User authenticates in main frontend (haif-2)
2. Authentication token is shared with chat interface
3. Supabase handles cross-domain session management
4. User context is maintained across both applications

### Data Synchronization
- **Projects**: Created in main frontend, accessible in chat
- **Conversations**: Stored in shared Supabase database
- **Templates**: Managed in chat interface, browsable in main frontend
- **Analytics**: Aggregated across both applications

### Workflow Execution
1. User selects template or inputs natural language query
2. Chat interface processes request and determines workflow
3. N8N workflow is triggered with appropriate parameters
4. Real-time status updates provided to user
5. Results are formatted and presented in chat interface
6. Completed workflows are saved to user's project history

## Voice AI Integration

### ElevenLabs Integration
```typescript
import { useConversation } from "@/components/@11labs/react"

// Voice conversation setup
const conversation = useConversation({
  onMessage: (message) => {
    // Handle voice message
  },
  onError: (error) => {
    // Handle voice errors
  }
})
```

Features:
- Real-time voice synthesis
- Speech-to-text conversion
- Natural conversation flow
- Multi-language support
- Custom voice models

## Analytics & Monitoring

### User Behavior Tracking
- Conversation metrics and engagement
- Template usage and success rates
- Workflow execution performance
- User satisfaction and feedback

### Performance Metrics
- Message response times
- Voice AI latency measurements
- Workflow execution duration
- File upload and processing times

### Real-time Dashboard
- Live user activity monitoring
- System performance metrics
- Error tracking and alerting
- Usage analytics and trends

## Common Development Tasks

### Adding New Templates
1. Define template in `lib/fasttrack/solution-templates.ts`
2. Include workflow code and configuration
3. Add to appropriate category and complexity level
4. Create preview and documentation
5. Test template execution and validation

### Implementing New Chat Features
1. Update message interface with new properties
2. Modify chat component to handle new feature
3. Add appropriate UI controls and indicators
4. Implement backend API support if needed
5. Update context providers and state management

### Voice AI Enhancements
1. Configure ElevenLabs voice models
2. Implement custom voice commands
3. Add voice-specific UI feedback
4. Handle voice recognition errors gracefully
5. Optimize for different languages and accents

## Security Considerations

### Data Protection
- All chat data encrypted in transit and at rest
- File uploads scanned for malicious content
- User input sanitized to prevent injection attacks
- Secure WebSocket connections with proper authentication

### API Security
- Rate limiting on all endpoints
- Input validation with Zod schemas
- Proper error handling without information disclosure
- Secure file URL generation with expiration

## Performance Optimization

### Chat Performance
- Message virtualization for long conversations
- Lazy loading of conversation history
- Optimized real-time connection management
- Efficient file upload and preview handling

### Voice AI Optimization
- Audio compression and optimization
- Streaming voice synthesis
- Client-side audio processing
- Fallback to text when voice fails

## Testing Strategy

### Component Testing
- Chat interface component testing
- Message handling and state management
- Voice integration testing
- File upload and preview testing

### Integration Testing
- API endpoint testing
- WebSocket connection testing
- Voice AI integration testing
- Cross-component communication testing

## Troubleshooting

### Common Issues
- **Voice AI not working**: Check ElevenLabs API key and agent ID
- **WebSocket connection fails**: Verify WS configuration and firewall
- **File uploads failing**: Check Supabase storage permissions
- **Templates not loading**: Validate workflow template syntax

### Debug Tools
- Browser DevTools for WebSocket inspection
- Network tab for API request monitoring
- Console logs for error tracking
- Real-time analytics dashboard for performance metrics

## Business Context

### User Workflows
1. **Natural Language Queries**: Users input questions or requests
2. **Template Selection**: Users choose from pre-built solutions
3. **Workflow Execution**: AI agents process requests and generate solutions
4. **Result Review**: Users review and refine AI-generated outputs
5. **Project Integration**: Results are saved to user projects

### Success Metrics
- **User Engagement**: Messages per session, session duration
- **Template Usage**: Most popular templates, success rates
- **Workflow Performance**: Execution time, completion rates
- **User Satisfaction**: Feedback scores, retention rates

---

## Quick Reference

### Development Commands
```bash
pnpm dev                    # Start development server
pnpm build                  # Production build
pnpm setup:phase1          # Basic configuration
pnpm setup:phase2          # Advanced features
pnpm validate:config       # Validate configuration
```

### Key Files
- `components/talk-to-hannah.tsx` - Main chat interface
- `lib/fasttrack/solution-templates.ts` - Template definitions
- `lib/workflow-templates.ts` - N8N workflows
- `components/sidebar/sidebar-context.tsx` - Chat state management

### Integration Points
- Authentication shared with main frontend
- Database shared through Supabase
- File storage and processing pipeline
- Real-time analytics and monitoring

---

*This document should be updated as the project evolves. Last updated: August 2025*