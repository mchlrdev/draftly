// Client-side calls to /api/admin/** (.scratch/draftly/api-contract.md).
// Every call resolves to a result instead of throwing, so forms can show the
// API's German error message inline.

import type { DisplayMode, Draft, Page, Project } from "@/lib/api-types";

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string };

const FALLBACK_ERROR = "Das hat nicht geklappt. Bitte noch einmal versuchen.";

async function call<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<ApiResult<T>> {
  const { json, ...rest } = init;
  const headers = new Headers(rest.headers);
  let body = rest.body;
  if (json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(json);
  }
  let res: Response;
  try {
    res = await fetch(path, { ...rest, headers, body, credentials: "same-origin" });
  } catch {
    return { ok: false, status: 0, error: "Keine Verbindung zum Server." };
  }
  const text = await res.text();
  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = undefined;
    }
  }
  if (!res.ok) {
    const error =
      parsed && typeof parsed === "object" && "error" in parsed && typeof parsed.error === "string"
        ? parsed.error
        : FALLBACK_ERROR;
    return { ok: false, status: res.status, error };
  }
  return { ok: true, status: res.status, data: parsed as T };
}

const enc = encodeURIComponent;
const draftPath = (project: string, draft: string) =>
  `/api/admin/projects/${enc(project)}/drafts/${enc(draft)}`;

export const adminApi = {
  login: (password: string) => call<void>("/api/admin/login", { method: "POST", json: { password } }),
  logout: () => call<void>("/api/admin/logout", { method: "POST" }),

  createProject: (slug: string, title?: string) =>
    call<Project>("/api/admin/projects", {
      method: "POST",
      json: title ? { slug, title } : { slug },
    }),
  deleteProject: (project: string, force = false) =>
    call<void>(`/api/admin/projects/${enc(project)}${force ? "?force=1" : ""}`, { method: "DELETE" }),

  createDraft: (project: string, slug: string, letterbox?: string) =>
    call<{ draft: Draft; password: string }>(`/api/admin/projects/${enc(project)}/drafts`, {
      method: "POST",
      json: letterbox ? { slug, letterbox } : { slug },
    }),
  updateDraft: (project: string, draft: string, letterbox: string) =>
    call<Draft>(draftPath(project, draft), { method: "PATCH", json: { letterbox } }),
  rotatePassword: (project: string, draft: string) =>
    call<{ password: string }>(`${draftPath(project, draft)}/rotate`, { method: "POST" }),
  deleteDraft: (project: string, draft: string) =>
    call<void>(draftPath(project, draft), { method: "DELETE" }),

  uploadPage: (project: string, draft: string, form: PageForm & { file: File }) =>
    call<Page>(`${draftPath(project, draft)}/pages`, { method: "POST", body: pageFormData(form) }),
  replacePage: (project: string, draft: string, pageId: string, form: PageForm & { file: File }) =>
    call<Page>(`${draftPath(project, draft)}/pages/${enc(pageId)}`, {
      method: "PUT",
      body: pageFormData(form),
    }),
  reorderPages: (project: string, draft: string, order: string[]) =>
    call<Page[]>(`${draftPath(project, draft)}/pages`, { method: "PUT", json: { order } }),
  deletePage: (project: string, draft: string, pageId: string) =>
    call<void>(`${draftPath(project, draft)}/pages/${enc(pageId)}`, { method: "DELETE" }),
};

export interface PageForm {
  name: string;
  display: DisplayMode;
  designWidth: number;
}

function pageFormData(form: PageForm & { file: File }): FormData {
  const data = new FormData();
  data.set("file", form.file, form.file.name);
  data.set("name", form.name);
  data.set("display", form.display);
  data.set("designWidth", String(form.designWidth));
  return data;
}
