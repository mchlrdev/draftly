import { describe, expect, it } from "vitest"
import type { ApiToken, Draft, Page } from "@/lib/api-types"
import {
  FIXTURE_HTML,
  baseUrl,
  client,
  operator,
  pageForm,
  reviewer,
  setupDraft,
} from "./helpers"

// Agent access (ADR 0004): API tokens, the MCP endpoint, one-time upload links.

async function newToken(name = "Claude Code") {
  const op = await operator()
  const res = await op.post("/api/admin/tokens", { name })
  expect(res.status).toBe(201)
  const body = (await res.json()) as { token: string; apiToken: ApiToken }
  return { op, ...body }
}

let rpcId = 0
async function mcp(token: string | null, method: string, params?: unknown) {
  const res = await fetch(`${baseUrl()}/api/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  })
  return res
}

async function call<T = unknown>(token: string, name: string, args: unknown) {
  const res = await mcp(token, "tools/call", { name, arguments: args })
  expect(res.status).toBe(200)
  const { result } = (await res.json()) as {
    result: { isError?: boolean; content: { text: string }[] }
  }
  return {
    isError: Boolean(result.isError),
    text: result.content[0].text,
    data: (result.isError ? null : JSON.parse(result.content[0].text)) as T,
  }
}

const postFile = (url: string, html: string) =>
  fetch(url, { method: "POST", body: pageForm({ html }) })

describe("API tokens", () => {
  it("are listed by name, readable and revocable by the operator only", async () => {
    const { op, token, apiToken } = await newToken("Laptop")
    expect(token).toMatch(/^dft_[\w-]{40,}$/)
    expect(apiToken).toMatchObject({ name: "Laptop", lastUsedAt: null })

    const list = (await (
      await op.get("/api/admin/tokens")
    ).json()) as ApiToken[]
    expect(list.find((t) => t.id === apiToken.id)).toMatchObject({
      name: "Laptop",
    })
    expect(JSON.stringify(list)).not.toContain(token)

    // The operator can read it again, e.g. to set up a second agent.
    const read = await op.get(`/api/admin/tokens/${apiToken.id}`)
    expect(read.status).toBe(200)
    expect(await read.json()).toEqual({ token })
    expect((await op.get("/api/admin/tokens/nope")).status).toBe(404)

    // A bearer token is not an operator session.
    for (const path of [
      "/api/admin/tokens",
      `/api/admin/tokens/${apiToken.id}`,
    ]) {
      const asToken = await fetch(`${baseUrl()}${path}`, {
        headers: { authorization: `Bearer ${token}` },
      })
      expect(asToken.status).toBe(401)
      expect((await client().get(path)).status).toBe(401)
    }

    expect((await op.del(`/api/admin/tokens/${apiToken.id}`)).status).toBe(204)
    expect((await op.del(`/api/admin/tokens/${apiToken.id}`)).status).toBe(404)
    expect((await mcp(token, "tools/list")).status).toBe(401)
  })

  it("need a name of at most 60 characters", async () => {
    const op = await operator()
    expect((await op.post("/api/admin/tokens", {})).status).toBe(422)
    expect(
      (await op.post("/api/admin/tokens", { name: "x".repeat(61) })).status
    ).toBe(422)
  })
})

describe("MCP endpoint", () => {
  it("rejects requests without a valid bearer token", async () => {
    const none = await mcp(null, "tools/list")
    expect(none.status).toBe(401)
    expect(none.headers.get("www-authenticate")).toMatch(/^Bearer/)
    expect((await mcp("dft_nope", "tools/list")).status).toBe(401)
  })

  it("initializes, lists the tools and ships the skill as prompt and resource", async () => {
    const { token } = await newToken()
    const init = await mcp(token, "initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test", version: "0" },
    })
    expect(init.status).toBe(200)
    const { result } = (await init.json()) as {
      result: { serverInfo: { name: string }; instructions: string }
    }
    expect(result.serverInfo.name).toBe("draftly")
    expect(result.instructions).toContain("paper-to-draftly")

    const tools = (await (await mcp(token, "tools/list")).json()) as {
      result: { tools: { name: string }[] }
    }
    expect(tools.result.tools.map((t) => t.name).sort()).toEqual([
      "create_draft",
      "create_project",
      "create_thread",
      "get_draft",
      "get_page_screenshot",
      "get_thread_screenshot",
      "list_comments",
      "list_projects",
      "prepare_page_upload",
      "reorder_pages",
      "reply_to_thread",
      "set_thread_status",
      "update_page",
      "upload_page",
    ])

    const prompt = (await (
      await mcp(token, "prompts/get", {
        name: "paper-to-draftly",
        arguments: { request: "Home nach kunde/v2" },
      })
    ).json()) as {
      result: { messages: { content: { text: string } }[] }
    }
    const text = prompt.result.messages[0].content.text
    expect(text).toContain(`${baseUrl()}/agent/paper-to-html.mjs`)
    expect(text).toContain("Task: Home nach kunde/v2")

    const resource = (await (
      await mcp(token, "resources/read", {
        uri: "draftly://skill/paper-to-draftly",
      })
    ).json()) as { result: { contents: { text: string }[] } }
    expect(resource.result.contents[0].text).toMatch(
      /^---\nname: paper-to-draftly\n/
    )
  })

  it("creates a project and draft and reads it back with link and password", async () => {
    const { token } = await newToken()
    const project = `mcp-${Date.now().toString(36)}`
    expect(
      (await call(token, "create_project", { slug: project, title: "Kunde" }))
        .data
    ).toEqual({ project, title: "Kunde" })
    const created = await call<{ url: string; password: string }>(
      token,
      "create_draft",
      { project, slug: "v1" }
    )
    expect(created.data.url).toBe(`${baseUrl()}/${project}/v1`)
    expect(created.data.password).toMatch(/^\w{4}-\w{4}-\w{4}$/)

    const got = await call<{ password: string; pages: unknown[] }>(
      token,
      "get_draft",
      { project, draft: "v1" }
    )
    expect(got.data).toMatchObject({
      password: created.data.password,
      pages: [],
    })

    const listed = await call<{ project: string }[]>(token, "list_projects", {})
    expect(listed.data.some((p) => p.project === project)).toBe(true)

    // Domain errors come back as tool errors with the German message.
    const dup = await call(token, "create_draft", { project, slug: "v1" })
    expect(dup.isError).toBe(true)
    expect(dup.text).toContain("schon vergeben")
  })

  it("uploads small inline HTML and rejects external URLs", async () => {
    const { token } = await newToken()
    const { project, draft, op, admin } = await setupDraft()
    const ok = await call<Page>(token, "upload_page", {
      project,
      draft,
      html: FIXTURE_HTML,
      name: "Inline",
      designWidth: 1280,
    })
    expect(ok.data).toMatchObject({ name: "Inline", designWidth: 1280 })
    const bad = await call(token, "upload_page", {
      project,
      draft,
      html: '<img src="https://app.paper.design/x.png">',
    })
    expect(bad.isError).toBe(true)
    const pages = ((await (await op.get(admin)).json()) as Draft).pages
    expect(pages.map((p) => p.name)).toEqual(["Start", "Inline"])
  })
})

describe("upload links", () => {
  it("add a page with the ticket's fields and work until one upload succeeds", async () => {
    const { token } = await newToken()
    const { project, draft, op, admin } = await setupDraft()
    const { data } = await call<{ uploadUrl: string }>(
      token,
      "prepare_page_upload",
      { project, draft, name: "Home", designWidth: 1440 }
    )
    expect(data.uploadUrl).toMatch(
      new RegExp(`^${baseUrl()}/api/agent/upload/[\\w-]+$`)
    )

    // A rejected file does not spend the link.
    const rejected = await postFile(
      data.uploadUrl,
      '<div style="background:url(https://example.com/a.png)"></div>'
    )
    expect(rejected.status).toBe(422)

    const res = await postFile(data.uploadUrl, FIXTURE_HTML)
    expect(res.status).toBe(201)
    expect((await res.json()) as Page).toMatchObject({
      name: "Home",
      display: "fixed",
      designWidth: 1440,
    })

    expect((await postFile(data.uploadUrl, FIXTURE_HTML)).status).toBe(401)
    const pages = ((await (await op.get(admin)).json()) as Draft).pages
    expect(pages.map((p) => p.name)).toEqual(["Start", "Home"])
  })

  it("replace a page in place when the ticket names it", async () => {
    const { token } = await newToken()
    const { project, draft, pageId, op, admin } = await setupDraft()
    const { data } = await call<{ uploadUrl: string }>(
      token,
      "prepare_page_upload",
      { project, draft, pageId }
    )
    const res = await postFile(
      data.uploadUrl,
      FIXTURE_HTML.replace("Fixture", "Neu")
    )
    expect(res.status).toBe(200)
    expect(((await res.json()) as Page).id).toBe(pageId)
    const pages = ((await (await op.get(admin)).json()) as Draft).pages
    expect(pages).toHaveLength(1)
  })

  it("are refused for unknown pages, and die with their token", async () => {
    const { op, token, apiToken } = await newToken()
    const { project, draft } = await setupDraft()
    const unknown = await call(token, "prepare_page_upload", {
      project,
      draft,
      pageId: "nope",
    })
    expect(unknown.isError).toBe(true)

    const { data } = await call<{ uploadUrl: string }>(
      token,
      "prepare_page_upload",
      { project, draft }
    )
    await op.del(`/api/admin/tokens/${apiToken.id}`)
    expect((await postFile(data.uploadUrl, FIXTURE_HTML)).status).toBe(401)
    expect(
      (await postFile(`${baseUrl()}/api/agent/upload/garbage`, FIXTURE_HTML))
        .status
    ).toBe(401)
  })
})

describe("agent assets", () => {
  it("serves the converter publicly and the skill download to the operator", async () => {
    const script = await fetch(`${baseUrl()}/agent/paper-to-html.mjs`)
    expect(script.status).toBe(200)
    expect(await script.text()).toContain("export async function convert")

    expect((await client().get("/api/admin/agent/skill")).status).toBe(401)
    const op = await operator()
    const skill = await op.get("/api/admin/agent/skill")
    expect(skill.status).toBe(200)
    expect(skill.headers.get("content-disposition")).toContain(
      "paper-to-draftly.md"
    )
    expect(await skill.text()).toContain("name: paper-to-draftly")
  })
})

const PAPER_HTML = FIXTURE_HTML.replace(
  "<title>Fixture</title>",
  '<title>Fixture</title><meta name="paper:file" content="01M587YHKH90P6BJ6TTPFZCXFW"><meta content="1Y7-0" name="paper:node">'
)

describe("Paper link on pages", () => {
  it("comes from the HTML's meta tags, the form, or stays empty", async () => {
    const { op, admin, pageId } = await setupDraft()
    const page = async (id: string) =>
      ((await (await op.get(admin)).json()) as Draft).pages.find(
        (p) => p.id === id
      )!

    // Pages without it keep working, with no link.
    expect(await page(pageId)).toMatchObject({
      paperFileId: null,
      paperNodeId: null,
    })

    const fromMeta = (await (
      await op.request(`${admin}/pages`, {
        method: "POST",
        body: pageForm({ html: PAPER_HTML, name: "Meta" }),
      })
    ).json()) as Page
    expect(fromMeta).toMatchObject({
      paperFileId: "01M587YHKH90P6BJ6TTPFZCXFW",
      paperNodeId: "1Y7-0",
    })

    const form = pageForm({ html: FIXTURE_HTML, name: "Form" })
    form.set("paperFileId", "01ABC")
    form.set("paperNodeId", "RJ-0")
    const fromForm = (await (
      await op.request(`${admin}/pages`, { method: "POST", body: form })
    ).json()) as Page
    expect(fromForm).toMatchObject({
      paperFileId: "01ABC",
      paperNodeId: "RJ-0",
    })

    const bad = pageForm({ html: FIXTURE_HTML, name: "Bad" })
    bad.set("paperNodeId", "nope nope")
    expect(
      (await op.request(`${admin}/pages`, { method: "POST", body: bad })).status
    ).toBe(422)

    // Replacing with HTML that has no meta keeps the link; PATCH "" clears it.
    const replaced = (await (
      await op.request(`${admin}/pages/${fromMeta.id}`, {
        method: "PUT",
        body: pageForm({ html: FIXTURE_HTML }),
      })
    ).json()) as Page
    expect(replaced.paperNodeId).toBe("1Y7-0")
    const cleared = (await (
      await op.patch(`${admin}/pages/${fromMeta.id}`, { paperNodeId: "" })
    ).json()) as Page
    expect(cleared).toMatchObject({
      paperFileId: "01M587YHKH90P6BJ6TTPFZCXFW",
      paperNodeId: null,
    })
  })

  it("travels on upload links and shows in get_draft", async () => {
    const { token } = await newToken()
    const { project, draft } = await setupDraft()
    const { data } = await call<{ uploadUrl: string }>(
      token,
      "prepare_page_upload",
      { project, draft, name: "Home", paperFileId: "01F", paperNodeId: "RJ-0" }
    )
    const res = await postFile(data.uploadUrl, FIXTURE_HTML)
    const created = (await res.json()) as Page
    expect(created).toMatchObject({ paperFileId: "01F", paperNodeId: "RJ-0" })

    const got = await call<{ pages: { id: string; paper: unknown }[] }>(
      token,
      "get_draft",
      { project, draft }
    )
    expect(got.data.pages.find((p) => p.id === created.id)?.paper).toEqual({
      fileId: "01F",
      nodeId: "RJ-0",
    })

    const updated = await call<Page>(token, "update_page", {
      project,
      draft,
      pageId: created.id,
      paperNodeId: "WK-0",
    })
    expect(updated.data.paperNodeId).toBe("WK-0")
  })
})

describe("comments for agents", () => {
  it("lists threads, replies, pins and resolves as the operator's agent", async () => {
    const { token } = await newToken()
    const { op, project, draft, pageId, api, password } = await setupDraft()
    await op.put("/api/admin/settings", { operatorName: "Pascal" })
    const rev = await reviewer(project, draft, password)
    const posted = await rev.post(`${api}/threads`, {
      pageId,
      x: 120.4,
      y: 840,
      body: "Headline zu groß",
      authorName: "Tanja",
      clientId: "tanja-1",
    })
    const thread = (await posted.json()) as { id: string }

    type Listed = {
      threads: {
        id: string
        page: string
        x: number
        status: string
        comments: { author: string; body: string; byYou: boolean }[]
      }[]
      password?: string
    }
    const listed = await call<Listed>(token, "list_comments", {
      project,
      draft,
    })
    expect(listed.data.password).toBeUndefined()
    expect(listed.data.threads).toEqual([
      expect.objectContaining({
        id: thread.id,
        page: "Start",
        x: 120,
        status: "open",
        comments: [
          expect.objectContaining({
            author: "Tanja",
            body: "Headline zu groß",
            byYou: false,
          }),
        ],
      }),
    ])

    const reply = await call<{ author: string }>(token, "reply_to_thread", {
      project,
      draft,
      threadId: thread.id,
      body: "Ist kleiner, siehe neue Version.",
    })
    expect(reply.data.author).toBe("Pascal (Agent)")

    // Reviewers see it like any other comment, without the agent's clientId.
    const snap = await (await rev.get(api)).text()
    expect(snap).toContain("Pascal (Agent)")
    expect(snap).not.toContain("agent:")

    await call(token, "set_thread_status", {
      project,
      draft,
      threadId: thread.id,
      status: "resolved",
    })
    expect(
      (await call<Listed>(token, "list_comments", { project, draft })).data
        .threads
    ).toEqual([])
    const all = await call<Listed>(token, "list_comments", {
      project,
      draft,
      status: "all",
    })
    expect(all.data.threads[0].comments.map((c) => c.byYou)).toEqual([
      false,
      true,
    ])

    const pin = await call<{ status: string; comments: { author: string }[] }>(
      token,
      "create_thread",
      { project, draft, pageId, x: 10, y: 20, body: "Frage zum Bild?" }
    )
    expect(pin.data).toMatchObject({
      status: "open",
      comments: [{ author: "Pascal (Agent)" }],
    })

    const since = await call<Listed>(token, "list_comments", {
      project,
      draft,
      status: "all",
      since: new Date(Date.now() + 60_000).toISOString(),
    })
    expect(since.data.threads).toEqual([])
  })
})

describe("screenshots for agents", () => {
  type Shot = {
    content: (
      | { type: "image"; data: string; mimeType: string }
      | { type: "text"; text: string }
    )[]
    isError?: boolean
  }
  async function shot(token: string, name: string, args: unknown) {
    const res = await mcp(token, "tools/call", { name, arguments: args })
    const { result } = (await res.json()) as { result: Shot }
    const image = result.content.find((c) => c.type === "image")
    const text = result.content.find((c) => c.type === "text")
    return {
      result,
      image:
        image && "data" in image ? Buffer.from(image.data, "base64") : null,
      info:
        text && "text" in text && !result.isError
          ? JSON.parse(text.text)
          : null,
    }
  }

  it("render a page slice and the area around a pin, with pins numbered", async () => {
    const { token } = await newToken()
    const { project, draft, pageId, api, password } = await setupDraft()
    const rev = await reviewer(project, draft, password)
    const posted = await rev.post(`${api}/threads`, {
      pageId,
      x: 300,
      y: 900,
      body: "Abstand prüfen",
      authorName: "Tanja",
      clientId: "tanja-2",
    })
    const thread = (await posted.json()) as { id: string }

    const page = await shot(token, "get_page_screenshot", {
      project,
      draft,
      pageId,
      height: 600,
    })
    expect(page.result.isError).toBeFalsy()
    // JPEG magic bytes.
    expect(page.image?.subarray(0, 2).toString("hex")).toBe("ffd8")
    expect(page.info).toMatchObject({
      page: "Start",
      shown: { x: 0, y: 0, width: 1440, height: 600 },
      imageScale: 1,
      nextTop: 600,
    })
    expect(page.info.pageHeight).toBeGreaterThanOrEqual(1200)
    expect(page.info.pins).toEqual([]) // the pin is below this slice

    const around = await shot(token, "get_thread_screenshot", {
      project,
      draft,
      threadId: thread.id,
    })
    expect(around.image?.subarray(0, 2).toString("hex")).toBe("ffd8")
    // Centred on the pin, pushed up where the page ends.
    expect(around.info.shown).toEqual({
      x: 0,
      y: Math.min(550, around.info.pageHeight - 700),
      width: 1000,
      height: 700,
    })
    expect(around.info.thread).toMatchObject({ number: 1, x: 300, y: 900 })

    const missing = await shot(token, "get_thread_screenshot", {
      project,
      draft,
      threadId: "nope",
    })
    expect(missing.result.isError).toBe(true)
    expect(JSON.stringify(missing.result.content)).toContain(
      "Thread nicht gefunden."
    )
  })
})
