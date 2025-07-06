import { LessonSchema, LessonStepSchema, LessonProgressSchema } from './schema'
import { z } from 'zod'

// Type definitions
export type Lesson = z.infer<typeof LessonSchema>
export type LessonStep = z.infer<typeof LessonStepSchema>
export type Progress = z.infer<typeof LessonProgressSchema>

// Mock lesson data store (in production, this would be a database or file system)
const mockLessons: Record<string, Lesson> = {
  'js-variables-intro': {
    id: 'js-variables-intro',
    title: 'Introduction to JavaScript Variables',
    description: 'Learn the fundamentals of declaring and using variables in JavaScript',
    language: 'javascript',
    category: 'frontend',
    difficulty: 'beginner',
    estimatedDuration: 15,
    objectives: [
      'Understand what variables are and why they\'re useful',
      'Learn to declare variables using let, const, and var',
      'Practice assigning values to variables',
      'Understand variable naming conventions'
    ],
    tags: ['variables', 'javascript', 'fundamentals'],
    author: 'Educational AI',
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    steps: [
      {
        id: 'step-1',
        title: 'What Are Variables?',
        type: 'instruction',
        content: `# What Are Variables?

Variables are containers that store data values. In JavaScript, you can think of them as labeled boxes that hold information.

## Why Use Variables?
- Store data for later use
- Make code more readable
- Avoid repeating values
- Create dynamic programs

Let's start learning how to create and use variables!`,
        order: 1,
        interactive: {
          requiresUserInput: false,
          estimatedTime: 2
        },
        narration: {
          text: 'Welcome to JavaScript variables! Variables are like labeled containers that store information. They make your code more organized and powerful.',
          speed: 1.0
        }
      },
      {
        id: 'step-2',
        title: 'Declaring Your First Variable',
        type: 'code_exercise',
        content: `# Declaring Your First Variable

Let's create your first variable! In JavaScript, we use the \`let\` keyword to declare a variable.

## Your Task
1. Declare a variable called \`message\`
2. Assign it the value "Hello, World!"
3. Use \`console.log()\` to display it

## Syntax
\`\`\`javascript
let variableName = value;
\`\`\``,
        order: 2,
        code: {
          language: 'javascript',
          startingCode: '// Declare a variable called message and assign it "Hello, World!"\n// Then log it to the console\n\n',
          solution: 'let message = "Hello, World!";\nconsole.log(message);',
          tests: [
            {
              name: 'Variable Declaration',
              code: 'typeof message !== "undefined"',
              expected: true
            },
            {
              name: 'Correct Value',
              code: 'message === "Hello, World!"',
              expected: true
            }
          ]
        },
        interactive: {
          requiresUserInput: true,
          validationRules: ['must_declare_variable', 'must_use_console_log'],
          hints: [
            'Use the let keyword to declare a variable',
            'Remember to assign the string "Hello, World!" to the message variable',
            'Use console.log() to display the variable'
          ],
          estimatedTime: 5
        },
        narration: {
          text: 'Now let\'s write some code! Declare a variable called message and assign it the value Hello, World. Then use console.log to display it.',
          speed: 1.0
        }
      },
      {
        id: 'step-3',
        title: 'Different Types of Variables',
        type: 'explanation',
        content: `# Different Types of Variables

JavaScript has several ways to declare variables:

## \`let\` - Block Scoped
- Can be reassigned
- Block scoped (only available in the block where declared)
- Modern way to declare variables

## \`const\` - Constant
- Cannot be reassigned
- Block scoped
- Use for values that won't change

## \`var\` - Function Scoped (Avoid)
- Can be reassigned
- Function scoped
- Older way, avoid in modern JavaScript

## Best Practice
Use \`const\` by default, \`let\` when you need to reassign the variable.`,
        order: 3,
        code: {
          language: 'javascript',
          startingCode: '// Examples of different variable declarations\n\n// Constant - cannot be changed\nconst PI = 3.14159;\n\n// Let - can be reassigned\nlet age = 25;\nage = 26; // This is allowed\n\n// Var - avoid using this\nvar oldStyle = "Don\'t use this";',
          highlightLines: [3, 6, 10]
        },
        interactive: {
          requiresUserInput: false,
          estimatedTime: 3
        },
        narration: {
          text: 'JavaScript has three ways to declare variables. Const for constants, let for variables that can change, and var which we avoid in modern JavaScript.',
          speed: 1.0
        }
      },
      {
        id: 'step-4',
        title: 'Variable Naming Rules',
        type: 'instruction',
        content: `# Variable Naming Rules

JavaScript has specific rules for naming variables:

## Rules (Must Follow)
1. Must start with a letter, underscore (_), or dollar sign ($)
2. Cannot start with a number
3. Can contain letters, numbers, underscores, and dollar signs
4. Cannot use reserved words (like \`let\`, \`const\`, \`function\`)
5. Case sensitive (\`myVar\` and \`myvar\` are different)

## Best Practices
- Use camelCase: \`firstName\`, \`lastName\`
- Be descriptive: \`userAge\` instead of \`x\`
- Use meaningful names: \`isLoggedIn\` instead of \`flag\`

## Examples
✅ Good: \`userName\`, \`totalPrice\`, \`isActive\`
❌ Bad: \`2cool\`, \`my-var\`, \`class\``,
        order: 4,
        interactive: {
          requiresUserInput: false,
          estimatedTime: 3
        },
        narration: {
          text: 'Variable names have rules! They must start with a letter, underscore, or dollar sign. Use camelCase and descriptive names for better code.',
          speed: 1.0
        }
      },
      {
        id: 'step-5',
        title: 'Practice Exercise',
        type: 'project',
        content: `# Practice Exercise

Now let's practice what you've learned! Create a simple program that uses variables.

## Your Task
Create three variables:
1. A constant for your name
2. A variable for your age (you can change this later)
3. A variable for a greeting message that combines your name and age

Display the greeting using console.log.

## Bonus Challenge
Try changing the age and run the code again to see how the greeting changes!`,
        order: 5,
        code: {
          language: 'javascript',
          startingCode: '// Create your variables here\n\n// 1. Constant for your name\n\n// 2. Variable for your age\n\n// 3. Greeting message\n\n// Display the greeting\n',
          solution: 'const name = "Alice";\nlet age = 25;\nlet greeting = `Hello, my name is ${name} and I am ${age} years old.`;\nconsole.log(greeting);',
          tests: [
            {
              name: 'Name constant exists',
              code: 'typeof name !== "undefined"',
              expected: true
            },
            {
              name: 'Age variable exists',
              code: 'typeof age !== "undefined"',
              expected: true
            },
            {
              name: 'Greeting exists',
              code: 'typeof greeting !== "undefined"',
              expected: true
            }
          ]
        },
        interactive: {
          requiresUserInput: true,
          validationRules: ['must_use_const', 'must_use_let', 'must_use_template_literal'],
          hints: [
            'Use const for the name since it won\'t change',
            'Use let for age since it might change',
            'Use template literals with ${} to combine values',
            'Don\'t forget to console.log the greeting!'
          ],
          estimatedTime: 10
        },
        narration: {
          text: 'Time to practice! Create three variables: a constant for your name, a variable for your age, and a greeting message. Show off your new skills!',
          speed: 1.0
        }
      }
    ],
    prerequisites: [],
    nextLessons: ['js-data-types', 'js-operators'],
    resources: [
      {
        type: 'documentation',
        title: 'MDN: Variables',
        url: 'https://developer.mozilla.org/en-US/docs/Learn/JavaScript/First_steps/Variables'
      },
      {
        type: 'video',
        title: 'JavaScript Variables Explained',
        url: 'https://example.com/js-variables'
      }
    ]
  }
}

export class LessonContentLoader {
  static async loadLesson(lessonId: string): Promise<Lesson | null> {
    // In production, this would fetch from a database or file system
    const lesson = mockLessons[lessonId]
    if (!lesson) {
      return null
    }
    
    // Validate the lesson structure
    try {
      return LessonSchema.parse(lesson)
    } catch (error) {
      console.error('Invalid lesson structure:', error)
      return null
    }
  }

  static async loadLessonStep(lessonId: string, stepId: string): Promise<LessonStep | null> {
    const lesson = await this.loadLesson(lessonId)
    if (!lesson) {
      return null
    }

    const step = lesson.steps.find((s: LessonStep) => s.id === stepId)
    if (!step) {
      return null
    }

    // Validate the step structure
    try {
      return LessonStepSchema.parse(step)
    } catch (error) {
      console.error('Invalid step structure:', error)
      return null
    }
  }

  static async loadLessonsByDifficulty(difficulty: 'beginner' | 'intermediate' | 'advanced'): Promise<Lesson[]> {
    const lessons = Object.values(mockLessons).filter(lesson => lesson.difficulty === difficulty)
    return lessons.map(lesson => LessonSchema.parse(lesson))
  }

  static async loadLessonsByLanguage(language: string): Promise<Lesson[]> {
    const lessons = Object.values(mockLessons).filter(lesson => lesson.language === language)
    return lessons.map(lesson => LessonSchema.parse(lesson))
  }

  static async searchLessons(query: string): Promise<Lesson[]> {
    const lowerQuery = query.toLowerCase()
    const lessons = Object.values(mockLessons).filter(lesson => 
      lesson.title.toLowerCase().includes(lowerQuery) ||
      lesson.description.toLowerCase().includes(lowerQuery) ||
      lesson.tags.some((tag: string) => tag.toLowerCase().includes(lowerQuery))
    )
    return lessons.map(lesson => LessonSchema.parse(lesson))
  }

  static async validateLessonStructure(lesson: any): Promise<{ valid: boolean; errors: string[] }> {
    try {
      LessonSchema.parse(lesson)
      return { valid: true, errors: [] }
    } catch (error) {
      const errors = error instanceof Error ? [error.message] : ['Unknown validation error']
      return { valid: false, errors }
    }
  }
}

// Convenient export functions
export const loadLesson = (lessonId: string) => LessonContentLoader.loadLesson(lessonId)
export const loadLessonStep = (lessonId: string, stepId: string) => LessonContentLoader.loadLessonStep(lessonId, stepId)
export const loadLessonsByDifficulty = (difficulty: 'beginner' | 'intermediate' | 'advanced') => LessonContentLoader.loadLessonsByDifficulty(difficulty)
export const loadLessonsByLanguage = (language: string) => LessonContentLoader.loadLessonsByLanguage(language)

// Helper functions for lesson management
export const createLessonProgress = (lessonId: string, userId: string): Progress => ({
  userId,
  lessonId,
  currentStep: 0,
  completedSteps: [],
  score: 0,
  timeSpent: 0,
  lastAccessed: new Date().toISOString(),
  achievements: [],
  codeSubmissions: [],
  mistakes: []
})

export const updateLessonProgress = (progress: Progress, stepIndex: number, completed: boolean): Progress => ({
  ...progress,
  completedSteps: completed && !progress.completedSteps.includes(stepIndex) 
    ? [...progress.completedSteps, stepIndex]
    : progress.completedSteps,
  lastAccessed: new Date().toISOString(),
  currentStep: completed ? stepIndex + 1 : progress.currentStep
})

export const calculateLessonProgress = (lesson: Lesson, progress: Progress): number => {
  const totalSteps = lesson.steps.length
  const completedSteps = progress.completedSteps.length
  return Math.round((completedSteps / totalSteps) * 100)
}
