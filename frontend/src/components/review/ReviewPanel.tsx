import { useMemo, useState } from "react";
import type { MessageRecord } from "../../types/messages";
import { useReview, type ReviewStatus } from "../../hooks/useReview";
import { MessageCard } from "../messages/MessageCard";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

export interface ReviewPanelProps {
  messages: MessageRecord[];
  onReanalyze: (id: string) => void;
}

type ReviewFilter = "all" | "warn" | "flagged" | "error";

const statusOptions = [
  { value: "all", label: "All reviewable" },
  { value: "warn", label: "Warn" },
  { value: "flagged", label: "Flagged" },
  { value: "error", label: "Errors" },
];

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

function ReviewDecisionControls({
  message,
  onReanalyze,
}: {
  message: MessageRecord;
  onReanalyze: (id: string) => void;
}) {
  const { createReview, loading, error } = useReview();
  const [notes, setNotes] = useState("");
  const [reviewerId, setReviewerId] = useState("public-eval");
  const [savedStatus, setSavedStatus] = useState<ReviewStatus | null>(null);

  const submitDecision = async (status: ReviewStatus) => {
    const review = await createReview({
      message_id: message.id,
      guild_id: message.guild_id,
      channel_id: message.channel_id,
      reviewer_id: reviewerId.trim() || "public-eval",
      status,
      notes: notes.trim() || null,
      reviewed_at: Date.now(),
    });
    setSavedStatus(review.status);
    if (status === "rejected") {
      onReanalyze(message.id);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">AI Eval Decision</span>
        {savedStatus ? <Badge variant="success">saved: {savedStatus}</Badge> : null}
      </div>
      <div className="grid gap-2 md:grid-cols-[160px_1fr]">
        <Input
          value={reviewerId}
          onChange={(event) => setReviewerId(event.target.value)}
          placeholder="reviewer label"
        />
        <Input
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="reason / evaluation note"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={loading} onClick={() => submitDecision("approved")}>
          Approve AI
        </Button>
        <Button size="sm" variant="outline" disabled={loading} onClick={() => submitDecision("rejected")}>
          False Positive + Reanalyze
        </Button>
        <Button size="sm" variant="outline" disabled={loading} onClick={() => submitDecision("escalated")}>
          Escalate
        </Button>
      </div>
      {error ? <div className="mt-2 text-xs text-destructive">{error}</div> : null}
    </div>
  );
}

export function ReviewPanel({ messages, onReanalyze }: ReviewPanelProps) {
  const [statusFilter, setStatusFilter] = useState<ReviewFilter>("all");
  const [severityFilter, setSeverityFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const reviewable = useMemo(
    () => messages.filter((message) => message.ai_status === "warn" || message.ai_status === "flagged" || message.ai_status === "error"),
    [messages],
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const message of reviewable) {
      for (const category of parseStringList(message.ai_categories ?? message.ai_moderation_flags)) {
        set.add(category);
      }
    }
    return Array.from(set).sort();
  }, [reviewable]);

  const filtered = reviewable.filter((message) => {
    if (statusFilter !== "all" && message.ai_status !== statusFilter) return false;
    if (severityFilter && message.ai_severity !== severityFilter) return false;
    if (categoryFilter) {
      const messageCategories = parseStringList(message.ai_categories ?? message.ai_moderation_flags);
      if (!messageCategories.includes(categoryFilter)) return false;
    }
    return true;
  });

  const flaggedItems = filtered.filter(
    (message) => message.ai_status === "warn" || message.ai_status === "flagged",
  );
  const errorItems = filtered.filter((message) => message.ai_status === "error");

  const renderList = (items: MessageRecord[], emptyText: string) => (
    <div className="space-y-3">
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {emptyText}
        </div>
      ) : (
        items.map((message) => (
          <div key={message.id} className="space-y-2">
            <MessageCard message={message} onReanalyze={onReanalyze} />
            <ReviewDecisionControls message={message} onReanalyze={onReanalyze} />
          </div>
        ))
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Moderation Review & AI Eval</CardTitle>
        <CardDescription>
          Public AI evaluation queue: {reviewable.length} reviewable messages, {errorItems.length} analysis errors.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid gap-2 md:grid-cols-3">
          <Select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as ReviewFilter)}
            options={statusOptions}
          />
          <Select
            value={severityFilter}
            onChange={(event) => setSeverityFilter(event.target.value)}
            placeholder="All severities"
            options={["none", "low", "medium", "high", "critical"].map((severity) => ({ value: severity, label: severity }))}
          />
          <Select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            placeholder="All categories"
            options={categories.map((category) => ({ value: category, label: category }))}
          />
        </div>
        <Tabs defaultValue="flags">
          <TabsList>
            <TabsTrigger value="flags">Flags ({flaggedItems.length})</TabsTrigger>
            <TabsTrigger value="errors">Errors ({errorItems.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="flags">
            {renderList(flaggedItems, "No warned or flagged messages match the filters.")}
          </TabsContent>
          <TabsContent value="errors">
            {renderList(errorItems, "No analysis errors match the filters.")}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
