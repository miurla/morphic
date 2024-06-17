import { retrieveTool } from "./retrieve";
import { searchTool } from "./search";
import type { ToolProps } from "./types";
import { videoSearchTool } from "./video-search";

export const getTools = ({ uiStream, fullResponse }: ToolProps) => {
  const tools: any = {
    search: searchTool({ uiStream, fullResponse }),
    retrieve: retrieveTool({ uiStream, fullResponse }),
  };

  if (process.env.SERPER_API_KEY) {
    tools.videoSearch = videoSearchTool({ uiStream, fullResponse });
  }

  return tools;
};
