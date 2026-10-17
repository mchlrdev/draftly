// Shared fetch core for the browser side of the HTTP contract
// (.scratch/draftly/api-contract.md): same-origin cookies, optional JSON body,
// and the API's German `{ error }` message on failure. Never throws.

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string }

export type ApiRequestInit = RequestInit & { json?: unknown }

export const NETWORK_ERROR = "Keine Verbindung. Bitte noch einmal versuchen."
export const FALLBACK_ERROR =
  "Das hat nicht geklappt. Bitte noch einmal versuchen."

export async function apiFetch<T>(
  path: string,
  init: ApiRequestInit = {}
): Promise<ApiResult<T>> {
  const { json, ...rest } = init
  const headers = new Headers(rest.headers)
  let body = rest.body
  if (json !== undefined) {
    headers.set("content-type", "application/json")
    body = JSON.stringify(json)
  }
  let res: Response
  let text: string
  try {
    res = await fetch(path, {
      cache: "no-store",
      ...rest,
      headers,
      body,
      credentials: "same-origin",
    })
    text = await res.text()
  } catch {
    return { ok: false, status: 0, error: NETWORK_ERROR }
  }
  let parsed: unknown = undefined
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = undefined
    }
  }
  if (!res.ok) {
    const error =
      parsed &&
      typeof parsed === "object" &&
      "error" in parsed &&
      typeof parsed.error === "string" &&
      parsed.error
        ? parsed.error
        : FALLBACK_ERROR
    return { ok: false, status: res.status, error }
  }
  return { ok: true, status: res.status, data: parsed as T }
}
