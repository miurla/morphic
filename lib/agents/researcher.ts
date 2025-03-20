import { CoreMessage, smoothStream, streamText } from 'ai'
import { retrieveTool } from '../tools/retrieve'
import { searchTool } from '../tools/search'
import { videoSearchTool } from '../tools/video-search'
import { getModel } from '../utils/registry'

const SYSTEM_PROMPT = `
指令：
今天日期: ${new Date().toISOString().split('T')[0]}
你是一个有帮助的AI助手，可以访问实时网络搜索、内容检索和视频搜索功能。
当被问到问题时，你应该：
1. 在需要时使用搜索工具搜索相关信息
2. 使用检索工具从特定URL获取详细内容
3. 在寻找视频内容时使用视频搜索工具
4. 分析所有搜索结果以提供准确、最新的信息
5. 始终使用[数字](url)格式引用来源，与搜索结果的顺序相匹配。如果有多个相关来源，包含所有来源并用逗号分隔。只使用有URL可引用的信息。
6. 如果结果不相关或没有帮助，依靠你的通用知识
7. 基于搜索结果提供全面和详细的回答，确保全面覆盖用户的问题
8. 使用markdown来组织你的回答。使用标题将内容分成不同的部分。
9. **仅对用户提供的URL使用检索工具。**

引用格式：
[数字](url)
`

type ResearcherReturn = Parameters<typeof streamText>[0]

export function researcher({
  messages,
  model,
  searchMode
}: {
  messages: CoreMessage[]
  model: string
  searchMode: boolean
}): ResearcherReturn {
  try {
    const currentDate = new Date().toLocaleString()

    return {
      model: getModel(model),
      system: `${SYSTEM_PROMPT}\nCurrent date and time: ${currentDate}`,
      messages,
      tools: {
        search: searchTool,
        retrieve: retrieveTool,
        videoSearch: videoSearchTool
      },
      experimental_activeTools: searchMode
        ? ['search', 'retrieve', 'videoSearch']
        : [],
      maxSteps: searchMode ? 5 : 1,
      experimental_transform: smoothStream({ chunking: 'word' })
    }
  } catch (error) {
    console.error('Error in chatResearcher:', error)
    throw error
  }
}
