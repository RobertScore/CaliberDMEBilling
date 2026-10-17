export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** fetch, but with a plain-English message when the app can't be reached at all (e.g. it was stopped in Terminal). */
async function reach(url: string, init: RequestInit) {
  try {
    return await fetch(url, init);
  } catch {
    throw new ApiError(0, "Can't reach the app. Check that it's still running in Terminal (npm run dev), then refresh this page.");
  }
}

export async function api<T = unknown>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await reach(url, {
    method,
    credentials: "same-origin",
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    // Logged out (e.g. timed out) while using a screen: go back to the login page.
    if (res.status === 401 && url !== "/api/session") window.dispatchEvent(new Event("cdb:logged-out"));
    throw new ApiError(res.status, data?.message ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export const get = <T,>(url: string) => api<T>("GET", url);
export const post = <T,>(url: string, body?: unknown) => api<T>("POST", url, body ?? {});
export const put = <T,>(url: string, body?: unknown) => api<T>("PUT", url, body);
export const del = <T,>(url: string) => api<T>("DELETE", url);

/** Upload files (multipart). */
export async function uploadFiles<T = unknown>(url: string, files: File[], fields: Record<string, string> = {}): Promise<T> {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  for (const f of files) fd.append("files", f);
  const res = await reach(url, { method: "POST", body: fd, credentials: "same-origin" });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, data?.message ?? `Upload failed (${res.status})`);
  return data as T;
}
