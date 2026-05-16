import { request } from "./client";

export async function login(password: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}
