export type OfflineAction = { id: string; type: "order" | "store"; payload: unknown; createdAt: string };
const KEY = "alsat-offline-queue";
export function readOfflineQueue(): OfflineAction[] { if (typeof window === "undefined") return []; try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } }
export function queueOfflineAction(type: OfflineAction["type"], payload: unknown) { const next = [...readOfflineQueue(), { id: crypto.randomUUID(), type, payload, createdAt: new Date().toISOString() }]; localStorage.setItem(KEY, JSON.stringify(next)); return next; }
export function clearOfflineQueue() { localStorage.removeItem(KEY); }
