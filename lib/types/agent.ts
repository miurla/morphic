import type {
  InferAgentUIMessage,
  InferUITools,
  ToolLoopAgent,
  UIMessage,
  UIToolInvocation
} from 'ai'

import type { createFeedTool } from '../tools/feed'
import type { fetchTool } from '../tools/fetch'
import type { createMapTool } from '../tools/map'
import type { createQuestionTool } from '../tools/question'
import type { createSearchTool } from '../tools/search'
import type { createResearchSubtaskTool } from '../tools/subtask-agent'
import type { createTodoTools } from '../tools/todo'

// Define the tools type for researcher agent
export type ResearcherTools = {
  search: ReturnType<typeof createSearchTool>
  feedSearch: ReturnType<typeof createFeedTool>
  mapSearch: ReturnType<typeof createMapTool>
  fetch: typeof fetchTool
  askQuestion: ReturnType<typeof createQuestionTool>
  researchSubtask: ReturnType<typeof createResearchSubtaskTool>
} & ReturnType<typeof createTodoTools>

// Type alias for the researcher agent using ToolLoopAgent
// ToolLoopAgent generic signature is <CALL_OPTIONS, TOOLS, OUTPUT>
export type ResearcherAgent = ToolLoopAgent<never, ResearcherTools, never>

// Infer UI message type for researcher agent
export type ResearcherUIMessage = InferAgentUIMessage<ResearcherAgent>

// Infer UI tools type for researcher agent
export type ResearcherUITools = InferUITools<ResearcherTools>

// Tool invocation types for each tool
export type SearchToolInvocation = UIToolInvocation<ResearcherTools['search']>
export type FeedSearchToolInvocation = UIToolInvocation<
  ResearcherTools['feedSearch']
>
export type FetchToolInvocation = UIToolInvocation<ResearcherTools['fetch']>
export type QuestionToolInvocation = UIToolInvocation<
  ResearcherTools['askQuestion']
>
export type TodoWriteToolInvocation = UIToolInvocation<
  ResearcherTools['todoWrite']
>
export type MapSearchToolInvocation = UIToolInvocation<
  ResearcherTools['mapSearch']
>
export type ResearchSubtaskToolInvocation = UIToolInvocation<
  ResearcherTools['researchSubtask']
>

// Union type for all tool invocations
export type ResearcherToolInvocation =
  | SearchToolInvocation
  | FeedSearchToolInvocation
  | MapSearchToolInvocation
  | FetchToolInvocation
  | QuestionToolInvocation
  | TodoWriteToolInvocation
  | ResearchSubtaskToolInvocation

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
