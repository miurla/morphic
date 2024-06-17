import { cache } from "react";
import { getChats } from "@/lib/actions/chat";
import type { Chat } from "@/lib/types";
import { ClearHistory } from "./clear-history";
import { HistoryItem } from "./history-item";

interface HistoryListProps {
  userId?: string;
}

const loadChats = cache(async (userId?: string) => {
  return await getChats(userId);
});

// Start of Selection
export async function HistoryList({ userId }: HistoryListProps) {
  const chats = await loadChats(userId);

  return (
    <div className="flex h-full flex-1 flex-col space-y-3">
      <div className="flex flex-1 flex-col space-y-0.5 overflow-y-auto">
        {!chats?.length ? (
          <div className="py-4 text-center text-sm text-foreground/30">
            No search history
          </div>
        ) : (
          chats?.map(
            (chat: Chat) => chat && <HistoryItem key={chat.id} chat={chat} />,
          )
        )}
      </div>
      <div className="mt-auto">
        <ClearHistory empty={!chats?.length} />
      </div>
    </div>
  );
}
