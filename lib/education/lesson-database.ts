import { LessonSchema, type Lesson } from './schema'

// Simple comprehensive sample lesson for immediate testing
const comprehensiveSampleLessonSimple: Lesson = {
  id: 'comprehensive-web-development-masterclass',
  title: '🚀 Interactive Web Development Masterclass',
  description: 'Experience the future of learning with chat-based education, morphing interfaces, and AI-powered personalization. This lesson demonstrates all major platform features.',
  language: 'javascript',
  category: 'fullstack',
  difficulty: 'intermediate',
  estimatedDuration: 45,
  author: 'AI Educational Platform',
  version: '2.0.0',
  tags: ['comprehensive', 'interactive', 'chat-based', 'morphing-ui', 'ai-powered'],
  prerequisites: ['html-basics', 'css-fundamentals', 'javascript-variables'],
  nextLessons: ['react-introduction', 'advanced-javascript'],
  objectives: [
    'Master chat-based learning workflow with AI assistance',
    'Experience morphing interface transitions in real-time',
    'Solve interactive code challenges with instant feedback',
    'Build complete interactive web application',
    'Understand modern web development patterns'
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  steps: [
    {
      id: 'welcome-to-future-learning',
      title: '🎯 Welcome to the Future of Learning',
      type: 'instruction',
      content: `# Welcome to Interactive Learning Revolution!

This comprehensive lesson showcases our platform's **three revolutionary features**:

## 🗣️ **1. Chat Interface Integration**
- **Natural Conversations**: Ask questions and get instant AI responses
- **Contextual Learning**: Lessons appear as chat artifacts, just like search results
- **Seamless Flow**: No context switching between chat and learning

## 🧩 **2. Interactive Code Puzzles in Chat**
- **Real-time Challenges**: Code puzzles appear directly in chat conversation
- **Instant Feedback**: See results immediately as you type
- **Progressive Hints**: AI provides personalized guidance when you're stuck

## 🔄 **3. Morphing Interface**
- **Smooth Transitions**: Watch the interface transform from chat to editor to preview
- **Adaptive Layout**: UI adapts to your current learning needs
- **Gesture Navigation**: Intuitive controls for mobile and desktop

Ready to experience the future of learning? Let's begin!`,
      order: 1,
      interactive: {
        requiresUserInput: false,
        estimatedTime: 3,
        hints: [
          'This lesson adapts to your learning style - ask questions anytime!',
          'The morphing interface will guide you through different learning modes',
          'Your AI tutor is always available for personalized help'
        ]
      }
    },
    {
      id: 'interactive-code-puzzle-demo',
      title: '🧩 Interactive Code Puzzle Demo',
      type: 'code_exercise',
      content: `# Experience Code Puzzles as Chat Artifacts!

🎉 **You're now seeing a code puzzle rendered as a chat artifact** - just like search results or images appear in chat conversations.

## 🎯 **Your Challenge**
Create a simple interactive greeting that demonstrates the chat integration.

**💡 Notice:** This code editor appears inline with your conversation, providing seamless learning without context switching.`,
      order: 2,
      code: {
        language: 'html',
        startingCode: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chat Integration Demo</title>
    <style>
        body {
            font-family: 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 20px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .demo-container {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            padding: 40px;
            text-align: center;
            max-width: 500px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            margin-bottom: 20px;
            animation: bounce 2s infinite;
        }
        @keyframes bounce {
            0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
            40% { transform: translateY(-10px); }
            60% { transform: translateY(-5px); }
        }
        .interactive-btn {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 25px;
            font-size: 16px;
            cursor: pointer;
            transition: all 0.3s ease;
            margin-top: 20px;
        }
        .interactive-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(0,0,0,0.2);
        }
    </style>
</head>
<body>
    <div class="demo-container">
        <h1>🎉 Hello, Interactive Learning!</h1>
        <p>This code editor is a <strong>chat artifact</strong> - it appears seamlessly in your conversation!</p>
        <button class="interactive-btn" onclick="showMorphing()">
            🔄 Demonstrate Morphing Interface
        </button>
        <div id="morphing-demo" style="margin-top: 20px; font-style: italic; color: #666;"></div>
    </div>

    <script>
        function showMorphing() {
            const demo = document.getElementById('morphing-demo');
            const container = document.querySelector('.demo-container');
            
            // Simulate morphing interface states
            const states = [
                '💬 Chat Mode: Learning Interface',
                '💻 Editor Mode: Focused Coding',
                '👁️ Preview Mode: Live Results',
                '🎯 Learning Mode: Interactive Lesson'
            ];
            
            let currentState = 0;
            demo.textContent = states[currentState];
            
            const interval = setInterval(() => {
                currentState = (currentState + 1) % states.length;
                demo.textContent = states[currentState];
                
                // Add visual morphing effect
                container.style.transform = 'scale(0.98)';
                setTimeout(() => {
                    container.style.transform = 'scale(1)';
                }, 200);
                
                if (currentState === 0) {
                    clearInterval(interval);
                }
            }, 1500);
        }
    </script>
</body>
</html>`,
        solution: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chat Integration Demo</title>
    <style>
        body {
            font-family: 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 20px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .demo-container {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            padding: 40px;
            text-align: center;
            max-width: 500px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            margin-bottom: 20px;
            animation: bounce 2s infinite;
        }
        @keyframes bounce {
            0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
            40% { transform: translateY(-10px); }
            60% { transform: translateY(-5px); }
        }
        .interactive-btn {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 25px;
            font-size: 16px;
            cursor: pointer;
            transition: all 0.3s ease;
            margin-top: 20px;
        }
        .interactive-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(0,0,0,0.2);
        }
    </style>
</head>
<body>
    <div class="demo-container">
        <h1>🎉 Hello, Interactive Learning!</h1>
        <p>This code editor is a <strong>chat artifact</strong> - it appears seamlessly in your conversation!</p>
        <button class="interactive-btn" onclick="showMorphing()">
            🔄 Demonstrate Morphing Interface
        </button>
        <div id="morphing-demo" style="margin-top: 20px; font-style: italic; color: #666;"></div>
    </div>

    <script>
        function showMorphing() {
            const demo = document.getElementById('morphing-demo');
            const container = document.querySelector('.demo-container');
            
            // Simulate morphing interface states
            const states = [
                '💬 Chat Mode: Learning Interface',
                '💻 Editor Mode: Focused Coding',
                '👁️ Preview Mode: Live Results',
                '🎯 Learning Mode: Interactive Lesson'
            ];
            
            let currentState = 0;
            demo.textContent = states[currentState];
            
            const interval = setInterval(() => {
                currentState = (currentState + 1) % states.length;
                demo.textContent = states[currentState];
                
                // Add visual morphing effect
                container.style.transform = 'scale(0.98)';
                setTimeout(() => {
                    container.style.transform = 'scale(1)';
                }, 200);
                
                if (currentState === 0) {
                    clearInterval(interval);
                }
            }, 1500);
        }
    </script>
</body>
</html>`,
        expectedOutput: 'Interactive demo showing chat artifact integration and morphing interface'
      },
      interactive: {
        requiresUserInput: true,
        estimatedTime: 10,
        hints: [
          'Notice how this code editor appears as a chat artifact',
          'Click the button to see the morphing demo in action',
          'This demonstrates seamless integration between chat and learning'
        ]
      }
    },
    {
      id: 'congratulations-finale',
      title: '🎉 Congratulations!',
      type: 'instruction',
      content: `# 🎉 You've Experienced the Future of Learning!

## ✅ **What You've Accomplished:**

### 💬 **Chat Interface Integration**
- ✅ Experienced lessons as chat artifacts
- ✅ Learned through natural conversation flow
- ✅ Seamless integration with AI assistance

### 🧩 **Interactive Code Puzzles**
- ✅ Solved challenges that appeared in chat
- ✅ Got real-time feedback on your code
- ✅ Progressive learning with personalized hints

### 🔄 **Morphing Interface**
- ✅ Watched smooth transitions between modes
- ✅ Experienced adaptive UI that responds to your actions

## 🚀 **Next Steps**

**Try these AI commands in chat:**
1. "Show me more JavaScript lessons"
2. "Explain how the morphing interface works"
3. "Help me build a React component"
4. "What should I learn next?"

**🎉 Welcome to the future of learning!** This platform combines AI assistance, interactive learning, and modern web technology to create an experience that adapts to how you learn best.`,
      order: 3,
      interactive: {
        requiresUserInput: false,
        estimatedTime: 5,
        hints: [
          'Try the AI commands in chat to see the full integration',
          'Your progress is saved and the AI remembers your learning style',
          'This is just the beginning - explore more advanced features!'
        ]
      }
    }
  ]
}

// Lesson Database Interface
export interface LessonDatabase {
  getAllLessons(): Promise<Lesson[]>
  getLessonById(id: string): Promise<Lesson | null>
  getLessonsByCategory(category: string): Promise<Lesson[]>
  getLessonsByDifficulty(difficulty: 'beginner' | 'intermediate' | 'advanced'): Promise<Lesson[]>
  getLessonsByLanguage(language: string): Promise<Lesson[]>
  searchLessons(query: string): Promise<Lesson[]>
  createLesson(lesson: Lesson): Promise<Lesson>
  updateLesson(id: string, lesson: Partial<Lesson>): Promise<Lesson>
  deleteLesson(id: string): Promise<boolean>
}

// Lesson content with the comprehensive sample lesson
const LESSON_CONTENT: Record<string, Lesson> = {
  'comprehensive-web-development-masterclass': comprehensiveSampleLessonSimple,
  
  'html-basics': {
    id: 'html-basics',
    title: 'HTML Basics: Building Your First Webpage',
    description: 'Learn the fundamentals of HTML markup language and create your first webpage from scratch.',
    language: 'html',
    category: 'frontend',
    difficulty: 'beginner',
    estimatedDuration: 25,
    objectives: [
      'Understand what HTML is and how it works',
      'Learn basic HTML structure and syntax',
      'Create headings, paragraphs, and lists',
      'Add links and images to your webpage',
      'Build a complete HTML page'
    ],
    prerequisites: [],
    nextLessons: ['css-fundamentals', 'html-forms'],
    tags: ['html', 'web', 'markup', 'frontend'],
    author: 'Educational AI',
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    steps: [
      {
        id: 'step-1',
        title: 'What is HTML?',
        type: 'instruction',
        content: `# What is HTML?

HTML (HyperText Markup Language) is the standard markup language for creating web pages. It describes the structure and content of a webpage using elements and tags.

## Key Concepts:
- **Elements**: Building blocks of HTML (like headings, paragraphs, images)
- **Tags**: Markup that defines elements (like <h1>, <p>, <img>)
- **Attributes**: Additional information about elements (like src, href)

Let's start building your first webpage!`,
        order: 1,
        interactive: {
          requiresUserInput: false,
          estimatedTime: 5
        },
        narration: {
          text: 'Welcome to HTML basics! HTML is the foundation of all web pages. Think of it as the skeleton that gives structure to web content.',
          speed: 1.0
        }
      },
      {
        id: 'step-2',
        title: 'Basic HTML Structure',
        type: 'code_exercise',
        content: `# Basic HTML Structure

Every HTML document follows a standard structure. Let's create your first HTML page!`,
        order: 2,
        interactive: {
          requiresUserInput: true,
          estimatedTime: 10,
          hints: [
            'Start with <!DOCTYPE html>',
            'Add <html>, <head>, and <body> tags',
            'Include a <title> in the head section'
          ]
        },
        code: {
          language: 'html',
          startingCode: `<!DOCTYPE html>
<html>
<head>
    <!-- Add your title here -->
</head>
<body>
    <!-- Add your content here -->
</body>
</html>`,
          solution: `<!DOCTYPE html>
<html>
<head>
    <title>My First Web Page</title>
</head>
<body>
    <h1>Hello World!</h1>
    <p>This is my first HTML page.</p>
</body>
</html>`,
          expectedOutput: "A basic HTML page with a title, heading, and paragraph"
        }
      }
    ]
  },

  'javascript-introduction': {
    id: 'javascript-introduction',
    title: 'JavaScript Introduction: Your First Programming Steps',
    description: 'Learn JavaScript fundamentals with hands-on examples and interactive exercises.',
    language: 'javascript',
    category: 'frontend',
    difficulty: 'beginner',
    estimatedDuration: 30,
    objectives: [
      'Understand what JavaScript is and why it\'s important',
      'Learn basic JavaScript syntax and concepts',
      'Work with variables and data types',
      'Create simple functions',
      'Practice with interactive exercises'
    ],
    prerequisites: [],
    nextLessons: ['javascript-dom', 'javascript-events'],
    tags: ['javascript', 'programming', 'web', 'fundamentals'],
    author: 'Educational AI',
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    steps: [
      {
        id: 'step-1',
        title: 'What is JavaScript?',
        type: 'instruction',
        content: `# What is JavaScript?

JavaScript is a powerful programming language that makes web pages interactive. It's one of the core technologies of the web, alongside HTML and CSS.

## What JavaScript Can Do:
- **Add interactivity** to web pages
- **Respond to user actions** (clicks, typing, scrolling)
- **Manipulate content** dynamically
- **Communicate with servers** to fetch data
- **Create animations** and visual effects

## Why Learn JavaScript?
- It's the **only programming language** that runs natively in web browsers
- **High demand** in the job market
- **Versatile** - works for web, mobile, desktop, and server applications
- **Great for beginners** - you can see results immediately

Let's start coding!`,
        order: 1,
        interactive: {
          requiresUserInput: false,
          estimatedTime: 5
        },
        narration: {
          text: 'JavaScript is the programming language that brings web pages to life. It\'s everywhere on the modern web and is a great first language to learn.',
          speed: 1.0
        }
      },
      {
        id: 'step-2',
        title: 'Variables and Data Types',
        type: 'code_exercise',
        content: `# Variables and Data Types

Variables are containers for storing data values. JavaScript has several data types including strings, numbers, and booleans.

Let's practice creating variables!`,
        order: 2,
        interactive: {
          requiresUserInput: true,
          estimatedTime: 10,
          hints: [
            'Use let or const to declare variables',
            'Strings are enclosed in quotes',
            'Numbers don\'t need quotes',
            'Booleans are true or false'
          ]
        },
        code: {
          language: 'javascript',
          startingCode: `// Create variables here
let name = ""; // String
let age = 0; // Number
let isStudent = false; // Boolean

// Display the variables
console.log("Name:", name);
console.log("Age:", age);
console.log("Is Student:", isStudent);`,
          solution: `// Create variables here
let name = "Alex"; // String
let age = 25; // Number
let isStudent = true; // Boolean

// Display the variables
console.log("Name:", name);
console.log("Age:", age);
console.log("Is Student:", isStudent);`,
          expectedOutput: "Variables should be assigned meaningful values and logged to console"
        }
      }
    ]
  }
}

// In-memory implementation of the lesson database
class InMemoryLessonDatabase implements LessonDatabase {
  private lessons: Record<string, Lesson> = LESSON_CONTENT

  async getAllLessons(): Promise<Lesson[]> {
    return Object.values(this.lessons)
  }

  async getLessonById(id: string): Promise<Lesson | null> {
    return this.lessons[id] || null
  }

  async getLessonsByCategory(category: string): Promise<Lesson[]> {
    return Object.values(this.lessons).filter(lesson => lesson.category === category)
  }

  async getLessonsByDifficulty(difficulty: 'beginner' | 'intermediate' | 'advanced'): Promise<Lesson[]> {
    return Object.values(this.lessons).filter(lesson => lesson.difficulty === difficulty)
  }

  async getLessonsByLanguage(language: string): Promise<Lesson[]> {
    return Object.values(this.lessons).filter(lesson => lesson.language === language)
  }

  async searchLessons(query: string): Promise<Lesson[]> {
    const lowercaseQuery = query.toLowerCase()
    return Object.values(this.lessons).filter(lesson => 
      lesson.title.toLowerCase().includes(lowercaseQuery) ||
      lesson.description.toLowerCase().includes(lowercaseQuery) ||
      lesson.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
    )
  }

  async createLesson(lesson: Lesson): Promise<Lesson> {
    // Validate lesson with schema
    const validatedLesson = LessonSchema.parse(lesson)
    this.lessons[validatedLesson.id] = validatedLesson
    return validatedLesson
  }

  async updateLesson(id: string, lessonUpdate: Partial<Lesson>): Promise<Lesson> {
    const existingLesson = this.lessons[id]
    if (!existingLesson) {
      throw new Error(`Lesson with id ${id} not found`)
    }
    
    const updatedLesson = { ...existingLesson, ...lessonUpdate }
    const validatedLesson = LessonSchema.parse(updatedLesson)
    this.lessons[id] = validatedLesson
    return validatedLesson
  }

  async deleteLesson(id: string): Promise<boolean> {
    if (this.lessons[id]) {
      delete this.lessons[id]
      return true
    }
    return false
  }
}

// Export the database instance
export const lessonDatabase = new InMemoryLessonDatabase()

// Export individual functions for backward compatibility
export const getAllLessons = () => lessonDatabase.getAllLessons()
export const getLessonById = (id: string) => lessonDatabase.getLessonById(id)
export const getLessonsByCategory = (category: string) => lessonDatabase.getLessonsByCategory(category)
export const getLessonsByDifficulty = (difficulty: 'beginner' | 'intermediate' | 'advanced') => lessonDatabase.getLessonsByDifficulty(difficulty)
export const getLessonsByLanguage = (language: string) => lessonDatabase.getLessonsByLanguage(language)
export const searchLessons = (query: string) => lessonDatabase.searchLessons(query)
export const createLesson = (lesson: Lesson) => lessonDatabase.createLesson(lesson)
export const updateLesson = (id: string, lesson: Partial<Lesson>) => lessonDatabase.updateLesson(id, lesson)
export const deleteLesson = (id: string) => lessonDatabase.deleteLesson(id)
