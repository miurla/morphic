"use client";

import { useEffect, useState } from "react";
import {
  useActions,
  useStreamableValue,
  useUIState,
  type StreamableValue,
} from "ai/rsc";
import { ArrowRight } from "lucide-react";
import { AI } from "@/app/actions";
import { Button } from "@/components/ui/button";
import type { PartialRelated } from "@/lib/schema/related";
import { UserMessage } from "./user-message";

interface SearchRelatedProps {
  relatedQueries: StreamableValue<PartialRelated>;
}

export const SearchRelated: React.FC<SearchRelatedProps> = ({
  relatedQueries,
}) => {
  const { submit } = useActions();
  const [, setMessages] = useUIState<typeof AI>();
  const [data, error, pending] = useStreamableValue(relatedQueries);
  const [related, setRelated] = useState<PartialRelated>();

  useEffect(() => {
    if (!data) return;
    setRelated(data);
  }, [data]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget as HTMLFormElement);

    // // Get the submitter of the form
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLInputElement;
    let query = "";
    if (submitter) {
      formData.append(submitter.name, submitter.value);
      query = submitter.value;
    }

    const userMessage = {
      id: Date.now(),
      component: <UserMessage message={query} />,
    };

    const responseMessage = await submit(formData);
    setMessages((currentMessages) => [
      ...currentMessages,
      userMessage,
      responseMessage,
    ]);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap">
      {related?.items
        ?.filter((item) => item?.query !== "")
        .map((item, index) => (
          <div className="flex w-full items-start" key={index}>
            <ArrowRight className="mr-2 mt-1 h-4 w-4 flex-shrink-0 text-accent-foreground/50" />
            <Button
              variant="link"
              className="h-fit flex-1 justify-start whitespace-normal px-0 py-1 text-left font-semibold text-accent-foreground/50"
              type="submit"
              name={"related_query"}
              value={item?.query}
            >
              {item?.query}
            </Button>
          </div>
        ))}
    </form>
  );
};
