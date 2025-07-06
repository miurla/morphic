import { z } from 'zod'

// Core lesson step schema
export const LessonStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(['instruction', 'code_exercise', 'explanation', 'quiz', 'project']),
  content: z.string(), // Markdown content for the step
  order: z.number(),
  
  // Code-related fields
  code: z.object({
    language: z.enum(['javascript', 'python', 'html', 'css', 'typescript']).optional(),
    startingCode: z.string().optional(),
    solution: z.string().optional(),
    highlightLines: z.array(z.number()).optional(), // Lines to highlight (1-indexed)
    readOnlyLines: z.array(z.number()).optional(), // Lines that cannot be edited
    tests: z.array(z.object({
      name: z.string(),
      code: z.string(),
      expected: z.any()
    })).optional()
  }).optional(),
  
  // Interactive elements
  interactive: z.object({
    requiresUserInput: z.boolean().default(false),
    validationRules: z.array(z.string()).optional(),
    hints: z.array(z.string()).optional(),
    estimatedTime: z.number().optional() // in minutes
  }).optional(),
  
  // Narration
  narration: z.object({
    text: z.string().optional(), // Text for TTS
    audioUrl: z.string().optional(), // Pre-recorded audio
    speed: z.number().default(1.0),
    pausePoints: z.array(z.number()).optional() // Pause points in seconds
  }).optional(),
  
  // Prerequisites and dependencies
  prerequisites: z.array(z.string()).optional(), // Step IDs that must be completed first
  unlocks: z.array(z.string()).optional() // Step IDs unlocked by completing this step
})

// Main lesson schema
export const LessonSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  language: z.string(), // Programming language
  category: z.enum(['frontend', 'backend', 'fullstack', 'mobile', 'data-science', 'algorithms']),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  estimatedDuration: z.number(), // in minutes
  
  // Learning objectives
  objectives: z.array(z.string()),
  prerequisites: z.array(z.string()), // Lesson IDs or skill names
  nextLessons: z.array(z.string()).optional(), // Recommended next lessons
  resources: z.array(z.object({
    type: z.enum(['documentation', 'video', 'article', 'tool']),
    title: z.string(),
    url: z.string()
  })).optional(),
  
  // Content structure
  steps: z.array(LessonStepSchema),
  
  // Metadata
  author: z.string(),
  version: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  tags: z.array(z.string()),
  
  // Assessment
  assessment: z.object({
    type: z.enum(['project', 'quiz', 'code_review', 'peer_review']),
    criteria: z.array(z.string()),
    passingScore: z.number().min(0).max(100)
  }).optional()
})

// User progress schema
export const LessonProgressSchema = z.object({
  userId: z.string(),
  lessonId: z.string(),
  currentStepId: z.string(),
  completedSteps: z.array(z.string()),
  startedAt: z.string(),
  lastAccessedAt: z.string(),
  completedAt: z.string().optional(),
  
  // Progress metrics
  timeSpent: z.number().default(0), // in seconds
  score: z.number().min(0).max(100).optional(),
  attempts: z.number().default(1),
  
  // Step-specific progress
  stepProgress: z.record(z.string(), z.object({
    status: z.enum(['not_started', 'in_progress', 'completed', 'skipped']),
    timeSpent: z.number().default(0),
    attempts: z.number().default(0),
    code: z.string().optional(), // Current user code for code exercises
    lastModified: z.string()
  })),
  
  // User interaction data
  interactions: z.array(z.object({
    type: z.enum(['step_enter', 'step_complete', 'code_edit', 'hint_viewed', 'test_run']),
    stepId: z.string(),
    timestamp: z.string(),
    data: z.any().optional() // Additional interaction-specific data
  }))
})

// Learning path schema
export const LearningPathSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  estimatedDuration: z.number(), // total duration in hours
  
  // Path structure
  lessons: z.array(z.object({
    lessonId: z.string(),
    order: z.number(),
    required: z.boolean().default(true),
    unlockConditions: z.array(z.string()).optional() // Lesson IDs that must be completed
  })),
  
  // Metadata
  category: z.string(),
  tags: z.array(z.string()),
  author: z.string(),
  version: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
})

// Type exports
export type LessonStep = z.infer<typeof LessonStepSchema>
export type Lesson = z.infer<typeof LessonSchema>
export type LessonProgress = z.infer<typeof LessonProgressSchema>
export type LearningPath = z.infer<typeof LearningPathSchema>

// Validation helpers
export function validateLesson(lesson: unknown): lesson is Lesson {
  try {
    LessonSchema.parse(lesson)
    return true
  } catch {
    return false
  }
}

export function validateLessonProgress(progress: unknown): progress is LessonProgress {
  try {
    LessonProgressSchema.parse(progress)
    return true
  } catch {
    return false
  }
}

// Sample lesson for testing
export const SAMPLE_LESSON: Lesson = {
  id: 'js-variables-intro',
  title: 'Introduction to JavaScript Variables',
  description: 'Learn the basics of declaring and using variables in JavaScript',
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
  prerequisites: [],
  nextLessons: ['js-data-types', 'js-operators'],
  resources: [
    {
      type: 'documentation',
      title: 'MDN: Variables',
      url: 'https://developer.mozilla.org/en-US/docs/Learn/JavaScript/First_steps/Variables'
    }
  ],
  steps: [
    {
      id: 'step-1',
      title: 'What are Variables?',
      type: 'instruction',
      content: `# What are Variables?

Variables are like containers that store data values. Think of them as labeled boxes where you can put different types of information.

In JavaScript, you can store:
- Numbers (like 42 or 3.14)
- Text (like "Hello World")
- True/false values (called booleans)
- And much more!

## Why Use Variables?

Variables make your code:
- **Reusable**: Store a value once, use it many times
- **Readable**: Give meaningful names to your data
- **Flexible**: Change values as your program runs`,
      order: 1,
      narration: {
        text: 'Welcome to your first lesson on JavaScript variables! Variables are like containers that store data values. Think of them as labeled boxes where you can put different types of information.',
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
3. Use \`console.log()\` to display it`,
      order: 2,
      code: {
        language: 'javascript',
        startingCode: '// Declare a variable called message and assign it "Hello, World!"\n// Then log it to the console\n\n',
        solution: 'let message = "Hello, World!";\nconsole.log(message);',
        tests: [
          {
            name: 'Variable is declared',
            code: 'typeof message !== "undefined"',
            expected: true
          },
          {
            name: 'Variable has correct value',
            code: 'message === "Hello, World!"',
            expected: true
          }
        ]
      },
      interactive: {
        requiresUserInput: true,
        hints: [
          'Use the `let` keyword to declare a variable',
          'Assign a value using the equals sign (=)',
          'Strings must be wrapped in quotes'
        ],
        estimatedTime: 3
      }
    }
  ],
  author: 'Educational AI',
  version: '1.0.0',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  tags: ['javascript', 'variables', 'basics'],
  assessment: {
    type: 'code_review',
    criteria: [
      'Correctly declares variables',
      'Uses appropriate variable names',
      'Demonstrates understanding of variable assignment'
    ],
    passingScore: 80
  }
}
