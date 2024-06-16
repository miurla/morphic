import { createStreamableUI } from "ai/rsc";

export interface ToolProps {
  uiStream: ReturnType<typeof createStreamableUI>;
  fullResponse: string;
}
