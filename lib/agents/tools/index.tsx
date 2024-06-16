import { retrieveTool } from "./retrieve";
import { searchTool } from "./search";
import type { ToolProps } from "./types";
import { videoSearchTool } from "./video-search";

interface Tools {
  retrieve: ReturnType<typeof retrieveTool>;
  search: ReturnType<typeof searchTool>;
  videoSearch?: ReturnType<typeof videoSearchTool>;
}

export const getTools = ({ uiStream, fullResponse }: ToolProps) => {
  const tools: Tools = {
    search: searchTool({ uiStream, fullResponse }),
    retrieve: retrieveTool({ uiStream, fullResponse }),
  };

  if (process.env.SERPER_API_KEY) {
    tools.videoSearch = videoSearchTool({ uiStream, fullResponse });
  }

  return tools;
};
