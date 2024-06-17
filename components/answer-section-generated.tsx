"use client";

import { BotMessage } from "./message";
import { Section } from "./section";

interface AnswerSectionProps {
  result: string;
}

export function AnswerSectionGenerated({ result }: AnswerSectionProps) {
  return (
    <div>
      <Section title="Answer">
        <BotMessage content={result} />
      </Section>
    </div>
  );
}
