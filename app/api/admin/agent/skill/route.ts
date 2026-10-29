import { SKILL_NAME, skillMarkdown } from "@/lib/agent/skill"
import { handle, publicOrigin, requireOperator } from "@/lib/server/http"

/** The skill as a SKILL.md download, for agents that load skills from disk. */
export const GET = handle((req) => {
  requireOperator(req)
  return new Response(skillMarkdown(publicOrigin(req), { frontmatter: true }), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${SKILL_NAME}.md"`,
      "cache-control": "no-store",
    },
  })
})
