import type {
  Experimental_Agent as Agent,
  Experimental_InferAgentUIMessage as InferAgentUIMessage,
  InferUITools,
  ModelMessage,
  StreamTextResult,
  UIMessage,
  UIToolInvocation
} from 'ai'

import type { fetchTool } from '../tools/fetch'
import type { createQuestionTool } from '../tools/question'
import type { createSearchTool } from '../tools/search'
import type { createTodoTools } from '../tools/todo'

// Define the tools type for researcher agent
export type ResearcherTools = {
  search: ReturnType<typeof createSearchTool>
  fetch: typeof fetchTool
  askQuestion: ReturnType<typeof createQuestionTool>
} & ReturnType<typeof createTodoTools>

// Type for the researcher agent (streamText-based)
export type ResearcherAgent = {
  tools: ResearcherTools
  stream: (options: {
    messages: ModelMessage[]
  }) => StreamTextResult<any, never>
  generate?: (options: {
    messages?: ModelMessage[]
    prompt?: string
  }) => Promise<any>
  respond?: (options: ResearcherRespondOptions) => ResearcherResponse
}

// Infer UI message type for researcher agent
// Note: Using Agent type for UI message inference
type _AgentType = Agent<ResearcherTools>
export type ResearcherUIMessage = InferAgentUIMessage<_AgentType>

// Infer UI tools type for researcher agent
export type ResearcherUITools = InferUITools<ResearcherTools>

// Tool invocation types for each tool
export type SearchToolInvocation = UIToolInvocation<ResearcherTools['search']>
export type FetchToolInvocation = UIToolInvocation<ResearcherTools['fetch']>
export type QuestionToolInvocation = UIToolInvocation<
  ResearcherTools['askQuestion']
>
export type TodoWriteToolInvocation = UIToolInvocation<
  ResearcherTools['todoWrite']
>

// Union type for all tool invocations
export type ResearcherToolInvocation =
  | SearchToolInvocation
  | FetchToolInvocation
  | QuestionToolInvocation
  | TodoWriteToolInvocation

// Helper type to extract tool names
export type ResearcherToolName = keyof ResearcherTools

// Type guard functions
export function isSearchToolInvocation(
  invocation: ResearcherToolInvocation
): invocation is SearchToolInvocation {
  return 'query' in (invocation as any).input
}

export function isFetchToolInvocation(
  invocation: ResearcherToolInvocation
): invocation is FetchToolInvocation {
  return 'url' in (invocation as any).input
}

// Response type for agent.respond()
export type ResearcherResponse = Response

// Options type for agent.respond()
export type ResearcherRespondOptions = {
  messages: UIMessage<never, never, ResearcherUITools>[]
}
