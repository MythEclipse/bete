import { useState } from "react";
import type { Channel, Guild } from "../../types/voice";
import type { MessageRecord } from "../../types/messages";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Select } from "../ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { ImageGrid } from "./ImageGrid";
import { MessageFeed } from "./MessageFeed";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MessageRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const params = new URLSearchParams({
        q: searchQuery,
        ...(selectedChannel && { channelId: selectedChannel }),
        limit: "50",
      });

      const response = await fetch(`/api/analysis/search?${params}`);
      if (!response.ok) throw new Error("Search failed");

      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const displayMessages = showSearch ? searchResults : messages;

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

      <Card>
        <CardHeader>
          <CardTitle>Search Messages</CardTitle>
          <CardDescription>Search for messages by content</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search message content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              disabled={isSearching}
            />
            <Button onClick={handleSearch} disabled={isSearching || !searchQuery.trim()}>
              {isSearching ? "Searching..." : "Search"}
            </Button>
            {showSearch && (
              <Button
                variant="outline"
                onClick={() => {
                  setShowSearch(false);
                  setSearchResults([]);
                  setSearchQuery("");
                }}
              >
                Clear
              </Button>
            )}
          </div>
          {showSearch && searchResults.length > 0 && (
            <div className="text-sm text-muted-foreground">
              Found {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">
            {showSearch ? "Search Results" : "All Messages"}
          </TabsTrigger>
          <TabsTrigger value="images">Images</TabsTrigger>
        </TabsList>
        <TabsContent value="all">
          <MessageFeed
            messages={displayMessages}
            onReanalyze={onReanalyze}
            emptyText={
              showSearch
                ? "No messages found matching your search."
                : selectedChannel
                  ? "No captures yet."
                  : "Select a channel to view captures."
            }
          />
        </TabsContent>
        <TabsContent value="images">
          <ImageGrid messages={displayMessages} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
