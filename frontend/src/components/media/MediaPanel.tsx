import type { MediaState } from "../../types/media";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { MediaQueue } from "./MediaQueue";
import { MusicPlayer } from "./MusicPlayer";
import { ScreenShare } from "./ScreenShare";

interface MediaPanelProps {
  state: MediaState;
  loading: boolean;
  onQueueMusic: (source: string) => void;
  onStartScreen: (source: string) => void;
  onSkip: () => void;
  onStop: () => void;
}

export function MediaPanel({ state, loading, onQueueMusic, onStartScreen, onSkip, onStop }: MediaPanelProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <Tabs defaultValue="music" className="min-w-0">
        <TabsList>
          <TabsTrigger value="music">Music</TabsTrigger>
          <TabsTrigger value="screen">Screen Share</TabsTrigger>
        </TabsList>
        <TabsContent value="music">
          <MusicPlayer loading={loading} onQueue={onQueueMusic} onSkip={onSkip} onStop={onStop} />
        </TabsContent>
        <TabsContent value="screen">
          <ScreenShare loading={loading} onStart={onStartScreen} onSkip={onSkip} onStop={onStop} />
        </TabsContent>
      </Tabs>
      <MediaQueue state={state} />
    </div>
  );
}
