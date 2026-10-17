// Client-side calls to /api/admin/** (.scratch/draftly/api-contract.md).
// Every call resolves to a result instead of throwing, so forms can show the
// API's German error message inline.

import type { DisplayMode, Draft, Page, Project } from "@/lib/api-types";
import { apiFetch, type ApiResult } from "@/lib/api-client";

export type { ApiResult };

const call = apiFetch;

const enc = encodeURIComponent;
const draftPath = (project: string, draft: string) =>
  `/api/admin/projects/${enc(project)}/drafts/${enc(draft)}`;

export const operatorApi = {
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
