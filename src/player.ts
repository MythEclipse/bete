import { Readable } from "node:stream";
import {
  AudioPlayer,
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  StreamType,
  VoiceConnection,
} from "@discordjs/voice";
import type { DiscordPlayerOwner } from "./media/mediaTypes";

export class DiscordPlayer {
  private player: AudioPlayer;
  private connection: VoiceConnection | null = null;
  private owner: DiscordPlayerOwner = "none";

  constructor() {
    this.player = createAudioPlayer();

    this.player.on(AudioPlayerStatus.Playing, () => {
      console.log("[player] Audio player is now playing!");
    });

    this.player.on("error", (error) => {
      console.error(`[player] Error: ${error.message}`);
      this.owner = "none";
    });
  }

  public setConnection(connection: VoiceConnection) {
    this.connection = connection;
    this.connection.subscribe(this.player);
  }

  public getOwner(): DiscordPlayerOwner {
    return this.owner;
  }

  public isConnected(): boolean {
    return this.connection !== null;
  }

  public playStream(stream: Readable, owner: DiscordPlayerOwner) {
    if (owner === "none") {
      throw new Error("Discord audio player owner is required");
    }
    this.assertOwnerAvailable(owner);

    const resource = createAudioResource(stream, {
      inputType: StreamType.OggOpus,
    });

    if (this.owner === owner) {
      this.player.stop();
    }
    this.owner = owner;
    this.player.play(resource);
    this.connection?.subscribe(this.player);
  }

  public getStatus(): AudioPlayerStatus {
    return this.player.state.status;
  }

  public pause(owner?: DiscordPlayerOwner) {
    if (!this.canControl(owner)) return;
    this.player.pause(true);
  }

  public unpause(owner?: DiscordPlayerOwner): boolean {
    if (!this.canControl(owner)) return false;
    return this.player.unpause();
  }

  public stop(owner?: DiscordPlayerOwner) {
    if (!this.canControl(owner)) return;
    this.player.stop();
    this.owner = "none";
  }

  private assertOwnerAvailable(owner: DiscordPlayerOwner): void {
    if (this.owner !== "none" && this.owner !== owner) {
      throw new Error(`Discord audio player is owned by ${this.owner}`);
    }
  }

  private canControl(owner?: DiscordPlayerOwner): boolean {
    return !owner || this.owner === "none" || this.owner === owner;
  }
}

export const discordPlayer = new DiscordPlayer();
