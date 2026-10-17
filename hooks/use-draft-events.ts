"use client";

import { useEffect, useRef } from "react";
import type { DraftEvent } from "@/lib/api-types";
import type { DraftAction } from "@/hooks/use-draft-state";
import { ApiError, reviewerApi, type DraftRef } from "@/lib/reviewer/api";

// Live comments: one EventSource per open draft. Every (re)connect reloads
// the full snapshot first, so events missed while the stream was down (or
// between the server render and the first connect) can't be lost. A 401 on
// that reload means the password was rotated: hand back to the gate.

const EVENT_TYPES: DraftEvent["type"][] = [
  "thread.created",
  "thread.updated",
  "thread.deleted",
  "comment.created",
  "comment.updated",
  "comment.deleted",
];

const MAX_BACKOFF_MS = 15_000;

export function useDraftEvents(
  ref: DraftRef,
  dispatch: (action: DraftAction) => void,
  onLocked: () => void,
) {
  const { project, draft } = ref;
  // Callbacks change identity on every render; the stream must not.
  const dispatchRef = useRef(dispatch);
  const onLockedRef = useRef(onLocked);
  useEffect(() => {
    dispatchRef.current = dispatch;
    onLockedRef.current = onLocked;
  });

  useEffect(() => {
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let stopped = false;
    let resync = 0;

    const reload = async () => {
      const id = ++resync;
      try {
        const snapshot = await reviewerApi.snapshot({ project, draft });
        if (!stopped && id === resync) dispatchRef.current({ type: "snapshot", snapshot });
      } catch (err) {
        if (stopped) return;
        if (err instanceof ApiError && (err.status === 401 || err.status === 404)) {
          stopped = true;
          source?.close();
          onLockedRef.current();
        }
      }
    };

    const connect = () => {
      if (stopped) return;
      source = new EventSource(reviewerApi.eventsUrl({ project, draft }));
      source.onopen = () => {
        attempt = 0;
        void reload();
      };
      for (const type of EVENT_TYPES) {
        source.addEventListener(type, (e) => {
          try {
            const event = JSON.parse((e as MessageEvent<string>).data) as DraftEvent;
            dispatchRef.current({ type: "event", event });
          } catch {
            // A malformed message is skipped; the next reconnect resyncs.
          }
        });
      }
      source.onerror = () => {
        // The browser retries on its own while CONNECTING. A CLOSED stream
        // (non-200 answer) needs a fresh EventSource, with backoff, and a
        // reload tells us whether access itself is gone.
        if (source?.readyState !== EventSource.CLOSED) return;
        source.close();
        void reload();
        const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt++);
        retryTimer = setTimeout(connect, delay);
      };
    };

    connect();

    // A laptop waking up or a tab coming back: resync right away.
    const onVisible = () => {
      if (document.visibilityState === "visible") void reload();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      source?.close();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [project, draft]);
}
