# Hannah Chat Interface Design Specification
## Multi-Modal Claude AI-Like Experience for HumanAIFusion

---

## 🎯 **Design Philosophy**

### Core Principles
- **Human-Centric Design**: Every interaction should feel natural and intuitive
- **Multi-Modal First**: Seamlessly blend text, voice, file uploads, and visual outputs
- **Context Awareness**: Maintain conversation flow and agent memory
- **Progressive Enhancement**: Start simple, reveal complexity as needed
- **Accessibility by Design**: WCAG 2.1 AA compliance minimum

### Visual Identity
- **Primary Brand Colors**: Purple gradient (#7C4DFF to #3F51B5)
- **Secondary Colors**: Sky blue (#E3F2FD), Cloud white (#FAFAFA)
- **Typography**: Inter for UI, SF Pro for system elements
- **Tone**: Professional yet approachable, intelligent but not intimidating

---

## 🏗️ **Layout Structure**

### Container Architecture
```
┌─────────────────────────────────────────────────────────────┐
│ Header Bar (48px)                                           │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────┐ ┌───────────────────────────────────────┐ │
│ │ Sidebar (256px) │ │ Main Chat Area                        │ │
│ │                 │ │                                       │ │
│ │ - Conversations │ │ ┌───────────────────────────────────┐ │ │
│ │ - Hannah Status │ │ │ Message History (flex-grow)       │ │ │
│ │ - FastTrack     │ │ │                                   │ │ │
│ │ - Projects      │ │ │                                   │ │ │
│ │ - Settings      │ │ │                                   │ │ │
│ │                 │ │ └───────────────────────────────────┘ │ │
│ │                 │ │ ┌───────────────────────────────────┐ │ │
│ │                 │ │ │ Input Area (120px min)            │ │ │
│ │                 │ │ └───────────────────────────────────┘ │ │
│ └─────────────────┘ └───────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Responsive Breakpoints
- **Desktop**: ≥1024px - Full sidebar visible
- **Tablet**: 768px-1023px - Collapsible sidebar
- **Mobile**: <768px - Overlay sidebar, full-width chat

---

## 💬 **Message Components**

### Hannah Message Structure
```typescript
interface HannahMessage {
  id: string;
  type: 'assistant';
  content: TextContent | VoiceContent | MultiModalContent;
  timestamp: Date;
  status: 'sending' | 'delivered' | 'error';
  metadata: {
    model?: string;
    tokens?: number;
    processing_time?: number;
    voice_enabled?: boolean;
  };
}
```

### Visual Design - Hannah Messages
```css
.hannah-message {
  /* Layout */
  max-width: 85%;
  margin: 16px 0 16px 16px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  
  /* Avatar */
  .avatar {
    width: 40px;
    height: 40px;
    border-radius: 20px;
    background: linear-gradient(135deg, #7C4DFF 0%, #3F51B5 100%);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    
    .icon {
      width: 24px;
      height: 24px;
      color: white;
    }
  }
  
  /* Message Bubble */
  .bubble {
    background: #F8F9FA;
    border: 1px solid #E9ECEF;
    border-radius: 16px 16px 16px 4px;
    padding: 16px 20px;
    position: relative;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    
    /* Content styling */
    .content {
      font-size: 15px;
      line-height: 1.5;
      color: #212529;
      
      /* Markdown support */
      p { margin: 0 0 12px 0; }
      p:last-child { margin-bottom: 0; }
      
      code {
        background: #F1F3F4;
        padding: 2px 6px;
        border-radius: 4px;
        font-family: 'SF Mono', monospace;
        font-size: 14px;
      }
      
      pre {
        background: #F8F9FA;
        border: 1px solid #E9ECEF;
        border-radius: 8px;
        padding: 16px;
        overflow-x: auto;
        margin: 12px 0;
      }
    }
    
    /* Timestamp */
    .timestamp {
      font-size: 12px;
      color: #6C757D;
      margin-top: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
  }
}
```

### User Message Structure
```typescript
interface UserMessage {
  id: string;
  type: 'user';
  content: TextContent | VoiceContent | FileContent;
  timestamp: Date;
  status: 'sending' | 'delivered' | 'error';
}
```

### Visual Design - User Messages
```css
.user-message {
  /* Layout */
  max-width: 85%;
  margin: 16px 16px 16px 0;
  margin-left: auto;
  display: flex;
  align-items: flex-start;
  flex-direction: row-reverse;
  gap: 12px;
  
  /* Avatar */
  .avatar {
    width: 40px;
    height: 40px;
    border-radius: 20px;
    background: #DEE2E6;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    
    .icon {
      width: 24px;
      height: 24px;
      color: #6C757D;
    }
  }
  
  /* Message Bubble */
  .bubble {
    background: linear-gradient(135deg, #7C4DFF 0%, #3F51B5 100%);
    color: white;
    border-radius: 16px 16px 4px 16px;
    padding: 16px 20px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    
    .content {
      font-size: 15px;
      line-height: 1.5;
    }
    
    .timestamp {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.8);
      margin-top: 8px;
    }
  }
}
```

---

## 🎤 **Multi-Modal Capabilities**

### Voice Integration
```typescript
interface VoiceCapabilities {
  speech_to_text: {
    provider: 'ElevenLabs' | 'Whisper';
    real_time: boolean;
    languages: string[];
  };
  text_to_speech: {
    provider: 'ElevenLabs';
    voice_id: string; // Hannah's voice ID
    real_time: boolean;
    auto_play: boolean;
  };
}
```

### Voice Controls UI
```css
.voice-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  
  .voice-button {
    width: 40px;
    height: 40px;
    border-radius: 20px;
    border: none;
    background: #7C4DFF;
    color: white;
    cursor: pointer;
    transition: all 0.2s ease;
    
    &:hover {
      background: #6A1B9A;
      transform: scale(1.05);
    }
    
    &.recording {
      background: #F44336;
      animation: pulse 1.5s infinite;
    }
    
    &.processing {
      background: #FF9800;
      animation: spin 1s linear infinite;
    }
  }
  
  .voice-indicator {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: #6C757D;
    
    .dot {
      width: 4px;
      height: 4px;
      border-radius: 2px;
      background: #7C4DFF;
      
      &.active {
        animation: pulse 1s infinite;
      }
    }
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

### File Upload Integration
```typescript
interface FileUploadCapabilities {
  supported_types: string[];
  max_size: number; // in MB
  preview_generation: boolean;
  drag_drop: boolean;
  paste_support: boolean;
}
```

### File Upload UI
```css
.file-upload-area {
  border: 2px dashed #E9ECEF;
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  background: #F8F9FA;
  transition: all 0.2s ease;
  
  &.dragover {
    border-color: #7C4DFF;
    background: #F3E5F5;
  }
  
  .upload-icon {
    width: 48px;
    height: 48px;
    margin: 0 auto 16px;
    color: #6C757D;
  }
  
  .upload-text {
    font-size: 16px;
    color: #495057;
    margin-bottom: 8px;
  }
  
  .upload-hint {
    font-size: 14px;
    color: #6C757D;
  }
}

.file-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #F8F9FA;
  border: 1px solid #E9ECEF;
  border-radius: 8px;
  margin: 8px 0;
  
  .file-icon {
    width: 32px;
    height: 32px;
    color: #7C4DFF;
  }
  
  .file-info {
    flex: 1;
    
    .file-name {
      font-size: 14px;
      font-weight: 500;
      color: #212529;
    }
    
    .file-size {
      font-size: 12px;
      color: #6C757D;
    }
  }
  
  .remove-button {
    width: 24px;
    height: 24px;
    border: none;
    background: none;
    color: #6C757D;
    cursor: pointer;
    
    &:hover {
      color: #F44336;
    }
  }
}
```

---

## ⌨️ **Input Area Design**

### Input Container Structure
```css
.input-container {
  background: white;
  border-top: 1px solid #E9ECEF;
  padding: 16px 20px;
  min-height: 120px;
  
  .input-wrapper {
    position: relative;
    background: #F8F9FA;
    border: 1px solid #E9ECEF;
    border-radius: 12px;
    transition: all 0.2s ease;
    
    &:focus-within {
      border-color: #7C4DFF;
      box-shadow: 0 0 0 3px rgba(124, 77, 255, 0.1);
    }
    
    .textarea {
      width: 100%;
      min-height: 56px;
      max-height: 200px;
      border: none;
      background: transparent;
      padding: 16px 60px 16px 16px;
      font-size: 15px;
      line-height: 1.5;
      resize: none;
      outline: none;
      font-family: inherit;
      
      &::placeholder {
        color: #6C757D;
      }
    }
    
    .input-actions {
      position: absolute;
      right: 8px;
      bottom: 8px;
      display: flex;
      align-items: center;
      gap: 4px;
      
      .action-button {
        width: 32px;
        height: 32px;
        border: none;
        background: none;
        border-radius: 6px;
        color: #6C757D;
        cursor: pointer;
        transition: all 0.2s ease;
        
        &:hover {
          background: #E9ECEF;
          color: #495057;
        }
        
        &.send-button {
          background: #7C4DFF;
          color: white;
          
          &:hover {
            background: #6A1B9A;
          }
          
          &:disabled {
            background: #E9ECEF;
            color: #6C757D;
            cursor: not-allowed;
          }
        }
      }
    }
  }
  
  .input-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 12px;
    font-size: 12px;
    color: #6C757D;
    
    .shortcuts {
      display: flex;
      gap: 16px;
      
      .shortcut {
        display: flex;
        align-items: center;
        gap: 4px;
        
        .key {
          background: #E9ECEF;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: 'SF Mono', monospace;
          font-size: 11px;
        }
      }
    }
    
    .status-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      
      .status-dot {
        width: 8px;
        height: 8px;
        border-radius: 4px;
        background: #28A745;
        
        &.connecting { background: #FFC107; }
        &.error { background: #DC3545; }
      }
    }
  }
}
```

---

## 🎨 **Animation & Interactions**

### Message Animations
```css
/* Message fade-in animation */
@keyframes messageSlideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message {
  animation: messageSlideIn 0.3s ease-out;
}

/* Typing indicator */
.typing-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 16px 20px;
  
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 4px;
    background: #6C757D;
    animation: typingPulse 1.4s infinite ease-in-out;
    
    &:nth-child(1) { animation-delay: 0ms; }
    &:nth-child(2) { animation-delay: 160ms; }
    &:nth-child(3) { animation-delay: 320ms; }
  }
}

@keyframes typingPulse {
  0%, 60%, 100% {
    transform: scale(1);
    opacity: 0.5;
  }
  30% {
    transform: scale(1.2);
    opacity: 1;
  }
}

/* Message status animations */
.message-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  
  .status-icon {
    width: 12px;
    height: 12px;
    transition: all 0.2s ease;
    
    &.sending {
      color: #FFC107;
      animation: spin 1s linear infinite;
    }
    
    &.delivered {
      color: #28A745;
    }
    
    &.error {
      color: #DC3545;
    }
  }
}
```

### Hover Effects
```css
.message {
  position: relative;
  
  &:hover {
    .message-actions {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .message-actions {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    gap: 4px;
    opacity: 0;
    transform: translateY(-4px);
    transition: all 0.2s ease;
    
    .action-button {
      width: 28px;
      height: 28px;
      border: none;
      background: rgba(255, 255, 255, 0.9);
      border-radius: 6px;
      color: #6C757D;
      cursor: pointer;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      
      &:hover {
        background: white;
        color: #495057;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
      }
    }
  }
}
```

---

## ♿ **Accessibility Specifications**

### Keyboard Navigation
```typescript
interface KeyboardShortcuts {
  send_message: 'Ctrl+Enter' | 'Cmd+Enter';
  new_line: 'Shift+Enter';
  focus_input: '/';
  voice_toggle: 'Ctrl+M' | 'Cmd+M';
  file_upload: 'Ctrl+U' | 'Cmd+U';
  clear_input: 'Esc';
}
```

### ARIA Labels & Roles
```html
<!-- Message list -->
<div role="log" aria-live="polite" aria-label="Conversation with Hannah">
  
  <!-- Hannah message -->
  <div role="article" aria-labelledby="hannah-msg-1">
    <img src="hannah-avatar.png" alt="Hannah avatar" role="img">
    <div id="hannah-msg-1" aria-label="Message from Hannah">
      <!-- Message content -->
    </div>
    <time datetime="2024-01-15T10:30:00Z">10:30 AM</time>
  </div>
  
  <!-- User message -->
  <div role="article" aria-labelledby="user-msg-1">
    <div id="user-msg-1" aria-label="Your message">
      <!-- Message content -->
    </div>
    <time datetime="2024-01-15T10:31:00Z">10:31 AM</time>
  </div>
  
</div>

<!-- Input area -->
<form role="region" aria-label="Message composition">
  <textarea 
    aria-label="Type your message to Hannah"
    aria-describedby="input-help"
    rows="3"
    placeholder="Ask Hannah about your workflow needs...">
  </textarea>
  <div id="input-help" class="sr-only">
    Press Ctrl+Enter to send, Shift+Enter for new line
  </div>
  <button type="submit" aria-label="Send message">Send</button>
</form>
```

### Color Contrast Standards
```css
:root {
  /* Ensure 4.5:1 contrast ratio minimum */
  --text-primary: #212529;     /* On white: 16.07:1 */
  --text-secondary: #6C757D;   /* On white: 4.54:1 */
  --text-on-primary: #FFFFFF;  /* On #7C4DFF: 7.04:1 */
  --border-color: #E9ECEF;     /* Decorative only */
  --focus-ring: #7C4DFF;       /* 3px outline for focus */
}
```

---

## 📱 **Responsive Design**

### Mobile Optimizations
```css
@media (max-width: 767px) {
  .chat-container {
    .sidebar {
      position: fixed;
      top: 0;
      left: -256px;
      height: 100vh;
      z-index: 1000;
      transition: transform 0.3s ease;
      
      &.open {
        transform: translateX(256px);
      }
    }
    
    .main-area {
      width: 100%;
      padding: 0;
    }
    
    .message {
      max-width: 95%;
      margin-left: 8px;
      margin-right: 8px;
      
      .bubble {
        padding: 12px 16px;
        font-size: 14px;
      }
    }
    
    .input-container {
      padding: 12px 16px;
      
      .input-wrapper {
        .textarea {
          padding: 12px 48px 12px 12px;
          font-size: 16px; /* Prevent zoom on iOS */
        }
      }
    }
  }
}

/* Tablet adjustments */
@media (min-width: 768px) and (max-width: 1023px) {
  .chat-container {
    .sidebar {
      width: 200px;
    }
    
    .message {
      max-width: 90%;
    }
  }
}
```

---

## 🔧 **Technical Implementation**

### State Management
```typescript
interface ChatState {
  messages: Message[];
  isLoading: boolean;
  isTyping: boolean;
  error: string | null;
  voice: {
    isListening: boolean;
    isPlaying: boolean;
    isMuted: boolean;
  };
  ui: {
    sidebarOpen: boolean;
    inputHeight: number;
    scrollPosition: number;
  };
}

interface ChatActions {
  sendMessage: (content: string | File) => Promise<void>;
  startVoiceInput: () => void;
  stopVoiceInput: () => void;
  playVoiceResponse: (messageId: string) => void;
  uploadFile: (file: File) => Promise<void>;
  clearConversation: () => void;
  toggleSidebar: () => void;
}
```

### Performance Considerations
```typescript
// Virtual scrolling for large conversations
const MESSAGES_PER_PAGE = 50;
const MESSAGE_HEIGHT = 120; // Average height estimate

// Lazy loading for file previews
const useFilePreview = (file: File) => {
  const [preview, setPreview] = useState<string | null>(null);
  
  useEffect(() => {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  }, [file]);
  
  return preview;
};

// Debounced input handling
const useDebouncedInput = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  
  return debouncedValue;
};
```

---

## 🎯 **Success Metrics**

### User Experience Metrics
- **First Message Time**: <2 seconds from page load
- **Response Latency**: <500ms for text, <2s for voice
- **Accessibility Score**: WCAG 2.1 AA compliance (100%)
- **Mobile Usability**: 95+ Lighthouse score
- **Voice Recognition Accuracy**: >95% for clear speech

### Technical Performance
- **Bundle Size**: <500KB initial load
- **Memory Usage**: <50MB for 100 messages
- **Battery Impact**: Minimal (<5% per hour on mobile)
- **Network Efficiency**: <1KB per text message

---

## 📋 **Implementation Checklist**

### Phase 1: Core Chat
- [ ] Basic message display (Hannah & User)
- [ ] Input area with send functionality
- [ ] Message timestamps and status
- [ ] Responsive layout
- [ ] Basic accessibility

### Phase 2: Multi-Modal
- [ ] Voice input integration (ElevenLabs)
- [ ] Voice output with controls
- [ ] File upload with preview
- [ ] Image display and handling
- [ ] Advanced message types

### Phase 3: Enhanced UX
- [ ] Typing indicators
- [ ] Message animations
- [ ] Advanced keyboard shortcuts
- [ ] Context menus and actions
- [ ] Full accessibility audit

### Phase 4: Advanced Features
- [ ] Conversation search
- [ ] Message threading
- [ ] Real-time collaboration
- [ ] Advanced voice controls
- [ ] Performance optimizations

---

*This specification serves as the definitive guide for implementing Hannah's chat interface. All implementations should reference this document for consistency and quality standards.*