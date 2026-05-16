import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { MediaPanel } from "./components/media/MediaPanel";
import { MessagesPanel } from "./components/messages/MessagesPanel";
import { ReviewPanel } from "./components/review/ReviewPanel";
import { Tabs, TabsContent } from "./components/ui/tabs";
import { VoicePanel } from "./components/voice/VoicePanel";
import { useDashboardSocket } from "./hooks/useDashboardSocket";
import { mergeMessages, useMessages } from "./hooks/useMessages";
import { useMediaControl } from "./hooks/useMediaControl";
import { useUIState } from "./hooks/useUIState";
import { useVoiceControl } from "./hooks/useVoiceControl";
import type { MessageRecord } from "./types/messages";
import type { DashboardTab } from "./types/ui";
import type { ActiveSpeaker } from "./types/voice";

const SAMPLE_RATE = 24000;
const CHANNELS = 1;

export default function App() {
  const { uiState, setUIState, patchUIState } = useUIState();
  const voice = useVoiceControl();
  const media = useMediaControl();
  const messages = useMessages();
  const [activeSpeakers, setActiveSpeakers] = useState<ActiveSpeaker[]>([]);
  const [levels, setLevels] = useState<number[]>(Array.from({ length: 32 }, () => 0.04));
  const [isListening, setIsListening] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const userTimelinesRef = useRef(new Map<number, number>());

  const activeTab = uiState.activeTab || "voice";
  const selectedVoiceGuild = uiState.selectedVoiceGuild || uiState.selectedGuild || "";
  const selectedVoiceChannel = uiState.selectedVoiceChannel || "";
  const selectedTextGuild = uiState.selectedTextGuild || uiState.selectedGuild || "";
  const selectedTextChannel = uiState.selectedTextChannel || "";

  const handleIncomingPcm = useCallback((data: ArrayBuffer) => {
    const headerView = new DataView(data, 0, 4);
    const userIdHash = headerView.getInt32(0, true);
    const audioData = data.slice(4);
    const int16Array = new Int16Array(audioData);
    let sum = 0;
    for (const sample of int16Array) sum += Math.abs(sample / 32768);
    const average = int16Array.length ? sum / int16Array.length : 0;
    setLevels((prev) => prev.map((_, index) => Math.max(0.04, average * (0.5 + Math.sin(index * 0.6 + Date.now() / 140) * 0.35 + 0.65) * 5)));

    const audioContext = audioContextRef.current;
    if (!isListening || !audioContext) return;
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) float32Array[i] = int16Array[i] / 32768;
    const audioBuffer = audioContext.createBuffer(CHANNELS, float32Array.length / CHANNELS, SAMPLE_RATE);
    audioBuffer.getChannelData(0).set(float32Array);
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    const currentTime = audioContext.currentTime;
    let nextStart = userTimelinesRef.current.get(userIdHash) || 0;
    if (nextStart < currentTime) nextStart = currentTime + 0.05;
    source.start(nextStart);
    userTimelinesRef.current.set(userIdHash, nextStart + audioBuffer.duration);
  }, [isListening]);

  const socket = useDashboardSocket({
    onUIState: (state) => setUIState((prev) => ({ ...prev, ...state })),
    onUserState: setActiveSpeakers,
    onMessageCreated: (message) => messages.setMessages((prev) => mergeMessages(prev, [message])),
    onMessageUpdated: (message) => messages.setMessages((prev) => prev.map((item) => (item.id === message.id ? { ...item, ...message } as MessageRecord : item))),
    onMessageDeleted: (message) => messages.setMessages((prev) => prev.map((item) => (item.id === message.id ? { ...item, type: "deleted" } : item))),
    onMessageAnalyzed: (message) => messages.setMessages((prev) => mergeMessages(prev, [message])),
    onAttachmentUploaded: () => messages.fetchMessages(selectedTextChannel).catch(() => undefined),
    onMediaState: media.setMediaState,
    onPcm: handleIncomingPcm,
  });

  useEffect(() => {
    if (selectedVoiceGuild) voice.loadVoiceChannels(selectedVoiceGuild).catch(() => undefined);
  }, [selectedVoiceGuild, voice.loadVoiceChannels]);

  useEffect(() => {
    if (selectedTextGuild) voice.loadTextTargets(selectedTextGuild).catch(() => undefined);
  }, [selectedTextGuild, voice.loadTextTargets]);

  useEffect(() => {
    messages.fetchMessages(selectedTextChannel).catch(() => undefined);
  }, [selectedTextChannel, messages.fetchMessages]);

  const toggleListening = useCallback(async () => {
    if (isListening) {
      await audioContextRef.current?.suspend();
      userTimelinesRef.current.clear();
      setIsListening(false);
      await patchUIState({ isListening: false });
      return;
    }
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    audioContextRef.current ??= new AudioContextCtor({ sampleRate: SAMPLE_RATE });
    await audioContextRef.current.resume();
    setIsListening(true);
    await patchUIState({ isListening: true });
  }, [isListening, patchUIState]);

  const tabs = useMemo(() => ["voice", "media", "messages", "review"] as DashboardTab[], []);

  return (
    <DashboardLayout
      activeTab={activeTab}
      wsStatus={socket.status}
      voiceStatus={voice.voiceStatus}
      onTabChange={(tab) => patchUIState({ activeTab: tab })}
    >
      <div className="md:hidden">
        <Tabs value={activeTab} onValueChange={(value) => patchUIState({ activeTab: value as DashboardTab })}>
          <div className="mb-4 grid grid-cols-4 gap-2 rounded-2xl bg-muted p-1">
            {tabs.map((tab) => (
              <button key={tab} className={`rounded-xl px-2 py-2 text-xs font-medium ${activeTab === tab ? "bg-background text-foreground" : "text-muted-foreground"}`} onClick={() => patchUIState({ activeTab: tab })}>
                {tab}
              </button>
            ))}
          </div>
        </Tabs>
      </div>
      <Tabs value={activeTab} onValueChange={(value) => patchUIState({ activeTab: value as DashboardTab })}>
        <TabsContent value="voice">
          <VoicePanel
            guilds={voice.guilds}
            channels={voice.voiceChannels}
            selectedGuild={selectedVoiceGuild}
            selectedChannel={selectedVoiceChannel}
            status={voice.voiceStatus}
            loading={voice.loading}
            activeSpeakers={activeSpeakers}
            levels={levels}
            isListening={isListening}
            onGuildChange={(guildId) => patchUIState({ selectedVoiceGuild: guildId, selectedVoiceChannel: "" })}
            onChannelChange={(channelId) => patchUIState({ selectedVoiceChannel: channelId })}
            onJoin={() => voice.joinVoice(selectedVoiceGuild, selectedVoiceChannel)}
            onDisconnect={() => voice.leaveVoice()}
            onListenToggle={toggleListening}
          />
        </TabsContent>
        <TabsContent value="media">
          <MediaPanel
            state={media.mediaState}
            loading={media.loading}
            onQueueMusic={(source) => media.enqueue(source, "music")}
            onStartScreen={(source) => media.enqueue(source, "screen")}
            onSkip={media.skip}
            onStop={media.stop}
          />
        </TabsContent>
        <TabsContent value="messages">
          <MessagesPanel
            guilds={voice.guilds}
            channels={voice.textChannels}
            selectedGuild={selectedTextGuild}
            selectedChannel={selectedTextChannel}
            messages={messages.messages}
            onGuildChange={(guildId) => patchUIState({ selectedTextGuild: guildId, selectedTextChannel: "" })}
            onChannelChange={(channelId) => patchUIState({ selectedTextChannel: channelId })}
            onReanalyze={messages.reanalyze}
          />
        </TabsContent>
        <TabsContent value="review">
          <ReviewPanel messages={messages.messages} onReanalyze={messages.reanalyze} />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
