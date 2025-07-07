import { CoreMessage, smoothStream, streamText } from 'ai'
import { getModel } from '../utils/registry'
import { LessonStep, Lesson } from '../education/schema'

const LESSON_DESIGNER_SYSTEM_PROMPT = `
You are an expert AI lesson design assistant specialized in creating comprehensive, interactive educational content for programming and technology topics.

Your role is to help administrators design high-quality lessons through an iterative, collaborative process. You excel at:

1. **Curriculum Design**: Creating structured, progressive learning paths
2. **Content Development**: Writing clear explanations, examples, and exercises
3. **Interactive Elements**: Designing hands-on coding exercises and activities
4. **Assessment Strategy**: Creating meaningful checkpoints and evaluations
5. **Engagement Optimization**: Making lessons interactive and engaging
6. **Learning Objectives**: Defining clear, measurable learning outcomes

## Lesson Design Process:

### 1. Discovery Phase
- Ask clarifying questions about target audience, prerequisites, and goals
- Understand the desired lesson format and interaction style
- Identify key learning objectives and success criteria

### 2. Structure Planning
- Propose lesson outline with logical progression
- Suggest appropriate lesson duration and difficulty level
- Design interactive elements and hands-on activities

### 3. Content Creation
- Write step-by-step instructions with clear explanations
- Create code examples and exercises
- Design assessment checkpoints
- Suggest visual aids and demonstrations

### 4. Refinement
- Iterate based on feedback and suggestions
- Optimize for engagement and learning effectiveness
- Ensure proper pacing and difficulty progression

## Response Guidelines:

- **Be Collaborative**: Ask for input and feedback at each stage
- **Be Specific**: Provide concrete examples and detailed suggestions
- **Be Structured**: Present information in organized, logical formats
- **Be Adaptive**: Adjust recommendations based on user feedback
- **Be Practical**: Focus on implementable, tested educational approaches

## Output Formats:

When presenting lesson structures, use this format:
\`\`\`json
{
  "title": "Lesson Title",
  "description": "Brief description of what students will learn",
  "difficulty": "beginner|intermediate|advanced",
  "estimatedDuration": 30,
  "learningObjectives": ["Objective 1", "Objective 2"],
  "prerequisites": ["Prerequisite 1", "Prerequisite 2"],
  "steps": [
    {
      "title": "Step Title",
      "type": "introduction|explanation|exercise|assessment|summary",
      "content": "Step content with detailed instructions",
      "codeExample": "// Optional code example",
      "interactiveElements": ["code_editor", "highlight", "quiz"],
      "estimatedTime": 5
    }
  ]
}
\`\`\`

Start each conversation by understanding the user's lesson creation goals and guiding them through the design process step by step.
`

export async function createLessonDesignStream({
  messages,
  model,
  lessonDraft,
  onLessonUpdate
}: {
  messages: CoreMessage[]
  model: any
  lessonDraft?: Partial<Lesson>
  onLessonUpdate?: (lesson: Partial<Lesson>) => void
}) {
  const selectedModel = getModel(model.id)
  
  if (!selectedModel) {
    throw new Error(`Model ${model.id} not found`)
  }

  // Add lesson context to the system prompt if we have a draft
  let systemPrompt = LESSON_DESIGNER_SYSTEM_PROMPT
  
  if (lessonDraft && Object.keys(lessonDraft).length > 0) {
    systemPrompt += `\n\n## Current Lesson Draft:\n${JSON.stringify(lessonDraft, null, 2)}\n\nUse this context to provide relevant suggestions and continue the lesson design process.`
  }

  const result = await streamText({
    model: selectedModel,
    system: systemPrompt,
    messages,
    maxTokens: 4000,
    temperature: 0.7,
    onFinish: async ({ text }) => {
      // Try to extract lesson structure from the response
      try {
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/)
        if (jsonMatch && onLessonUpdate) {
          const lessonData = JSON.parse(jsonMatch[1])
          onLessonUpdate(lessonData)
        }
      } catch (error) {
        console.error('Failed to parse lesson data from response:', error)
      }
    }
  })

  return result.textStream
}

export async function generateLessonSuggestions(topic: string, difficulty: string, audience: string) {
  const model = getModel('gpt-4o-mini')
  
  if (!model) {
    throw new Error('Default model not available')
  }

  const prompt = `Create a lesson suggestion for the topic "${topic}" with ${difficulty} difficulty level for ${audience}.

Please provide:
1. A compelling lesson title
2. Clear learning objectives (3-5 items)
3. Lesson structure outline (5-8 steps)
4. Estimated duration
5. Key interactive elements to include

Format your response as a structured lesson plan that can be refined through further conversation.`

  const result = await streamText({
    model,
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 2000,
    temperature: 0.8
  })

  return result.textStream
}
