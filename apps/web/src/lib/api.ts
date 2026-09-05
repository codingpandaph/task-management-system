let csrf = '';
let refreshPromise: Promise<void> | null = null;
export class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export function clearSession() {
  csrf = '';
  refreshPromise = null;
}
async function csrfToken() {
  if (!csrf) {
    const r = await fetch('/api/auth/csrf', { headers: { 'x-tms-client': 'web' }, cache: 'no-store' });
    if (r.ok) {
      const d = (await r.json()) as { csrf: string };
      csrf = d.csrf;
    }
  }
  return csrf;
}
export async function api<T>(
  path: string,
  body?: unknown,
  method = body === undefined ? 'GET' : 'POST',
  retry = true,
): Promise<T> {
  const headers: Record<string, string> = { 'x-tms-client': 'web' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (method !== 'GET' && path !== 'auth/login') headers['x-csrf-token'] = await csrfToken();
  const response = await fetch(`/api/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
  if (response.status === 401 && retry && !path.startsWith('auth/')) {
    if (!refreshPromise)
      refreshPromise = api<{ csrf: string }>('auth/refresh', {}, 'POST', false)
        .then((d) => {
          csrf = d.csrf;
        })
        .finally(() => {
          refreshPromise = null;
        });
    await refreshPromise;
    // Unauthorized requests were rejected before mutations; only this one retry is allowed.
    return api<T>(path, body, method, false);
  }
  const data: unknown = await response.json();
  if (!response.ok) {
    const message = typeof data === 'object' && data && 'message' in data ? String(data.message) : 'Request failed';
    throw new RequestError(message, response.status);
  }
  if (typeof data === 'object' && data && 'csrf' in data && typeof data.csrf === 'string') csrf = data.csrf;
  return data as T;
}
