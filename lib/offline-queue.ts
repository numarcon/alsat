export type OfflineAction = { id: string; type: "order" | "store"; payload: unknown; createdAt: string };
const KEY = "alsat-offline-queue";
export function readOfflineQueue(): OfflineAction[] { if (typeof window === "undefined") return []; try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } }
export function queueOfflineAction(type: OfflineAction["type"], payload: unknown) { const next = [...readOfflineQueue(), { id: crypto.randomUUID(), type, payload, createdAt: new Date().toISOString() }]; try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* Private mode can disable storage; the caller still keeps its in-memory state. */ } return next; }
export function writeOfflineQueue(actions: OfflineAction[]) { try { localStorage.setItem(KEY, JSON.stringify(actions)); } catch { /* Keep the current session usable when storage is unavailable. */ } }
export function clearOfflineQueue() { localStorage.removeItem(KEY); }
