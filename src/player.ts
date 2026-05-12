import { 
    createAudioPlayer, 
    createAudioResource, 
    AudioPlayerStatus, 
    VoiceConnection, 
    AudioPlayer,
    StreamType
} from "@discordjs/voice";
import { Readable } from "stream";

import prism from "prism-media";

export class DiscordPlayer {
    private player: AudioPlayer;
    private connection: VoiceConnection | null = null;

    constructor() {
        this.player = createAudioPlayer();
        
        this.player.on(AudioPlayerStatus.Playing, () => {
            console.log("[player] Audio player is now playing!");
        });

        this.player.on("error", error => {
            console.error(`[player] Error: ${error.message}`);
        });
    }

    public setConnection(connection: VoiceConnection) {
        this.connection = connection;
        this.connection.subscribe(this.player);
    }

    public playStream(stream: Readable) {
        // Use WebmDemuxer to extract Opus packets from browser stream
        const demuxer = new prism.opus.WebmDemuxer();
        
        const resource = createAudioResource(stream.pipe(demuxer), {
            inputType: StreamType.Opus,
        });
        
        this.player.play(resource);
    }

    public stop() {
        this.player.stop();
    }
}

export const discordPlayer = new DiscordPlayer();
