import type { ActiveSpeaker } from "../../types/voice";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface ActiveSpeakersProps {
  speakers: ActiveSpeaker[];
}

export function ActiveSpeakers({ speakers }: ActiveSpeakersProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Speakers</CardTitle>
      </CardHeader>
      <CardContent>
        {speakers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No active speakers.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {speakers.map((speaker, index) => (
              <div key={speaker.userId || speaker.id || index} className="flex items-center gap-3 rounded-xl border border-border bg-background/60 p-3">
                <img src={speaker.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{speaker.username}</div>
                  <div className="text-xs text-emerald-300">Speaking</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
