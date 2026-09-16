import type { SupportTicket, SupportThread } from '@/lib/support';

async function request<T>(path: string, body?: unknown, token?: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/v1/support${path}`, {
    method: body === undefined ? 'GET' : 'POST', cache: 'no-store', credentials: 'same-origin', signal,
    headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(token ? { 'x-support-token': token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 204) return undefined as T;
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message ?? 'Unable to load support.');
  return result.data as T;
}
export const listSupport = (signal?: AbortSignal) => request<SupportTicket[]>('', undefined, undefined, signal);
export const getSupportThread = (id: string, token?: string, signal?: AbortSignal) => request<SupportThread>(`/${encodeURIComponent(id)}`, undefined, token, signal);
export const createSupport = (input: { category: 'problem' | 'suggestion'; subject: string; message: string }) => request<{ id: string }>('', input);
export const requestRecovery = (input: { name: string; email: string; identifier: string; message: string }) => request<{ id: string; accessToken: string }>('/recovery', input);
export const replySupport = (id: string, input: { message?: string; status?: 'open' | 'resolved' }, token?: string) => request<void>(`/${encodeURIComponent(id)}`, input, token);
