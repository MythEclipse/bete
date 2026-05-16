import { MonitorUp } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";

interface ScreenShareProps {
  loading: boolean;
  onStart: (source: string) => void;
  onSkip: () => void;
  onStop: () => void;
}

export function ScreenShare({ loading, onStart, onSkip, onStop }: ScreenShareProps) {
  const [source, setSource] = useState("");

  const submit = () => {
    const trimmed = source.trim();
    if (!trimmed) return;
    onStart(trimmed);
    setSource("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><MonitorUp className="h-5 w-5" /> Screen Share</CardTitle>
        <CardDescription>Start screen-share playback from a URL or local file path.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          value={source}
          onChange={(event) => setSource(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && submit()}
          placeholder="Screen share URL or local file path"
        />
        <div className="flex flex-wrap gap-2">
          <Button disabled={loading || !source.trim()} onClick={submit}>Start Screen Share</Button>
          <Button variant="secondary" disabled={loading} onClick={onSkip}>Skip</Button>
          <Button variant="destructive" disabled={loading} onClick={onStop}>Stop</Button>
        </div>
      </CardContent>
    </Card>
  );
}
