// Reviewer side of the HTTP contract (.scratch/draftly/api-contract.md).
// Same origin, cookies ride along; every error carries a German message.

import type {
  Comment,
  DraftSnapshot,
  ThreadStatus,
  Thread,
} from "@/lib/api-types"
import { apiFetch, type ApiRequestInit } from "@/lib/api-client"

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
    this.name = "ApiError"
  }
}

async function request<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
  const res = await apiFetch<T>(path, init)
  if (!res.ok) throw new ApiError(res.status, res.error)
  return res.data
}

function base(project: string, draft: string) {
  return `/api/d/${encodeURIComponent(project)}/${encodeURIComponent(draft)}`
}

export interface DraftRef {
  project: string
  draft: string
}

export const reviewerApi = {
  base,
  eventsUrl: ({ project, draft }: DraftRef) => `${base(project, draft)}/events`,
  pageHtmlUrl: (
    { project, draft }: DraftRef,
    pageId: string,
    version: string
  ) =>
    `${base(project, draft)}/pages/${encodeURIComponent(pageId)}/html?v=${encodeURIComponent(version)}`,

  unlock: ({ project, draft }: DraftRef, password: string) =>
    request<void>(`${base(project, draft)}/unlock`, {
      method: "POST",
      json: { password },
    }),

  snapshot: ({ project, draft }: DraftRef) =>
    request<DraftSnapshot>(base(project, draft)),

  createThread: (
    { project, draft }: DraftRef,
    body: {
      pageId: string
      x: number
      y: number
      body: string
      authorName: string
      clientId: string
    }
  ) =>
    request<Thread>(`${base(project, draft)}/threads`, {
      method: "POST",
      json: body,
    }),

  createComment: (
    { project, draft }: DraftRef,
    threadId: string,
    body: { body: string; authorName: string; clientId: string }
  ) =>
    request<Comment>(
      `${base(project, draft)}/threads/${encodeURIComponent(threadId)}/comments`,
      {
        method: "POST",
        json: body,
      }
    ),

  updateComment: (
    { project, draft }: DraftRef,
    commentId: string,
    body: { body: string; clientId: string }
  ) =>
    request<Comment>(
      `${base(project, draft)}/comments/${encodeURIComponent(commentId)}`,
      {
        method: "PATCH",
        json: body,
      }
    ),

  deleteComment: (
    { project, draft }: DraftRef,
    commentId: string,
    clientId: string
  ) =>
    request<Comment>(
      `${base(project, draft)}/comments/${encodeURIComponent(commentId)}`,
      {
        method: "DELETE",
        json: { clientId },
      }
    ),

  setThreadStatus: (
    { project, draft }: DraftRef,
    threadId: string,
    status: ThreadStatus
  ) =>
    request<Thread>(
      `${base(project, draft)}/threads/${encodeURIComponent(threadId)}`,
      {
        method: "PATCH",
        json: { status },
      }
    ),

  deleteThread: ({ project, draft }: DraftRef, threadId: string) =>
    request<void>(
      `${base(project, draft)}/threads/${encodeURIComponent(threadId)}`,
      { method: "DELETE" }
    ),
}
