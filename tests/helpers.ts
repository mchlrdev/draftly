import { inject } from "vitest"

export const baseUrl = () => inject("baseUrl")

let ipCounter = 0

/** An HTTP client with its own cookie jar and its own client IP (x-forwarded-for). */
export function client() {
  const jar = new Map<string, string>()
  // Test files share one server and its per-IP limits, so client IPs are
  // drawn from all of 10.0.0.0/8: a clash between files would mix their counts.
  ipCounter += 1
  const octet = () => Math.floor(Math.random() * 256)
  const ip = `10.${octet()}.${octet()}.${(ipCounter % 254) + 1}`

  async function request(
    path: string,
    init: RequestInit & { json?: unknown } = {}
  ) {
    const headers = new Headers(init.headers)
    // The trusted proxy appends the peer address last; a test may prepend spoofed hops.
    if (!headers.has("x-forwarded-for")) headers.set("x-forwarded-for", ip)
    if (jar.size)
      headers.set("cookie", [...jar].map(([k, v]) => `${k}=${v}`).join("; "))
    let body = init.body
    if (init.json !== undefined) {
      headers.set("content-type", "application/json")
      body = JSON.stringify(init.json)
    }
    const res = await fetch(baseUrl() + path, {
      ...init,
      headers,
      body,
      redirect: "manual",
    })
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(";")
      const eq = pair.indexOf("=")
      const name = pair.slice(0, eq).trim()
      const value = pair.slice(eq + 1).trim()
      const expired = attrs.some(
        (a) =>
          /^\s*max-age=0\s*$/i.test(a) ||
          /^\s*expires=Thu, 01 Jan 1970/i.test(a)
      )
      if (!value || expired) jar.delete(name)
      else jar.set(name, value)
    }
    return res
  }

  return {
    ip,
    jar,
    request,
    get: (path: string) => request(path),
    post: (path: string, json?: unknown) =>
      request(path, { method: "POST", json }),
    put: (path: string, json?: unknown) =>
      request(path, { method: "PUT", json }),
    patch: (path: string, json?: unknown) =>
      request(path, { method: "PATCH", json }),
    del: (path: string, json?: unknown) =>
      request(path, { method: "DELETE", json }),
  }
}

export type Client = ReturnType<typeof client>

export async function operator(): Promise<Client> {
  const c = client()
  const res = await c.post("/api/admin/login", { password: "test-secret" })
  if (res.status !== 204) throw new Error(`login failed: ${res.status}`)
  return c
}

let slugCounter = 0
export function uniqueSlug(prefix = "p") {
  slugCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${slugCounter}`
}

export const FIXTURE_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>Fixture</title>
<style>body{margin:0;font-family:system-ui}section{height:1200px;background:#f4efe8}</style></head>
<body><section><h1>Fixture</h1><p>Self-contained page.</p></section></body></html>`

export function pageForm(fields: {
  html?: string
  name?: string
  display?: string
  designWidth?: string
}) {
  const form = new FormData()
  if (fields.html !== undefined)
    form.set(
      "file",
      new Blob([fields.html], { type: "text/html" }),
      "page.html"
    )
  if (fields.name !== undefined) form.set("name", fields.name)
  if (fields.display !== undefined) form.set("display", fields.display)
  if (fields.designWidth !== undefined)
    form.set("designWidth", fields.designWidth)
  return form
}

/** Operator + a fresh project + draft with one page. */
export async function setupDraft() {
  const op = await operator()
  const project = uniqueSlug("proj")
  const draft = "v1"
  await op.post("/api/admin/projects", { slug: project, title: "Projekt" })
  const created = await op.post(`/api/admin/projects/${project}/drafts`, {
    slug: draft,
  })
  const { password } = (await created.json()) as { password: string }
  const up = await op.request(
    `/api/admin/projects/${project}/drafts/${draft}/pages`,
    {
      method: "POST",
      body: pageForm({ html: FIXTURE_HTML, name: "Start", display: "fixed" }),
    }
  )
  const page = (await up.json()) as { id: string }
  return {
    op,
    project,
    draft,
    password,
    pageId: page.id,
    admin: `/api/admin/projects/${project}/drafts/${draft}`,
    api: `/api/d/${project}/${draft}`,
  }
}

export async function reviewer(
  project: string,
  draft: string,
  password: string
) {
  const c = client()
  const res = await c.post(`/api/d/${project}/${draft}/unlock`, { password })
  if (res.status !== 204) throw new Error(`unlock failed: ${res.status}`)
  return c
}
