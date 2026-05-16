import { request } from "./client";
import type { UIState } from "../types/ui";

export function getUIState(): Promise<UIState> {
  return request<UIState>('/api/ui-state');
}

export function updateUIState(patch: Partial<UIState>): Promise<UIState> {
  return request<UIState>('/api/ui-state', {
    method: 'POST',
    body: JSON.stringify(patch),
  });
}
