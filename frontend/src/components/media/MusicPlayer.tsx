import { Music2 } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";

interface MusicPlayerProps {
  loading: boolean;
  onQueue: (source: string) => void;
  onSkip: () => void;
  onStop: () => void;
}

export function MusicPlayer({ loading, onQueue, onSkip, onStop }: MusicPlayerProps) {
  const [source, setSource] = useState("");

  const submit = () => {
    const trimmed = source.trim();
    if (!trimmed) return;
    onQueue(trimmed);
    setSource("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Music2 className="h-5 w-5" /> Music Player</CardTitle>
        <CardDescription>Play YouTube, Spotify tracks, search terms, or local files as audio.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          value={source}
          onChange={(event) => setSource(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && submit()}
          placeholder="YouTube URL, Spotify track, or search terms"
        />
        <div className="flex flex-wrap gap-2">
          <Button disabled={loading || !source.trim()} onClick={submit}>Queue / Play</Button>
          <Button variant="secondary" disabled={loading} onClick={onSkip}>Skip</Button>
          <Button variant="destructive" disabled={loading} onClick={onStop}>Stop</Button>
        </div>
      </CardContent>
    </Card>
  );
}
