import { supabase } from "./supabase";
import { OfflineAction, readOfflineQueue, writeOfflineQueue } from "./offline-queue";

type SyncableItem = { id?: number | string; price?: number; name?: string };
type SyncableOrder = { id?: string; client?: string; total?: number; status?: string; createdAt?: string; items?: SyncableItem[] };

const REMOTE_ORDER_MAP_KEY = "alsat-remote-order-map";

function rememberRemoteOrder(localId: string | undefined, remoteId: string) {
  if (typeof window === "undefined" || !localId) return;
  try {
    const current = JSON.parse(localStorage.getItem(REMOTE_ORDER_MAP_KEY) || "{}") as Record<string, string>;
    current[localId] = remoteId;
    localStorage.setItem(REMOTE_ORDER_MAP_KEY, JSON.stringify(current));
  } catch { /* Keep the local workflow usable if storage is unavailable. */ }
}

export function getRemoteOrderId(localId: string) {
  if (typeof window === "undefined") return undefined;
  try {
    const current = JSON.parse(localStorage.getItem(REMOTE_ORDER_MAP_KEY) || "{}") as Record<string, string>;
    return current[localId];
  } catch { return undefined; }
}

export type WarehouseStatus = "new" | "picking" | "ready" | "labeled" | "shipped";

export async function updateWarehouseOrder(remoteId: string | undefined, status: WarehouseStatus, documents?: { sticker?: string; waybill?: string }) {
  if (!supabase || !isUuid(remoteId)) return { synced: false, reason: "remote-order-missing" };
  const now = new Date().toISOString();
  const timestamp = status === "picking" ? { picking_started_at: now } : status === "ready" ? { ready_at: now } : status === "labeled" ? { labeled_at: now } : status === "shipped" ? { shipped_at: now } : { accepted_at: now };
  const { error } = await supabase.from("orders").update({ warehouse_status: status, ...timestamp, ...(documents?.sticker ? { sticker_code: documents.sticker } : {}), ...(documents?.waybill ? { waybill_number: documents.waybill } : {}) }).eq("id", remoteId);
  return error ? { synced: false, reason: error.message } : { synced: true };
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function syncOrderPayload(order: SyncableOrder) {
  if (!supabase) return { synced: false, reason: "supabase-unconfigured" };
  const companyId = typeof window !== "undefined" ? localStorage.getItem("alsat-company-id") : null;
  if (!isUuid(companyId)) return { synced: false, reason: "company-missing" };

  const createdAt = order.createdAt ? new Date(order.createdAt) : null;
  const createdAtValue = createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.toISOString() : undefined;
  let storeId: string | undefined;
  if (order.client?.trim()) {
    const { data: store } = await supabase.from("stores").select("id").eq("company_id", companyId).eq("name", order.client.trim()).limit(1).maybeSingle();
    if (store?.id) storeId = store.id;
  }

  const { data: remoteOrder, error: orderError } = await supabase.from("orders").insert({
    company_id: companyId,
    ...(storeId ? { store_id: storeId } : {}),
    status: order.status === "Жаңа" ? "draft" : "submitted",
    warehouse_status: "new",
    total: Number(order.total || 0),
    ...(createdAtValue ? { created_at: createdAtValue } : {}),
  }).select("id").single();
  if (orderError || !remoteOrder?.id) return { synced: false, reason: orderError?.message || "order-insert-failed" };
  rememberRemoteOrder(order.id, remoteOrder.id);

  const items = (order.items || []).map((item) => ({
    order_id: remoteOrder.id,
    product_id: isUuid(item.id) ? item.id : null,
    quantity: 1,
    unit_price: Number(item.price || 0),
    commission_amount: 0,
  }));
  if (items.length) {
    const { error: itemError } = await supabase.from("order_items").insert(items);
    if (itemError) return { synced: false, remoteId: remoteOrder.id, reason: itemError.message };
  }
  return { synced: true, remoteId: remoteOrder.id };
}

export async function flushOrderQueue() {
  const actions = readOfflineQueue();
  if (!actions.length) return { synced: 0, remaining: 0 };
  const remaining: OfflineAction[] = [];
  let synced = 0;
  for (const action of actions) {
    if (action.type !== "order") { remaining.push(action); continue; }
    const result = await syncOrderPayload(action.payload as SyncableOrder);
    if (result.synced) synced += 1;
    else remaining.push(action);
  }
  writeOfflineQueue(remaining);
  return { synced, remaining: remaining.length };
}
