"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Chat } from "@/lib/types";
import { cn } from "@/lib/utils";

interface HistoryItemProps {
  chat: Chat;
}

const formatDateWithTime = (date: Date | string) => {
  const parsedDate = new Date(date);
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const formatTime = (date: Date) => {
    return date.toLocaleString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  if (
    parsedDate.getDate() === now.getDate() &&
    parsedDate.getMonth() === now.getMonth() &&
    parsedDate.getFullYear() === now.getFullYear()
  ) {
    return `Today, ${formatTime(parsedDate)}`;
  } else if (
    parsedDate.getDate() === yesterday.getDate() &&
    parsedDate.getMonth() === yesterday.getMonth() &&
    parsedDate.getFullYear() === yesterday.getFullYear()
  ) {
    return `Yesterday, ${formatTime(parsedDate)}`;
  } else {
    return parsedDate.toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }
};

export const HistoryItem: React.FC<HistoryItemProps> = ({ chat }) => {
  const pathname = usePathname();
  const isActive = pathname === chat.path;

  return (
    <Link
      href={chat.path}
      className={cn(
        "flex cursor-pointer flex-col rounded border p-2 hover:bg-muted",
        isActive ? "border-border bg-muted/70" : "border-transparent",
      )}
    >
      <div className="select-none truncate text-xs font-medium">
        {chat.title}
      </div>
      <div className="text-xs text-muted-foreground">
        {formatDateWithTime(chat.createdAt)}
      </div>
    </Link>
  );
};
