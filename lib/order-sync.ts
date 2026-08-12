import { supabase } from "./supabase";
import { OfflineAction, readOfflineQueue, writeOfflineQueue } from "./offline-queue";

type SyncableItem = { id?: number | string; price?: number; name?: string };
type SyncableOrder = { id?: string; client?: string; total?: number; status?: string; createdAt?: string; items?: SyncableItem[] };

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function syncOrderPayload(order: SyncableOrder) {
  if (!supabase) return { synced: false, reason: "supabase-unconfigured" };
  const companyId = typeof window !== "undefined" ? localStorage.getItem("alsat-company-id") : null;
  if (!isUuid(companyId)) return { synced: false, reason: "company-missing" };

  const createdAt = order.createdAt ? new Date(order.createdAt) : null;
  const createdAtValue = createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.toISOString() : undefined;

  const { data: remoteOrder, error: orderError } = await supabase.from("orders").insert({
    company_id: companyId,
    status: order.status === "Жаңа" ? "draft" : "submitted",
    total: Number(order.total || 0),
    ...(createdAtValue ? { created_at: createdAtValue } : {}),
  }).select("id").single();
  if (orderError || !remoteOrder?.id) return { synced: false, reason: orderError?.message || "order-insert-failed" };

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
