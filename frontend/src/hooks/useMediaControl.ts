import { useCallback, useEffect, useState } from "react";
import {
  getMediaStatus,
  queueMedia,
  setMediaVolume,
  skipMedia,
  stopMedia,
} from "../api/media";
import type { MediaMode, MediaState } from "../types/media";

const emptyMediaState: MediaState = {
  playing: false,
  musicVolume: 1,
  current: null,
  queue: [],
};

export function useMediaControl() {
  const [mediaState, setMediaState] = useState<MediaState>(emptyMediaState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshMedia = useCallback(async () => {
    const state = await getMediaStatus();
    setMediaState(state);
    return state;
  }, []);

  const enqueue = useCallback(async (source: string, mode: MediaMode) => {
    setLoading(true);
    setError(null);
    try {
      const state = await queueMedia(source, mode);
      setMediaState(state);
      return state;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const skip = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const state = await skipMedia();
      setMediaState(state);
      return state;
    } finally {
      setLoading(false);
    }
  }, []);

  const stop = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const state = await stopMedia();
      setMediaState(state);
      return state;
    } finally {
      setLoading(false);
    }
  }, []);

  const setVolume = useCallback(async (volume: number) => {
    setError(null);
    try {
      const state = await setMediaVolume(volume);
      setMediaState(state);
      return state;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    }
  }, []);

  useEffect(() => {
    refreshMedia().catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [refreshMedia]);

  return {
    mediaState,
    setMediaState,
    loading,
    error,
    refreshMedia,
    enqueue,
    skip,
    stop,
    setVolume,
  };
}
