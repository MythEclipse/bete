import { useEffect, useMemo, useState } from "react";
import type { ActiveSpeaker, Channel, Guild, VoiceStatus } from "../../types/voice";
import type { MediaState } from "../../types/media";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { AudioVisualizer } from "../voice/AudioVisualizer";
import { Music2, MonitorUp, Mic, Download, Headphones, Radio, SkipForward, Square, Volume2 } from "lucide-react";

// ─── Voice Recordings type ───
interface VoiceRecording {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  guild_id: string | null;
  channel_id: string | null;
  channel_name: string | null;
  filename: string;
  size_bytes: number;
  download_url: string | null;
  upload_status: "pending" | "uploaded" | "failed";
  upload_error: string | null;
  created_at: number;
  uploaded_at: number | null;
}

function formatDate(value: number): string {
  return new Date(value).toLocaleString();
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

// ─── Recordings Sub-Panel ───
function RecordingsSubPanel() {
  const [recordings, setRecordings] = useState<VoiceRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useMemo(() => {
    let cancelled = false;
    async function loadRecordings() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/recordings");
        if (!response.ok) throw new Error(`Failed to load recordings: ${response.status}`);
        const data = (await response.json()) as VoiceRecording[];
        if (!cancelled) setRecordings(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadRecordings();
    window.addEventListener("voice_recording_uploaded", loadRecordings);
    return () => { cancelled = true; window.removeEventListener("voice_recording_uploaded", loadRecordings); };
  }, []);

  if (loading) return <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Loading recordings...</div>;
  if (error) return <div className="rounded-xl border border-dashed border-destructive p-6 text-center text-sm text-destructive">{error}</div>;
  if (recordings.length === 0) return <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No recordings found.</div>;

  return (
    <div className="space-y-3">
      {recordings.map((rec) => (
        <div key={rec.id} className="flex items-center gap-4 rounded-xl border border-border bg-background/60 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Mic className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{rec.filename}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <span>{rec.username}</span>
              <span>·</span>
              <span>{rec.channel_name ?? rec.channel_id ?? "unknown"}</span>
              <span>·</span>
              <span>{formatDate(rec.created_at)}</span>
              <span>·</span>
              <span>{formatBytes(rec.size_bytes)}</span>
            </div>
            {rec.upload_error && <div className="mt-1 text-xs text-destructive">{rec.upload_error}</div>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant={rec.upload_status === "uploaded" ? "success" : rec.upload_status === "failed" ? "destructive" : "secondary"}>
              {rec.upload_status}
            </Badge>
            {rec.download_url && (
              <a href={rec.download_url} target="_blank" rel="noreferrer" className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                <Download className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Music Player Sub-Panel ───
function MusicSubPanel({ volume, onVolumeChange, onQueue, onSkip, onStop, loading }: {
  volume: number; onVolumeChange: (v: number) => void; onQueue: (s: string) => void;
  onSkip: () => void; onStop: () => void; loading: boolean;
}) {
  const [source, setSource] = useState("");
  const safeVolume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 1;
  const [draftVolume, setDraftVolume] = useState(Math.round(safeVolume * 100));

  useEffect(() => {
    const id = setInterval(() => {
      const normalized = draftVolume / 100;
      if (Math.abs(normalized - safeVolume) >= 0.001) onVolumeChange(normalized);
    }, 200);
    return () => clearInterval(id);
  }, [draftVolume, safeVolume, onVolumeChange]);

  const submit = () => { const t = source.trim(); if (!t) return; onQueue(t); setSource(""); };

  return (
    <div className="space-y-4">
      <Input value={source} onChange={(e) => setSource(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="YouTube URL, Spotify track, or search terms" />
      <div className="flex items-center gap-3">
        <Volume2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input type="range" min={0} max={100} step={1} value={draftVolume} onChange={(e) => setDraftVolume(Number(e.target.value))} className="h-2 w-full cursor-pointer accent-primary" />
        <span className="w-10 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{draftVolume}%</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={loading || !source.trim()} onClick={submit}><Music2 className="mr-1.5 h-4 w-4" /> Queue</Button>
        <Button variant="secondary" disabled={loading} onClick={onSkip}><SkipForward className="mr-1.5 h-4 w-4" /> Skip</Button>
        <Button variant="destructive" disabled={loading} onClick={onStop}><Square className="mr-1.5 h-4 w-4" /> Stop</Button>
      </div>
    </div>
  );
}

// ─── Screen Share Sub-Panel ───
function ScreenSubPanel({ onStart, onSkip, onStop, loading }: {
  onStart: (s: string) => void; onSkip: () => void; onStop: () => void; loading: boolean;
}) {
  const [source, setSource] = useState("");
  const submit = () => { const t = source.trim(); if (!t) return; onStart(t); setSource(""); };

  return (
    <div className="space-y-4">
      <Input value={source} onChange={(e) => setSource(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Screen share URL or local file path" />
      <div className="flex flex-wrap gap-2">
        <Button disabled={loading || !source.trim()} onClick={submit}><MonitorUp className="mr-1.5 h-4 w-4" /> Start</Button>
        <Button variant="secondary" disabled={loading} onClick={onSkip}><SkipForward className="mr-1.5 h-4 w-4" /> Skip</Button>
        <Button variant="destructive" disabled={loading} onClick={onStop}><Square className="mr-1.5 h-4 w-4" /> Stop</Button>
      </div>
    </div>
  );
}

// ─── Main Unified Panel ───
interface LivePanelProps {
  guilds: Guild[];
  voiceChannels: Channel[];
  selectedGuild: string;
  selectedChannel: string;
  status: VoiceStatus;
  voiceLoading: boolean;
  activeSpeakers: ActiveSpeaker[];
  levels: number[];
  isListening: boolean;
  isStreaming: boolean;
  mediaState: MediaState;
  mediaLoading: boolean;
  onGuildChange: (id: string) => void;
  onChannelChange: (id: string) => void;
  onJoin: () => void;
  onDisconnect: () => void;
  onListenToggle: () => void;
  onStreamingToggle: () => void;
  onQueueMusic: (s: string) => void;
  onStartScreen: (s: string) => void;
  onSkip: () => void;
  onStop: () => void;
  onVolumeChange: (v: number) => void;
}

export function LivePanel({
  guilds, voiceChannels, selectedGuild, selectedChannel,
  status, voiceLoading, activeSpeakers, levels, isListening, isStreaming,
  mediaState, mediaLoading,
  onGuildChange, onChannelChange, onJoin, onDisconnect,
  onListenToggle, onStreamingToggle,
  onQueueMusic, onStartScreen, onSkip, onStop, onVolumeChange,
}: LivePanelProps) {
  return (
    <div className="grid gap-6">
      {/* Voice Connection Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Radio className="h-5 w-5" /> Voice Bridge</CardTitle>
          <CardDescription>Join a Discord voice channel, listen, and transmit audio.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Guild</label>
              <Select value={selectedGuild} onChange={(e) => onGuildChange(e.target.value)} placeholder="Select guild" options={guilds.map((g) => ({ value: g.id, label: g.name }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Voice Channel</label>
              <Select value={selectedChannel} onChange={(e) => onChannelChange(e.target.value)} placeholder="Select voice channel" options={voiceChannels.map((c) => ({ value: c.id, label: c.name }))} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={!selectedGuild || !selectedChannel || voiceLoading} onClick={onJoin}>{status.connected ? "Reconnect" : "Join Voice"}</Button>
            <Button variant="destructive" disabled={!status.connected || voiceLoading} onClick={onDisconnect}>Disconnect</Button>
            <Button variant={isListening ? "secondary" : "outline"} onClick={onListenToggle}><Headphones className="mr-1.5 h-4 w-4" /> {isListening ? "Stop Listening" : "Listen"}</Button>
            <Button variant={isStreaming ? "destructive" : "default"} onClick={onStreamingToggle}><Radio className="mr-1.5 h-4 w-4" /> {isStreaming ? "Stop Transmit" : "Transmit"}</Button>
          </div>
        </CardContent>
      </Card>

      {/* Audio Visualizer + Active Speakers */}
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Live Audio</CardTitle>
          </CardHeader>
          <CardContent>
            <AudioVisualizer levels={levels} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Active Speakers</CardTitle>
          </CardHeader>
          <CardContent>
            {activeSpeakers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No active speakers.</div>
            ) : (
              <div className="space-y-2">
                {activeSpeakers.map((s, i) => (
                  <div key={s.userId || s.id || i} className="flex items-center gap-3 rounded-xl border border-border bg-background/60 p-3">
                    <img src={s.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{s.username}</div>
                      <div className="text-xs text-emerald-300">Speaking</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Now Playing / Queue */}
      {mediaState.current && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {mediaState.current.mode === "screen" ? <MonitorUp className="h-4 w-4" /> : <Music2 className="h-4 w-4" />}
              Now Playing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4">
              <div className="min-w-0">
                <div className="truncate font-medium">{mediaState.current.title}</div>
                <div className="truncate text-xs text-muted-foreground">{mediaState.current.source}</div>
              </div>
              <Badge variant={mediaState.current.mode === "screen" ? "warning" : "success"}>{mediaState.current.mode || "music"}</Badge>
            </div>
            {mediaState.queue.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <div className="text-sm font-medium">Queue ({mediaState.queue.length})</div>
                {mediaState.queue.map((item, i) => (
                  <div key={`${item.source}-${i}`} className="flex items-center gap-3 rounded-lg border border-border bg-background/60 p-2.5 text-sm">
                    <span className="h-5 w-5 flex shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">{i + 1}</span>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{item.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{item.source}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Music + Screen Share + Recordings tabs */}
      <Tabs defaultValue="music">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="music"><Music2 className="mr-1.5 h-4 w-4" /> Music</TabsTrigger>
          <TabsTrigger value="screen"><MonitorUp className="mr-1.5 h-4 w-4" /> Screen Share</TabsTrigger>
          <TabsTrigger value="recordings"><Mic className="mr-1.5 h-4 w-4" /> Recordings</TabsTrigger>
        </TabsList>
        <TabsContent value="music">
          <MusicSubPanel volume={mediaState.musicVolume} onVolumeChange={onVolumeChange} onQueue={onQueueMusic} onSkip={onSkip} onStop={onStop} loading={mediaLoading} />
        </TabsContent>
        <TabsContent value="screen">
          <ScreenSubPanel onStart={onStartScreen} onSkip={onSkip} onStop={onStop} loading={mediaLoading} />
        </TabsContent>
        <TabsContent value="recordings">
          <RecordingsSubPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
