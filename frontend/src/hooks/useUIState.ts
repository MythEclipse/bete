import { useCallback, useEffect, useState } from "react";
import { getUIState, updateUIState } from "../api/uiState";
import type { UIState } from "../types/ui";

export function useUIState() {
  const [uiState, setUIState] = useState<UIState>({ activeTab: "voice" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getUIState()
      .then((state) => {
        if (!cancelled) setUIState({ activeTab: "voice", ...state });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const patchUIState = useCallback(async (patch: Partial<UIState>) => {
    setUIState((prev) => ({ ...prev, ...patch }));
    const next = await updateUIState(patch);
    setUIState((prev) => ({ ...prev, ...next }));
    return next;
  }, []);

  return { uiState, setUIState, patchUIState, loading, error };
}
