import { nanoid } from "ai";
import { Chat } from "@/components/chat";
import { AI } from "./actions";

export const maxDuration = 60;

export default function Page() {
  const id = nanoid();
  return (
    <AI initialAIState={{ chatId: id, messages: [] }}>
      <Chat id={id} />
    </AI>
  );
}
