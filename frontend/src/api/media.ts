import { request } from "./client";
import type { MediaMode, MediaState } from "../types/media";

export function getMediaStatus(): Promise<MediaState> {
  return request<MediaState>('/api/media/status');
}

export function queueMedia(source: string, mode: MediaMode): Promise<MediaState> {
  return request<MediaState>('/api/media/queue', {
    method: 'POST',
    body: JSON.stringify({ source, mode }),
  });
}

export function skipMedia(): Promise<MediaState> {
  return request<MediaState>('/api/media/skip', { method: 'POST' });
}

export function stopMedia(): Promise<MediaState> {
  return request<MediaState>('/api/media/stop', { method: 'POST' });
}

export function setMediaVolume(volume: number): Promise<MediaState> {
  return request<MediaState>('/api/media/volume', {
    method: 'POST',
    body: JSON.stringify({ volume }),
  });
}
