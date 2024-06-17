"use client";

import { useEffect, useState } from "react";
import { useStreamableValue, type StreamableValue } from "ai/rsc";
import { Skeleton } from "@/components/ui/skeleton";
import { BotMessage } from "./message";
import { Section } from "./section";

interface AnswerSectionProps {
  result?: StreamableValue<string>;
}

export function AnswerSection({ result }: AnswerSectionProps) {
  const [data, error, pending] = useStreamableValue(result);
  const [content, setContent] = useState<string>("");

  useEffect(() => {
    if (!data) return;
    setContent(data);
  }, [data]);

  return (
    <div>
      {content.length > 0 ? (
        <Section title="Answer">
          <BotMessage content={content} />
        </Section>
      ) : (
        <div className="flex flex-col gap-2 py-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-6 w-full" />
        </div>
      )}
    </div>
  );
}
