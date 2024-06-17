import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const exampleMessages = [
  {
    heading: "What is Apple Intelligence?",
    message: "What is Apple Intelligence?",
  },
  {
    heading: "Why is Nvidia growing rapidly?",
    message: "Why is Nvidia growing rapidly?",
  },
  {
    heading: "How does the Vercel AI SDK work?",
    message: "How does the Vercel AI SDK work?",
  },
  {
    heading: "Tesla vs Rivian",
    message: "Tesla vs Rivian",
  },
];

interface EmptyScreenProps {
  submitMessage: (message: string) => void;
  className?: string;
}

export function EmptyScreen({ submitMessage, className }: EmptyScreenProps) {
  return (
    <div className={`mx-auto w-full transition-all ${className}`}>
      <div className="bg-background p-2">
        <div className="mb-4 mt-4 flex flex-col items-start space-y-2">
          {exampleMessages.map((message, index) => (
            <Button
              key={index}
              variant="link"
              className="h-auto p-0 text-base"
              name={message.message}
              onClick={async () => {
                submitMessage(message.message);
              }}
            >
              <ArrowRight size={16} className="mr-2 text-muted-foreground" />
              {message.heading}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
