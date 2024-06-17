import { notFound, redirect } from "next/navigation";
import { AI } from "@/app/actions";
import { Chat } from "@/components/chat";
import { getChat } from "@/lib/actions/chat";

export const maxDuration = 60;

interface SearchIdPageProps {
  params: {
    id: string;
  };
}

export async function generateMetadata({ params }: SearchIdPageProps) {
  const chat = await getChat(params.id, "anonymous");
  return {
    title: chat?.title.toString().slice(0, 50) || "Search",
  };
}

export default async function SearchIdPage({ params }: SearchPageProps) {
  const userId = "anonymous";
  const chat = await getChat(params.id, userId);

  if (!chat) {
    redirect("/");
  }

  if (chat?.userId !== userId) {
    notFound();
  }

  return (
    <AI
      initialAIState={{
        chatId: chat.id,
        messages: chat.messages,
      }}
    >
      <Chat id={params.id} />
    </AI>
  );
}
