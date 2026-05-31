import { stepCountIs, tool, ToolLoopAgent } from 'ai'
import { z } from 'zod'

import { getModel } from '../utils/registry'

import { fetchTool } from './fetch'
import { createSearchTool } from './search'

// Input schema for research subtask tool
export const researchSubtaskInputSchema = z.object({
  task: z
    .string()
    .describe('The specific research task or query to investigate in detail.'),
  context: z
    .string()
    .optional()
    .describe(
      'Additional context or goals for this task to guide the sub-agent.'
    )
})

export type ResearchSubtaskInput = z.infer<typeof researchSubtaskInputSchema>

/**
 * Creates a research subtask tool that delegates a subtopic to a sub-agent.
 * Uses ToolLoopAgent (consistent with the main researcher) instead of generateText.
 */
export function createResearchSubtaskTool(fullModel: string) {
  return tool({
    description:
      'Delegate a specific research task to a specialized sub-agent. Use this to investigate subtopics or aspects of a complex query in parallel or sequentially.',
    inputSchema: researchSubtaskInputSchema,
    async *execute({ task, context }: ResearchSubtaskInput) {
      // Yield starting state for UI
      yield {
        state: 'searching' as const,
        task,
        message: 'Sub-agent starting research...'
      }

      console.log(
        `[Subagent] Spawning sub-agent for task: "${task}" using model: ${fullModel}`
      )

      const searchTool = createSearchTool(fullModel)

      const systemPrompt = `You are a specialized Researcher Sub-Agent. Your task is to perform thorough research on the following topic:
"${task}"

${context ? `Additional Context/Goals: ${context}\n` : ''}Use the search tool and fetch tool to gather information.
Analyze the findings, compare options if relevant, check multiple sources, and synthesize high-quality, comprehensive research notes.
Focus ONLY on this task. Do not deviate to other topics.

CRITICAL: Return a clean, detailed, and synthesized summary of your findings. Include key facts, numbers, dates, and comparison tables if applicable.
At the end of your response, list the sources you used in this format:
Sources:
- [Title](URL)
`

      try {
        const subAgent = new ToolLoopAgent({
          model: getModel(fullModel),
          instructions: systemPrompt,
          tools: {
            search: searchTool,
            fetch: fetchTool
          },
          activeTools: ['search', 'fetch'],
          stopWhen: stepCountIs(8)
        })

        const result = await subAgent.generate({
          messages: [{ role: 'user', content: `Research request: ${task}` }]
        })

        console.log(`[Subagent] Sub-agent completed task: "${task}"`)

        yield {
          state: 'complete' as const,
          task,
          notes: result.text
        }
      } catch (error) {
        console.error(`[Subagent] Error during task "${task}":`, error)
        yield {
          state: 'complete' as const,
          task,
          error: error instanceof Error ? error.message : String(error),
          notes: `Failed to complete research on this task: ${
            error instanceof Error ? error.message : String(error)
          }`
        }
      }
    }
  })
}
