// Page order helpers for the draft page. Pure: they return a new id array.

/** Moves `id` by `delta` places (−1 up, +1 down), clamped to the ends. */
export function moveBy(order: readonly string[], id: string, delta: number): string[] {
  const from = order.indexOf(id);
  if (from === -1) return [...order];
  const to = Math.max(0, Math.min(order.length - 1, from + delta));
  return moveTo(order, from, to);
}

/** Moves the item at index `from` to index `to`. */
export function moveTo(order: readonly string[], from: number, to: number): string[] {
  const next = [...order];
  if (from < 0 || from >= next.length || to < 0 || to >= next.length) return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** True when both arrays hold the same ids in the same order. */
export function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}
