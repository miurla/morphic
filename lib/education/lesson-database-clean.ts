import { comprehensiveSampleLesson } from './comprehensive-sample-lesson'
import { LessonSchema, type Lesson } from './schema'

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
  'comprehensive-sample-lesson': comprehensiveSampleLesson,
  
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
