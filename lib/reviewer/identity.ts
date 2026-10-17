"use client";

import { useSyncExternalStore } from "react";

// Who is commenting in this browser: a display name (asked once, at the
// password gate) and a random clientId that marks "my" comments. Both live in
// localStorage, shared by every draft on this origin.

const KEY = "draftly.identity";

export interface Identity {
  clientId: string;
  name: string;
}

const listeners = new Set<() => void>();
let cached: Identity | null = null;

function randomId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  // randomUUID needs a secure context; fall back to 16 random bytes.
  const bytes = new Uint8Array(16);
  c.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function read(): Identity {
  if (cached) return cached;
  let stored: Partial<Identity> = {};
  try {
    stored = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Identity>;
  } catch {
    stored = {};
  }
  const identity: Identity = {
    clientId: typeof stored.clientId === "string" && stored.clientId ? stored.clientId : randomId(),
    name: typeof stored.name === "string" ? stored.name : "",
  };
  if (identity.clientId !== stored.clientId) write(identity);
  cached = identity;
  return identity;
}

function write(identity: Identity) {
  try {
    localStorage.setItem(KEY, JSON.stringify(identity));
  } catch {
    // Private mode or blocked storage: keep it for this tab only.
  }
}

export function getIdentity(): Identity {
  return read();
}

export function saveName(name: string) {
  const next = { ...read(), name: name.trim() };
  cached = next;
  write(next);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    cached = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The identity, or null during server render and hydration. */
export function useIdentity(): Identity | null {
  return useSyncExternalStore(subscribe, read, () => null);
}
