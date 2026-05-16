import type { ActiveSpeaker, Channel, Guild, VoiceStatus } from "../../types/voice";
import { AudioVisualizer } from "./AudioVisualizer";
import { ActiveSpeakers } from "./ActiveSpeakers";
import { VoiceControl } from "./VoiceControl";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface VoicePanelProps {
  guilds: Guild[];
  channels: Channel[];
  selectedGuild: string;
  selectedChannel: string;
  status: VoiceStatus;
  loading: boolean;
  activeSpeakers: ActiveSpeaker[];
  levels: number[];
  isListening: boolean;
  isStreaming: boolean;
  onGuildChange: (guildId: string) => void;
  onChannelChange: (channelId: string) => void;
  onJoin: () => void;
  onDisconnect: () => void;
  onListenToggle: () => void;
  onStreamingToggle: () => void;
}

export function VoicePanel(props: VoicePanelProps) {
  return (
    <div className="grid gap-6">
      <VoiceControl {...props} />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Live Audio Visualizer</CardTitle>
          </CardHeader>
          <CardContent>
            <AudioVisualizer levels={props.levels} />
          </CardContent>
        </Card>
        <ActiveSpeakers speakers={props.activeSpeakers} />
      </div>
    </div>
  );
}
