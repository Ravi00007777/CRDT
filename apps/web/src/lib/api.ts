export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: init.body ? { 'content-type': 'application/json', ...init.headers } : init.headers,
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.issues?.[0]?.message ?? body.error ?? `Request failed (${res.status})`);
  return body as T;
}

export type User = { id: string; email: string; name: string };
export type DocSummary = { id: string; title: string; updatedAt: string; ownerId: string; owner: { name: string; email: string } };
