import type { Channel, Guild, VoiceStatus } from "../../types/voice";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Select } from "../ui/select";

interface VoiceControlProps {
  guilds: Guild[];
  channels: Channel[];
  selectedGuild: string;
  selectedChannel: string;
  status: VoiceStatus;
  loading: boolean;
  onGuildChange: (guildId: string) => void;
  onChannelChange: (channelId: string) => void;
  onJoin: () => void;
  onDisconnect: () => void;
  onListenToggle: () => void;
  isListening: boolean;
}

export function VoiceControl({
  guilds,
  channels,
  selectedGuild,
  selectedChannel,
  status,
  loading,
  onGuildChange,
  onChannelChange,
  onJoin,
  onDisconnect,
  onListenToggle,
  isListening,
}: VoiceControlProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Voice Bridge</CardTitle>
        <CardDescription>Join a Discord voice channel and monitor audio in real time.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Guild</label>
            <Select
              value={selectedGuild}
              onChange={(event) => onGuildChange(event.target.value)}
              placeholder="Select guild"
              options={guilds.map((guild) => ({ value: guild.id, label: guild.name }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Voice Channel</label>
            <Select
              value={selectedChannel}
              onChange={(event) => onChannelChange(event.target.value)}
              placeholder="Select voice channel"
              options={channels.map((channel) => ({ value: channel.id, label: channel.name }))}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={!selectedGuild || !selectedChannel || loading} onClick={onJoin}>
            {status.connected ? "Reconnect" : "Join Voice"}
          </Button>
          <Button variant="destructive" disabled={!status.connected || loading} onClick={onDisconnect}>
            Disconnect
          </Button>
          <Button variant={isListening ? "secondary" : "outline"} onClick={onListenToggle}>
            {isListening ? "Stop Listening" : "Listen Live"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
