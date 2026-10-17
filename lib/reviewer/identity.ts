"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

// Who is commenting in this browser: a display name (asked once, at the
// password gate) and a random clientId that marks "my" comments. Both live in
// localStorage, shared by every draft on this origin. The clientId is the
// edit/delete credential, so the server only ever sends its SHA-256 back
// (`Comment.authorKey`); we hash our own to recognise our comments.

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

const keys = new Map<string, Promise<string>>();

/** Lowercase hex SHA-256 of a clientId, as the server computes `authorKey`. */
export function authorKeyFor(clientId: string): Promise<string> {
  let key = keys.get(clientId);
  if (!key) {
    key = sha256Hex(clientId);
    keys.set(clientId, key);
  }
  return key;
}

/** This browser's authorKey, or null until it is computed. */
export function useAuthorKey(clientId: string | null): string | null {
  const [result, setResult] = useState<{ clientId: string; key: string } | null>(null);
  useEffect(() => {
    if (!clientId) return;
    let live = true;
    void authorKeyFor(clientId).then((key) => {
      if (live) setResult({ clientId, key });
    });
    return () => {
      live = false;
    };
  }, [clientId]);
  return result && result.clientId === clientId ? result.key : null;
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const subtle = globalThis.crypto?.subtle;
  // crypto.subtle needs a secure context; plain-http LAN access falls back.
  const bytes = subtle ? new Uint8Array(await subtle.digest("SHA-256", data)) : sha256Fallback(data);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98,
  0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8,
  0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819,
  0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
  0xc67178f2,
]);

/** Plain SHA-256 for when crypto.subtle is unavailable (insecure context). */
export function sha256Fallback(data: Uint8Array): Uint8Array {
  const bitLength = data.length * 8;
  const padded = new Uint8Array(Math.ceil((data.length + 9) / 64) * 64);
  padded.set(data);
  padded[data.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLength / 2 ** 32));
  view.setUint32(padded.length - 4, bitLength >>> 0);
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = w[i - 16] + s0 + w[i - 7] + s1;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    h[0] += a;
    h[1] += b;
    h[2] += c;
    h[3] += d;
    h[4] += e;
    h[5] += f;
    h[6] += g;
    h[7] += hh;
  }
  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  h.forEach((v, i) => outView.setUint32(i * 4, v));
  return out;
}
