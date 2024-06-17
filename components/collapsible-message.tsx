"use client";

import { useEffect, useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@radix-ui/react-collapsible";
import { useStreamableValue, type StreamableValue } from "ai/rsc";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface CollapsibleMessageProps {
  message: {
    id: string;
    isCollapsed?: StreamableValue<boolean>;
    component: React.ReactNode;
  };
  isLastMessage?: boolean;
}

export const CollapsibleMessage: React.FC<CollapsibleMessageProps> = ({
  message,
  isLastMessage = false,
}) => {
  const [data] = useStreamableValue(message.isCollapsed);
  const isCollapsed = data ?? false;
  const [open, setOpen] = useState(isLastMessage);

  useEffect(() => {
    setOpen(isLastMessage);
  }, [isCollapsed, isLastMessage]);

  // if not collapsed, return the component
  if (!isCollapsed) {
    return message.component;
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
      }}
    >
      <CollapsibleTrigger asChild>
        <div
          className={cn(
            "flex w-full justify-end",
            !isCollapsed ? "hidden" : "",
          )}
        >
          <Button variant="ghost" size="icon" className="-mt-3 rounded-full">
            <ChevronDown
              size={14}
              className={cn(
                open ? "rotate-180" : "rotate-0",
                "h-4 w-4 transition-all",
              )}
            />
            <span className="sr-only">collapse</span>
          </Button>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>{message.component}</CollapsibleContent>
      {!open && <Separator className="my-2 bg-muted" />}
    </Collapsible>
  );
};
