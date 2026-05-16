import { Music2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";

interface MusicPlayerProps {
  loading: boolean;
  volume: number;
  onVolumeChange: (volume: number) => void;
  onQueue: (source: string) => void;
  onSkip: () => void;
  onStop: () => void;
}

export function MusicPlayer({
  loading,
  volume,
  onVolumeChange,
  onQueue,
  onSkip,
  onStop,
}: MusicPlayerProps) {
  const [source, setSource] = useState("");
  const safeVolume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 1;
  const [draftVolume, setDraftVolume] = useState(Math.round(safeVolume * 100));

  useEffect(() => {
    setDraftVolume(Math.round(safeVolume * 100));
  }, [safeVolume]);

  useEffect(() => {
    const normalized = draftVolume / 100;
    if (Math.abs(normalized - safeVolume) < 0.001) return;
    const timer = window.setTimeout(() => {
      onVolumeChange(normalized);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [draftVolume, onVolumeChange, safeVolume]);

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
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Volume</span>
            <span className="text-muted-foreground">{draftVolume}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={draftVolume}
            onChange={(event) => setDraftVolume(Number(event.target.value))}
            className="h-2 w-full cursor-pointer accent-primary"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={loading || !source.trim()} onClick={submit}>Queue / Play</Button>
          <Button variant="secondary" disabled={loading} onClick={onSkip}>Skip</Button>
          <Button variant="destructive" disabled={loading} onClick={onStop}>Stop</Button>
        </div>
      </CardContent>
    </Card>
  );
}
