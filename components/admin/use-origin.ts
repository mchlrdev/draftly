"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** `window.location.origin` in the browser, "" during the server render. */
export function useOrigin(): string {
  return useSyncExternalStore(
    subscribe,
    () => window.location.origin,
    () => "",
  );
}
