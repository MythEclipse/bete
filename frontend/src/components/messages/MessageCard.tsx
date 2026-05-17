import { RotateCw, AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react";
import type { MessageRecord } from "../../types/messages";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { useState } from "react";

export interface MessageCardProps {
  message: MessageRecord;
  onReanalyze: (id: string) => void;
}

function aiVariant(status: string) {
  if (status === "clean") return "success";
  if (status === "warn") return "warning";
  if (status === "flagged" || status === "error") return "destructive";
  return "secondary";
}

function getAiIcon(status: string) {
  if (status === "clean") return <CheckCircle2 className="h-4 w-4" />;
  if (status === "warn") return <AlertTriangle className="h-4 w-4" />;
  if (status === "flagged") return <AlertCircle className="h-4 w-4" />;
  if (status === "error") return <AlertCircle className="h-4 w-4" />;
  return null;
}

export function MessageCard({ message, onReanalyze }: MessageCardProps) {
  const displayContent = message.edited_content ?? message.content;
  const aiStatus = message.ai_status ?? "pending";
  const [isReanalyzing, setIsReanalyzing] = useState(false);

  const handleReanalyze = async () => {
    setIsReanalyzing(true);
    try {
      onReanalyze(message.id);
    } finally {
      setIsReanalyzing(false);
    }
  };

  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex gap-3">
        <img
          src={message.avatar_url ?? "https://cdn.discordapp.com/embed/avatars/0.png"}
          alt=""
          className="h-10 w-10 rounded-full object-cover"
        />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{message.username || message.user_id}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(message.created_at).toLocaleString()}
            </span>
            {message.edited_at ? <Badge variant="outline">edited</Badge> : null}
            {message.deleted_at ? <Badge variant="destructive">deleted</Badge> : null}
            <Badge variant={aiVariant(aiStatus)} className="flex items-center gap-1">
              {getAiIcon(aiStatus)}
              {aiStatus}
            </Badge>
          </div>
          <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground/90">
            {displayContent || "(empty message)"}
          </p>
          {message.ai_analysis ? (
            <div className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
              {message.ai_analysis}
            </div>
          ) : null}
          {message.ai_error ? (
            <div className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              AI error: {message.ai_error}
            </div>
          ) : null}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={aiStatus === "error" ? "destructive" : "outline"}
              onClick={handleReanalyze}
              disabled={aiStatus === "pending" || isReanalyzing}
            >
              <RotateCw className={`h-3.5 w-3.5 ${isReanalyzing ? "animate-spin" : ""}`} />
              {isReanalyzing ? "Reanalyzing..." : "Re-analyze"}
            </Button>
            {aiStatus === "error" && (
              <span className="text-xs text-destructive self-center">
                Click to retry analysis
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
