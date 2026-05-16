import type { Channel, Guild } from "../../types/voice";
import type { MessageRecord } from "../../types/messages";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Select } from "../ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { ImageGrid } from "./ImageGrid";
import { MessageFeed } from "./MessageFeed";

interface MessagesPanelProps {
  guilds: Guild[];
  channels: Channel[];
  selectedGuild: string;
  selectedChannel: string;
  messages: MessageRecord[];
  onGuildChange: (guildId: string) => void;
  onChannelChange: (channelId: string) => void;
  onReanalyze: (id: string) => void;
}

export function MessagesPanel({
  guilds,
  channels,
  selectedGuild,
  selectedChannel,
  messages,
  onGuildChange,
  onChannelChange,
  onReanalyze,
}: MessagesPanelProps) {
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Message Source</CardTitle>
          <CardDescription>Pick a guild and channel/thread to inspect captures.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Select
            value={selectedGuild}
            onChange={(event) => onGuildChange(event.target.value)}
            placeholder="Select text guild"
            options={guilds.map((guild) => ({ value: guild.id, label: guild.name }))}
          />
          <Select
            value={selectedChannel}
            onChange={(event) => onChannelChange(event.target.value)}
            placeholder="Select channel or thread"
            options={channels.map((channel) => ({ value: channel.id, label: channel.name }))}
          />
        </CardContent>
      </Card>
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Messages</TabsTrigger>
          <TabsTrigger value="images">Images</TabsTrigger>
        </TabsList>
        <TabsContent value="all">
          <MessageFeed messages={messages} onReanalyze={onReanalyze} emptyText={selectedChannel ? "No captures yet." : "Select a channel to view captures."} />
        </TabsContent>
        <TabsContent value="images">
          <ImageGrid messages={messages} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
