import { requireDraftAccess } from "@/lib/server/access"
import {
  handle,
  json,
  readJson,
  tooManyRequests,
  type Params,
} from "@/lib/server/http"
import { allow } from "@/lib/server/rate-limit"
import { addComment } from "@/lib/server/store"

export const POST = handle<Params<"project" | "draft" | "threadId">>(
  async (req, ctx) => {
    const { project, draft, threadId } = await ctx.params
    const access = requireDraftAccess(req, project, draft)
    if (!allow("write", req)) throw tooManyRequests()
    return json(addComment(access.draft, threadId, await readJson(req)), 201)
  }
)
