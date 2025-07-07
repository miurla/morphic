import { Lesson } from './schema'

export const chatIntegratedLesson: Lesson = {
  id: 'chat-integrated-demo',
  title: '🚀 Chat-Integrated Learning Demo',
  description: 'Experience learning directly in the chat interface with morphing UI transitions',
  language: 'javascript',
  category: 'frontend',
  difficulty: 'beginner',
  estimatedDuration: 15,
  author: 'Educational AI System',
  version: '1.0.0',
  tags: ['chat-integration', 'morphing-ui', 'interactive', 'demo'],
  prerequisites: [],
  nextLessons: ['comprehensive-web-development-masterclass'],
  objectives: [
    'Experience chat-based learning workflow',
    'See interface morphing in real-time',
    'Complete interactive code exercises within chat',
    'Understand the chat artifact system'
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  steps: [
    {
      id: 'welcome-to-chat-learning',
      title: '🎉 Welcome to Chat-Based Learning!',
      type: 'instruction',
      content: `# Welcome to the Future of Learning!

You are now experiencing a **revolutionary educational interface** where lessons appear as **chat artifacts**, just like search results or images!

## 🌟 What Makes This Special:

### 💬 **Chat Integration**
- This lesson appears directly in your chat conversation
- No need to navigate away from the chat interface
- Ask questions and get immediate AI assistance

### 🔄 **Morphing Interface**
- Watch the interface smoothly transform between different modes
- **Chat Mode** for explanations and discussions
- **Editor Mode** for hands-on coding
- **Preview Mode** for seeing results

### 🧩 **Interactive Exercises**
- Code challenges appear as interactive artifacts in chat
- Real-time feedback and execution
- Progressive hints and personalized guidance

Ready to see this in action? Click "Next Step" to continue!`,
      order: 1,
      interactive: {
        requiresUserInput: false,
        estimatedTime: 2,
        hints: [
          'Notice how this lesson is rendered as a chat artifact',
          'The interface will automatically morph based on the lesson content',
          'You can ask questions about the lesson anytime!'
        ]
      }
    },
    {
      id: 'first-coding-challenge',
      title: '🧩 Your First Chat-Based Coding Challenge',
      type: 'code_exercise',
      content: `# 🎯 Interactive Coding Challenge

**AI Instructor**: Perfect! Now you'll see the interface **morph into editor mode** automatically. This is how our platform adapts to provide the best experience for each type of learning activity.

## 🎮 Your Challenge:
Create a simple function that greets a user with a personalized message.

## 📋 Requirements:
- Create a function called \`greetUser\`
- It should take a \`name\` parameter
- Return a string: "Hello, [name]! Welcome to chat-based learning!"

## 💡 Watch the Magic:
- The interface morphed to editor mode automatically
- You can write code directly in this chat artifact
- Click "Run Code" to execute and see results
- The preview will show in the next mode transition

Start coding below! 👇`,
      order: 2,
      interactive: {
        requiresUserInput: true,
        estimatedTime: 5,
        hints: [
          'Remember to use the "function" keyword',
          'Use template literals with ${} for string interpolation',
          'Test your function by calling it with a name'
        ]
      },
      code: {
        language: 'javascript',
        startingCode: `// Create your greetUser function here
function greetUser(name) {
  // Your code here
  
}

// Test your function
console.log(greetUser("Student"));`,
        solution: `function greetUser(name) {
  return \`Hello, \${name}! Welcome to chat-based learning!\`;
}

// Test your function
console.log(greetUser("Student"));`,
        expectedOutput: 'Hello, Student! Welcome to chat-based learning!'
      }
    },
    {
      id: 'morphing-demonstration',
      title: '🔄 Experience the Morphing Interface',
      type: 'explanation',
      content: `# 🎭 Interface Morphing in Action!

**AI Instructor**: Fantastic! Now you're experiencing the **preview mode**. Notice how the interface smoothly transitioned from:

1. **💬 Chat Mode** → Explanations and instructions
2. **💻 Editor Mode** → Hands-on coding experience  
3. **👁️ Preview Mode** → Results and visual output

## 🚀 What Just Happened:

### ✨ **Seamless Transitions**
- The interface automatically morphed based on content type
- No jarring page changes or context switching
- Your work is preserved across all modes

### 🎯 **Adaptive Learning**
- Each mode optimizes for specific learning activities
- Chat mode for conceptual understanding
- Editor mode for practice and application
- Preview mode for validation and results

### 🧠 **AI Integration**
- Your AI instructor adapts to your progress
- Get hints when you're stuck
- Ask questions in any mode
- Receive personalized feedback

## 🎉 Congratulations!
You've just experienced the core innovation of our educational platform - **learning that flows naturally within conversation**!

Ready for more advanced features? Try asking: "Show me the comprehensive web development lesson!"`,
      order: 3,
      interactive: {
        requiresUserInput: false,
        estimatedTime: 3,
        hints: [
          'Try switching between different modes using the tabs',
          'Notice how each mode provides different tools and perspectives',
          'This morphing approach reduces cognitive load and maintains flow'
        ]
      }
    }
  ]
}

export default chatIntegratedLesson
