/*
 * Keeps every open Mmry tab in step. A change made in one tab (a ticked task,
 * a new person, a sign-out) is announced here, and the others refresh the
 * affected data instead of showing a stale copy.
 *
 * Messages carry only cache keys and event names - never patient data.
 */

export type SyncMessage =
  | { type: "invalidate"; prefix: string }
  | { type: "patients" }
  | { type: "signout" }
  | { type: "signin" };

const CHANNEL = "mmry-sync";
let channel: BroadcastChannel | null = null;
const handlers = new Set<(msg: SyncMessage) => void>();

function open(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (event: MessageEvent<SyncMessage>) => handlers.forEach((fn) => fn(event.data));
  }
  return channel;
}

export function broadcast(msg: SyncMessage): void {
  open()?.postMessage(msg);
}

/* Messages from OTHER tabs only; a tab never receives its own posts. */
export function onSync(fn: (msg: SyncMessage) => void): () => void {
  open();
  handlers.add(fn);
  return () => handlers.delete(fn);
}
