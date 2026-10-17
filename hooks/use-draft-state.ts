"use client";

import { useReducer } from "react";
import type { Comment, DraftEvent, DraftSnapshot, Thread } from "@/lib/api-types";

// All comment data the viewer shows lives in one reducer. The server snapshot
// seeds it, SSE events and the responses to our own writes feed it, and a
// reconnect replaces it with a fresh snapshot. Every update is an idempotent
// upsert keyed by id, so our own write and its echo on the stream land once.

export type DraftState = DraftSnapshot;

export type DraftAction =
  | { type: "snapshot"; snapshot: DraftSnapshot }
  | { type: "event"; event: DraftEvent };

export function draftReducer(state: DraftState, action: DraftAction): DraftState {
  if (action.type === "snapshot") return action.snapshot;
  const event = action.event;
  switch (event.type) {
    case "thread.created":
    case "thread.updated":
      return { ...state, threads: upsertThread(state.threads, event.thread) };
    case "thread.deleted": {
      if (!state.threads.some((t) => t.id === event.threadId)) return state;
      return { ...state, threads: state.threads.filter((t) => t.id !== event.threadId) };
    }
    case "comment.created":
    case "comment.updated":
    case "comment.deleted":
      return applyComment(state, event.comment);
    default:
      return state;
  }
}

function byCreated<T extends { createdAt: string }>(a: T, b: T) {
  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
}

function upsertThread(threads: Thread[], thread: Thread): Thread[] {
  const i = threads.findIndex((t) => t.id === thread.id);
  // A thread object carries its comments; keep any we already know that the
  // incoming copy lacks (a reply that raced ahead of a status change).
  const incoming = i === -1 ? thread : mergeComments(thread, threads[i]);
  if (i === -1) return [...threads, incoming].sort(byCreated);
  const next = threads.slice();
  next[i] = incoming;
  return next;
}

function mergeComments(incoming: Thread, existing: Thread): Thread {
  const known = new Set(incoming.comments.map((c) => c.id));
  const missing = existing.comments.filter((c) => !known.has(c.id));
  if (missing.length === 0) return incoming;
  return { ...incoming, comments: [...incoming.comments, ...missing].sort(byCreated) };
}

function applyComment(state: DraftState, comment: Comment): DraftState {
  const i = state.threads.findIndex((t) => t.id === comment.threadId);
  // Unknown thread: the snapshot after the next reconnect will carry it.
  if (i === -1) return state;
  const thread = state.threads[i];
  const j = thread.comments.findIndex((c) => c.id === comment.id);
  const comments =
    j === -1
      ? [...thread.comments, comment].sort(byCreated)
      : thread.comments.map((c, k) => (k === j ? comment : c));
  const threads = state.threads.slice();
  threads[i] = { ...thread, comments };
  return { ...state, threads };
}

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/** Threads on one page, oldest first, each with its number on that page.
 *  Numbers count every thread on the page, so they stay put under a filter. */
export function numberedThreads(state: DraftState, pageId: string) {
  return state.threads
    .filter((t) => t.pageId === pageId)
    .slice()
    .sort(byCreated)
    .map((thread, i) => ({ thread, number: i + 1 }));
}

export function openCount(state: DraftState, pageId: string) {
  return state.threads.filter((t) => t.pageId === pageId && t.status === "open").length;
}

export function useDraftState(initial: DraftSnapshot) {
  return useReducer(draftReducer, initial);
}
