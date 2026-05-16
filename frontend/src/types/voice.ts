export interface Guild {
  id: string;
  name: string;
  icon?: string | null;
}

export interface Channel {
  id: string;
  name: string;
  type?: string;
  parentId?: string | null;
}

export interface VoiceStatus {
  connected: boolean;
  activeGuildId?: string | null;
  activeChannelId?: string | null;
  activeChannelName?: string | null;
}

export interface ActiveSpeaker {
  id?: string;
  userId?: string;
  username: string;
  avatar: string;
  speaking: boolean;
}
