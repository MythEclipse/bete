import type { MessageRecord } from "../../types/messages";
import { ScrollArea } from "../ui/scroll-area";
import { MessageCard } from "./MessageCard";

export interface MessageFeedProps {
  messages: MessageRecord[];
  onReanalyze: (id: string) => void;
  emptyText?: string;
}

export function MessageFeed({ messages, onReanalyze, emptyText = "No messages found." }: MessageFeedProps) {
  if (messages.length === 0) {
    return <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">{emptyText}</div>;
  }

  return (
    <ScrollArea className="h-[calc(100vh-260px)] pr-3">
      <div className="space-y-3">
        {messages.map((message) => (
          <MessageCard key={message.id} message={message} onReanalyze={onReanalyze} />
        ))}
      </div>
    </ScrollArea>
  );
}
