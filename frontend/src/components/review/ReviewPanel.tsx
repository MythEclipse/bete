import type { MessageRecord } from "../../types/messages";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { MessageFeed } from "../messages/MessageFeed";

export interface ReviewPanelProps {
  messages: MessageRecord[];
  onReanalyze: (id: string) => void;
}

export function ReviewPanel({ messages, onReanalyze }: ReviewPanelProps) {
  const reviewItems = messages.filter(
    (message) =>
      message.ai_status === "warn" ||
      message.ai_status === "flagged" ||
      message.ai_status === "error",
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Needs Review</CardTitle>
        <CardDescription>{reviewItems.length} captured messages require attention.</CardDescription>
      </CardHeader>
      <CardContent>
        <MessageFeed messages={reviewItems} onReanalyze={onReanalyze} emptyText="No warned, flagged, or errored messages." />
      </CardContent>
    </Card>
  );
}
