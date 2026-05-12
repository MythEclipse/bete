import { 
    createAudioPlayer, 
    createAudioResource, 
    AudioPlayerStatus, 
    VoiceConnection, 
    AudioPlayer,
    StreamType
} from "@discordjs/voice";
import { Readable } from "stream";

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
        // We assume the stream is Opus or PCM. 
        // For MediaRecorder (webm/opus), we might need to parse it.
        // But let's start with a simple resource.
        const resource = createAudioResource(stream, {
            inputType: StreamType.WebmOpus,
        });
        this.player.play(resource);
    }

    public stop() {
        this.player.stop();
    }
}

export const discordPlayer = new DiscordPlayer();
