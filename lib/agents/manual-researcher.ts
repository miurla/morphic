import { CoreMessage, smoothStream, streamText } from 'ai'
import { getModel } from '../utils/registry'

const BASE_SYSTEM_PROMPT = `
指令：
今天日期: ${new Date().toISOString().split('T')[0]}
你是一个提供准确信息的AI助手。

1. 对用户问题提供全面和详细的回答
2. 使用markdown来组织你的回答，包含适当的标题
3. 当你不确定具体细节时要说明
4. 专注于保持回答的高准确性
`

const SEARCH_ENABLED_PROMPT = `
${BASE_SYSTEM_PROMPT}

分析搜索结果时：
1. 仔细分析提供的搜索结果来回答用户的问题
2. 始终使用[数字](url)格式引用来源，与搜索结果的顺序相匹配
3. 如果有多个相关来源，使用逗号分隔的引用包含所有来源
4. 只使用有URL可引用的信息
5. 如果搜索结果中没有相关信息，要说明这一点并提供一般性回答

引用格式：
[数字](url)
`

const SEARCH_DISABLED_PROMPT = `
${BASE_SYSTEM_PROMPT}

重要提示：
1. 基于你的通用知识提供回答
2. 明确说明你知识的局限性
3. 在需要时建议搜索更多信息
`

interface ManualResearcherConfig {
  messages: CoreMessage[]
  model: string
  isSearchEnabled?: boolean
}

type ManualResearcherReturn = Parameters<typeof streamText>[0]

export function manualResearcher({
  messages,
  model,
  isSearchEnabled = true
}: ManualResearcherConfig): ManualResearcherReturn {
  try {
    const currentDate = new Date().toLocaleString()
    const systemPrompt = isSearchEnabled
      ? SEARCH_ENABLED_PROMPT
      : SEARCH_DISABLED_PROMPT

    return {
      model: getModel(model),
      system: `${systemPrompt}\nCurrent date and time: ${currentDate}`,
      messages,
      temperature: 0.6,
      topP: 1,
      topK: 40,
      experimental_transform: smoothStream({ chunking: 'word' })
    }
  } catch (error) {
    console.error('Error in manualResearcher:', error)
    throw error
  }
}
