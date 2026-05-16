import { request } from "./client";
import type { Channel, Guild, VoiceStatus } from "../types/voice";

export function getGuilds(): Promise<Guild[]> {
  return request<Guild[]>('/api/guilds');
}

export function getVoiceChannels(guildId: string): Promise<Channel[]> {
  return request<Channel[]>(`/api/guilds/${guildId}/voice-channels`);
}

export function getTextChannels(guildId: string): Promise<Channel[]> {
  return request<Channel[]>(`/api/guilds/${guildId}/channels`);
}

export function getThreads(guildId: string): Promise<Channel[]> {
  return request<Channel[]>(`/api/guilds/${guildId}/threads`);
}

export function getVoiceStatus(): Promise<VoiceStatus> {
  return request<VoiceStatus>('/api/status');
}

export function connectVoice(guildId: string, channelId: string): Promise<VoiceStatus> {
  return request<VoiceStatus>('/api/connect', {
    method: 'POST',
    body: JSON.stringify({ guildId, channelId }),
  });
}

export function disconnectVoice(): Promise<VoiceStatus> {
  return request<VoiceStatus>('/api/disconnect', { method: 'POST' });
}
