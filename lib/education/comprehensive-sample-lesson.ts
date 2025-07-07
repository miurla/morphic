import { type Lesson } from './schema'

/**
 * Comprehensive Sample Lesson: Interactive Web Development Masterclass
 * 
 * This lesson demonstrates all major platform features:
 * 1. Chat Interface Integration - Lessons work within chat like search results
 * 2. Interactive Code Puzzles - Code challenges rendered as chat artifacts
 * 3. Morphing Interface - Smooth transitions between chat, editor, and preview modes
 * 4. AI-Powered Learning - Personalized hints and adaptive difficulty
 * 5. Progressive Challenges - Building complexity with real-world application
 */
export const comprehensiveSampleLesson: Lesson = {
  id: 'comprehensive-web-development-masterclass',
  title: '🚀 Interactive Web Development Masterclass',
  description: 'Experience the future of learning with chat-based education, morphing interfaces, and AI-powered personalization. Build a complete interactive web application while mastering all platform features.',
  language: 'javascript',
  category: 'fullstack',
  difficulty: 'intermediate',
  estimatedDuration: 60,
  author: 'AI Educational Platform',
  version: '2.0.0',
  tags: ['comprehensive', 'interactive', 'chat-based', 'morphing-ui', 'ai-powered', 'web-development'],
  prerequisites: ['html-basics', 'css-fundamentals', 'javascript-variables'],
  nextLessons: ['react-introduction', 'advanced-javascript', 'fullstack-development'],
  objectives: [
    'Master chat-based learning workflow with AI assistance',
    'Experience morphing interface transitions in real-time',
    'Solve progressive code challenges with instant feedback',
    'Build complete interactive web application',
    'Integrate with AI tutoring system for personalized learning',
    'Understand modern web development patterns and best practices'
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  steps: [
    {
      id: 'step-1',
      title: 'Welcome: AI-Powered Learning Experience',
      type: 'instruction',
      content: `# 🚀 Welcome to Interactive Learning!

This lesson showcases our platform's most powerful features:
- **AI Chat Interface**: Your personal AI instructor adapts to your learning style
- **Interactive Code Puzzles**: Solve challenges directly in chat with instant feedback
- **Morphing Interface**: Seamless transitions between explanation, coding, and preview modes

## What We'll Build Together
You'll create a dynamic To-Do application that demonstrates:
- DOM manipulation
- Event handling
- Local storage
- Modern JavaScript techniques

## How This Works
1. **Chat with AI**: Ask questions, get explanations, and receive hints
2. **Interactive Coding**: Solve puzzles that appear as artifacts in our chat
3. **Morphing Interface**: Watch the UI transform from chat to editor to preview

Ready to begin? The AI will guide you through each step!`,
      order: 1,
      interactive: {
        requiresUserInput: false,
        estimatedTime: 3
      },
      narration: {
        text: 'Welcome to our most advanced learning experience! This lesson demonstrates how AI-powered education can adapt to your needs while providing interactive, hands-on learning.',
        speed: 1.0
      }
    },
    {
      id: 'step-2',
      title: 'Chat-Based Learning: Understanding the DOM',
      type: 'instruction',
      content: `# 🤖 Chat with Your AI Instructor

**AI Instructor**: Hello! I'm your personal AI instructor for this lesson. I'll adapt my teaching style to match how you learn best.

Let's start by understanding the DOM (Document Object Model). 

**Question for you**: Have you worked with the DOM before? 
- A) Yes, I'm familiar with it
- B) I've heard of it but haven't used it much  
- C) This is completely new to me

Type your answer (A, B, or C) and I'll tailor my explanation to your experience level!

## What the AI Will Do:
- Adjust explanations based on your background
- Provide personalized examples
- Offer hints when you're stuck
- Ask follow-up questions to check understanding`,
      order: 2,
      interactive: {
        requiresUserInput: true,
        estimatedTime: 5,
        hints: [
          'If student chooses A: Focus on advanced DOM patterns and performance',
          'If student chooses B: Provide clear examples with moderate detail',
          'If student chooses C: Use analogies and start with basic concepts'
        ]
      },
      narration: {
        text: 'Now let\'s engage with your AI instructor who will adapt to your learning style and provide personalized guidance.',
        speed: 1.0
      }
    },
    {
      id: 'step-3',
      title: 'Interactive Code Puzzle: DOM Selection',
      type: 'code_exercise',
      content: `# 🧩 Interactive Code Puzzle in Chat

**AI Instructor**: Great! Now let's practice DOM selection with an interactive puzzle.

This coding challenge will appear as an **artifact** in our chat interface, just like search results and images do. You can:
- Write code directly in the interactive editor
- Get instant feedback and live preview
- Ask for hints if you're stuck
- See results in real-time

**Challenge**: Create a function that selects all elements with a specific class name and changes their text color to blue.

🎯 **How it works**: The puzzle will render below as an interactive code editor artifact. This demonstrates how educational content integrates seamlessly with the chat interface - the same way search results and images are displayed as artifacts.`,
      order: 3,
      interactive: {
        requiresUserInput: true,
        estimatedTime: 8,
        hints: [
          'Use document.querySelectorAll() to select multiple elements',
          'Don\'t forget the dot (.) before the class name in querySelectorAll',
          'Use forEach() to iterate through the selected elements',
          'Set the style.color property to change text color'
        ]
      },
      code: {
        language: 'javascript',
        startingCode: `// Challenge: Complete the function to select and style elements
function highlightElements(className) {
  // Your code here
  // 1. Select all elements with the given class name
  // 2. Change their text color to blue
  
}

// Test HTML (read-only)
const testHTML = \`
<div class="highlight">Item 1</div>
<div class="highlight">Item 2</div>
<div class="normal">Item 3</div>
<div class="highlight">Item 4</div>
\`;

// Call your function
highlightElements('highlight');`,
        solution: `function highlightElements(className) {
  // Select all elements with the given class name
  const elements = document.querySelectorAll('.' + className);
  
  // Change their text color to blue
  elements.forEach(element => {
    element.style.color = 'blue';
  });
}

// Test HTML (read-only)
const testHTML = \`
<div class="highlight">Item 1</div>
<div class="highlight">Item 2</div>
<div class="normal">Item 3</div>
<div class="highlight">Item 4</div>
\`;

// Call your function
highlightElements('highlight');`,
        expectedOutput: "Elements with class 'highlight' should have blue text color"
      }
    },
    {
      id: 'step-4',
      title: 'Morphing Interface: From Chat to Editor',
      type: 'project',
      content: `# 🔄 Experience the Morphing Interface

**AI Instructor**: Excellent work on that puzzle! Now let's experience our **morphing interface** - the signature feature that makes this platform unique.

## 🎭 How the Morphing Interface Works

Watch as the interface **seamlessly transforms** between different modes:

1. **💬 Chat Mode** → **📝 Editor Mode** → **👁️ Preview Mode**
2. **Smooth Transitions**: CSS transforms and animations create fluid transitions
3. **Context Preservation**: Your work is preserved as the interface morphs
4. **Responsive Design**: Adapts to different screen sizes and devices

## 🚀 Your Next Task

We'll build the HTML structure for our To-Do app. As you work, you'll see the interface morph to give you the best experience for each type of task:

- **Chat Mode**: For explanations and Q&A (where we are now)
- **Editor Mode**: For concentrated coding (where we're going)
- **Preview Mode**: For seeing your work in action (the final result)

This morphing system provides the optimal UI for each learning activity, creating a seamless educational experience that adapts to your needs.

Click "Start Building" to begin the morphing experience!`,
      order: 4,
      interactive: {
        requiresUserInput: true,
        estimatedTime: 10,
        hints: [
          'Focus on semantic HTML structure',
          'Use modern CSS features like backdrop-filter',
          'Plan your JavaScript hooks with appropriate IDs'
        ]
      },
      code: {
        language: 'html',
        startingCode: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Interactive To-Do App</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .container {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            padding: 30px;
            backdrop-filter: blur(10px);
        }
        h1 {
            text-align: center;
            margin-bottom: 30px;
        }
        .input-section {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
        }
        #taskInput {
            flex: 1;
            padding: 12px;
            border: none;
            border-radius: 5px;
            font-size: 16px;
        }
        #addBtn {
            padding: 12px 20px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
        }
        #addBtn:hover {
            background: #45a049;
        }
        .task-list {
            list-style: none;
            padding: 0;
        }
        .task-item {
            background: rgba(255, 255, 255, 0.2);
            margin: 10px 0;
            padding: 15px;
            border-radius: 5px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            animation: slideIn 0.3s ease-out;
        }
        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        .delete-btn {
            background: #f44336;
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 3px;
            cursor: pointer;
        }
        .delete-btn:hover {
            background: #da190b;
        }
        .completed {
            text-decoration: line-through;
            opacity: 0.7;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Interactive To-Do App</h1>
        
        <!-- TODO: Add input section here -->
        
        <!-- TODO: Add task list here -->
        
    </div>
    
    <script>
        // TODO: Add JavaScript functionality
    </script>
</body>
</html>`,
        solution: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Interactive To-Do App</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .container {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            padding: 30px;
            backdrop-filter: blur(10px);
        }
        h1 {
            text-align: center;
            margin-bottom: 30px;
        }
        .input-section {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
        }
        #taskInput {
            flex: 1;
            padding: 12px;
            border: none;
            border-radius: 5px;
            font-size: 16px;
        }
        #addBtn {
            padding: 12px 20px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
        }
        #addBtn:hover {
            background: #45a049;
        }
        .task-list {
            list-style: none;
            padding: 0;
        }
        .task-item {
            background: rgba(255, 255, 255, 0.2);
            margin: 10px 0;
            padding: 15px;
            border-radius: 5px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            animation: slideIn 0.3s ease-out;
        }
        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        .delete-btn {
            background: #f44336;
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 3px;
            cursor: pointer;
        }
        .delete-btn:hover {
            background: #da190b;
        }
        .completed {
            text-decoration: line-through;
            opacity: 0.7;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Interactive To-Do App</h1>
        
        <div class="input-section">
            <input type="text" id="taskInput" placeholder="Add a new task...">
            <button id="addBtn">Add Task</button>
        </div>
        
        <ul class="task-list" id="taskList">
            <!-- Tasks will be added here dynamically -->
        </ul>
    </div>
    
    <script>
        // JavaScript functionality will be added in the next step
    </script>
</body>
</html>`
      }
    },
    {
      id: 'step-5',
      title: 'Advanced Morphing: Editor to Preview',
      type: 'code_exercise',
      content: `# 🎯 Advanced Morphing: Watch Your Code Come to Life

**AI Instructor**: Perfect! Now let's add the JavaScript functionality and experience the full morphing interface transition from editor to live preview.

As you complete the JavaScript, you'll see:
1. **Editor Mode**: Full-screen coding with syntax highlighting
2. **Split Mode**: Code and preview side-by-side
3. **Preview Mode**: Full interactive preview of your app

**Your Challenge**: Complete the JavaScript to make the To-Do app fully functional with:
- Add new tasks
- Mark tasks as complete
- Delete tasks
- Persist tasks in localStorage

Watch how the interface morphs to show you the results in real-time!`,
      order: 5,
      interactive: {
        requiresUserInput: true,
        estimatedTime: 12,
        hints: [
          'Use addEventListener to handle clicks and key presses',
          'Create unique IDs using Date.now() for each task',
          'Use localStorage.getItem() and localStorage.setItem() for persistence',
          'Remember to clear the task list before rendering to avoid duplicates',
          'Use template literals (backticks) for creating HTML strings'
        ]
      },
      code: {
        language: 'javascript',
        startingCode: `// Interactive To-Do App JavaScript
class TodoApp {
    constructor() {
        this.tasks = this.loadTasks();
        this.taskInput = document.getElementById('taskInput');
        this.addBtn = document.getElementById('addBtn');
        this.taskList = document.getElementById('taskList');
        
        this.init();
    }
    
    init() {
        // TODO: Add event listeners
        
        // TODO: Render existing tasks
        
    }
    
    addTask() {
        // TODO: Get input value
        
        // TODO: Create task object
        
        // TODO: Add to tasks array
        
        // TODO: Save to localStorage
        
        // TODO: Render tasks
        
        // TODO: Clear input
        
    }
    
    deleteTask(taskId) {
        // TODO: Remove task from array
        
        // TODO: Save to localStorage
        
        // TODO: Render tasks
        
    }
    
    toggleTask(taskId) {
        // TODO: Toggle completed status
        
        // TODO: Save to localStorage
        
        // TODO: Render tasks
        
    }
    
    renderTasks() {
        // TODO: Clear task list
        
        // TODO: Create HTML for each task
        
        // TODO: Add to DOM
        
    }
    
    loadTasks() {
        // TODO: Load from localStorage
        
    }
    
    saveTasks() {
        // TODO: Save to localStorage
        
    }
}

// Initialize the app
const app = new TodoApp();`,
        solution: `// Interactive To-Do App JavaScript
class TodoApp {
    constructor() {
        this.tasks = this.loadTasks();
        this.taskInput = document.getElementById('taskInput');
        this.addBtn = document.getElementById('addBtn');
        this.taskList = document.getElementById('taskList');
        
        this.init();
    }
    
    init() {
        // Add event listeners
        this.addBtn.addEventListener('click', () => this.addTask());
        this.taskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTask();
        });
        
        // Render existing tasks
        this.renderTasks();
    }
    
    addTask() {
        // Get input value
        const taskText = this.taskInput.value.trim();
        if (!taskText) return;
        
        // Create task object
        const task = {
            id: Date.now(),
            text: taskText,
            completed: false,
            createdAt: new Date().toISOString()
        };
        
        // Add to tasks array
        this.tasks.push(task);
        
        // Save to localStorage
        this.saveTasks();
        
        // Render tasks
        this.renderTasks();
        
        // Clear input
        this.taskInput.value = '';
    }
    
    deleteTask(taskId) {
        // Remove task from array
        this.tasks = this.tasks.filter(task => task.id !== taskId);
        
        // Save to localStorage
        this.saveTasks();
        
        // Render tasks
        this.renderTasks();
    }
    
    toggleTask(taskId) {
        // Toggle completed status
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = !task.completed;
        }
        
        // Save to localStorage
        this.saveTasks();
        
        // Render tasks
        this.renderTasks();
    }
    
    renderTasks() {
        // Clear task list
        this.taskList.innerHTML = '';
        
        // Create HTML for each task
        this.tasks.forEach(task => {
            const taskItem = document.createElement('li');
            taskItem.className = 'task-item';
            if (task.completed) {
                taskItem.classList.add('completed');
            }
            
            taskItem.innerHTML = \`
                <span onclick="app.toggleTask(\${task.id})" style="cursor: pointer; flex: 1;">
                    \${task.text}
                </span>
                <button class="delete-btn" onclick="app.deleteTask(\${task.id})">
                    Delete
                </button>
            \`;
            
            // Add to DOM
            this.taskList.appendChild(taskItem);
        });
    }
    
    loadTasks() {
        // Load from localStorage
        const saved = localStorage.getItem('todoTasks');
        return saved ? JSON.parse(saved) : [];
    }
    
    saveTasks() {
        // Save to localStorage
        localStorage.setItem('todoTasks', JSON.stringify(this.tasks));
    }
}

// Initialize the app
const app = new TodoApp();`,
        expectedOutput: "Fully functional To-Do app with add, delete, toggle, and localStorage persistence"
      }
    },
    {
      id: 'step-6',
      title: 'Final Chat: Reflection and Next Steps',
      type: 'instruction',
      content: `# 🎉 Congratulations! You've Experienced the Full Platform

**AI Instructor**: Fantastic work! You've just experienced all the major features of our educational platform:

## What You Accomplished:
✅ **AI-Powered Learning**: Received personalized instruction based on your experience level  
✅ **Interactive Chat Puzzles**: Solved coding challenges directly in our chat interface  
✅ **Morphing Interface**: Experienced seamless transitions between chat, editor, and preview modes  
✅ **Real Application**: Built a fully functional To-Do app with modern JavaScript

## Reflection Questions:
1. How did the AI adaptation help your learning experience?
2. What did you think of solving puzzles directly in chat?
3. How did the morphing interface affect your focus and understanding?
4. What would you like to explore next?

## Next Steps:
Based on your performance, I recommend:
- **If you enjoyed the JavaScript**: Try our React introduction lesson
- **If you want more interactive features**: Explore our advanced DOM manipulation course
- **If you're curious about the AI**: Learn about machine learning basics

**Question for you**: Which aspect of this lesson excited you most? Type your answer and I'll suggest a personalized learning path!`,
      order: 6,
      interactive: {
        requiresUserInput: true,
        estimatedTime: 5,
        hints: [
          'If they enjoyed AI features: Suggest AI/ML learning paths',
          'If they liked the morphing interface: Recommend UI/UX courses',
          'If they want more coding: Suggest advanced JavaScript or React',
          'If they want to build more apps: Recommend project-based learning'
        ]
      },
      narration: {
        text: 'Congratulations on completing this comprehensive lesson! You\'ve experienced the full power of our AI-driven, interactive learning platform.',
        speed: 1.0
      }
    }
  ],
  assessment: {
    type: 'project',
    criteria: [
      'Successfully completed DOM manipulation exercises',
      'Built a functional To-Do application',
      'Demonstrated understanding of event handling',
      'Implemented localStorage for data persistence',
      'Engaged with AI-powered learning features'
    ],
    passingScore: 80
  },
  resources: [
    {
      title: 'MDN Web Docs - DOM',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model',
      type: 'documentation'
    },
    {
      title: 'Modern JavaScript Features',
      url: 'https://javascript.info/',
      type: 'article'
    },
    {
      title: 'Web Storage API',
      url: 'https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API',
      type: 'documentation'
    }
  ]
}
