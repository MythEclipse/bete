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

function parseStringList(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

export function MessageCard({ message, onReanalyze }: MessageCardProps) {
  const displayContent = message.edited_content ?? message.content;
  const aiStatus = message.ai_status ?? "pending";
  const categories = parseStringList(message.ai_categories ?? message.ai_moderation_flags);
  const evidence = parseStringList(message.ai_evidence);
  const confidence = message.ai_confidence ?? message.ai_moderation_score ?? null;
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
          <div className="flex flex-wrap gap-2 text-xs">
            {message.ai_severity ? <Badge variant="outline">severity: {message.ai_severity}</Badge> : null}
            {message.ai_recommended_action ? <Badge variant="outline">action: {message.ai_recommended_action}</Badge> : null}
            {confidence != null ? <Badge variant="outline">confidence: {Math.round(confidence * 100)}%</Badge> : null}
            {message.ai_policy_version ? <Badge variant="outline">policy: {message.ai_policy_version}</Badge> : null}
            {categories.slice(0, 6).map((category) => (
              <Badge key={category} variant="secondary">{category}</Badge>
            ))}
          </div>
          {message.ai_analysis ? (
            <div className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
              {message.ai_analysis}
            </div>
          ) : null}
          {evidence.length > 0 ? (
            <div className="rounded-xl border border-border bg-background/50 p-3 text-xs text-muted-foreground">
              <div className="mb-1 font-medium text-foreground/80">Evidence</div>
              <ul className="list-disc space-y-1 pl-4">
                {evidence.slice(0, 4).map((item, index) => (
                  <li key={`${message.id}-evidence-${index}`}>{item}</li>
                ))}
              </ul>
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
