import type { MediaState } from "../../types/media";
import { Badge } from "../ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

interface MediaQueueProps {
  state: MediaState;
}

export function MediaQueue({ state }: MediaQueueProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Now Playing</CardTitle>
        <CardDescription>Current item and queue state.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {state.current ? (
          <div className="rounded-xl border border-primary/30 bg-primary/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{state.current.title}</div>
                <div className="truncate text-xs text-muted-foreground">{state.current.source}</div>
              </div>
              <Badge variant={state.current.mode === "screen" ? "warning" : "success"}>{state.current.mode || "music"}</Badge>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No media playing.</div>
        )}
        <div className="space-y-2">
          <div className="text-sm font-medium">Queue</div>
          {state.queue.length === 0 ? (
            <div className="text-sm text-muted-foreground">Queue is empty.</div>
          ) : (
            state.queue.map((item, index) => (
              <div key={`${item.source}-${index}`} className="rounded-lg border border-border bg-background/60 p-3 text-sm">
                <div className="font-medium">{item.title}</div>
                <div className="truncate text-xs text-muted-foreground">{item.source}</div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
