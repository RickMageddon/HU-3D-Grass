import type { ChatRequest, ChatResponse, RecommendResponse, StatusResponse, StudentProfile } from '../../../shared/types';

export class ApiError extends Error {}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError('De server is niet bereikbaar. Controleer of de backend draait (npm run dev) en probeer het opnieuw.');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(body?.error ?? `De server gaf een fout (HTTP ${res.status}).`);
  }
  return (await res.json()) as T;
}

export const api = {
  status: () => call<StatusResponse>('/api/status'),
  chat: (req: ChatRequest, signal?: AbortSignal) => call<ChatResponse>('/api/chat', { method: 'POST', body: JSON.stringify(req), signal }),
  recommend: (profile: StudentProfile, signal?: AbortSignal) =>
    call<RecommendResponse>('/api/recommend', { method: 'POST', body: JSON.stringify({ profile }), signal }),
};
