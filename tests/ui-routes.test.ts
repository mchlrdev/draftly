import { existsSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { client, setupDraft } from "./helpers"

// The UI pages belong to the UI work; only assert once they exist.
const root = join(import.meta.dirname, "..")
const hasProjectPage = existsSync(join(root, "app/[project]/page.tsx"))
const hasDraftPage = existsSync(join(root, "app/[project]/[draft]/page.tsx"))

describe("public UI routes", () => {
  it.skipIf(!hasProjectPage)(
    "a project-only URL is 404, even for an existing project",
    async () => {
      const { project } = await setupDraft()
      const res = await client().get(`/${project}`)
      expect(res.status).toBe(404)
      expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow")
    }
  )

  it.skipIf(!hasDraftPage)("an unknown draft URL is 404", async () => {
    const { project } = await setupDraft()
    expect((await client().get(`/${project}/gibts-nicht`)).status).toBe(404)
    expect((await client().get(`/gibts-nicht-${Date.now()}/v1`)).status).toBe(
      404
    )
  })

  it.skipIf(!hasDraftPage)(
    "an existing draft shows the gate (no page HTML) without the password",
    async () => {
      const { project, draft } = await setupDraft()
      const res = await client().get(`/${project}/${draft}`)
      expect(res.status).toBe(200)
      expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow")
      expect(await res.text()).not.toContain("Self-contained page.")
    }
  )

  it("the root is 404", async () => {
    expect((await client().get("/")).status).toBe(404)
  })
})
