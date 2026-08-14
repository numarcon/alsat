"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Named = { id: string; name: string };
type Forwarder = { id: string; full_name: string };
type Product = { id: string; name: string; price: number };
type Order = { id: string; customer_id: string | null; warehouse_id: string | null; forwarder_id: string | null; status: string; payment_status: string; total: number; source: string };

const money = { format: (value: number) => `${Math.round(Number(value) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₸` };
const statuses = ["draft", "submitted", "confirmed", "picking", "out_for_delivery", "delivered", "cancelled"];
const statusLabels: Record<string, string> = { draft: "Жоба", submitted: "Жіберілді", confirmed: "Бекітілді", picking: "Жиналуда", out_for_delivery: "Жеткізілуде", delivered: "Жеткізілді", cancelled: "Бас тартылды" };

export default function CompanyOrders({ companyId }: { companyId: string | null }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Named[]>([]);
  const [warehouses, setWarehouses] = useState<Named[]>([]);
  const [forwarders, setForwarders] = useState<Forwarder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !companyId) return;
    const [o, c, w, f, p] = await Promise.all([
      supabase.from("orders").select("id,customer_id,warehouse_id,forwarder_id,status,payment_status,total,source").eq("company_id", companyId).order("created_at", { ascending: false }),
      supabase.from("customers").select("id,name").eq("company_id", companyId).order("name"),
      supabase.from("warehouses").select("id,name").eq("company_id", companyId).eq("active", true).order("name"),
      supabase.from("forwarders").select("id,full_name").eq("company_id", companyId).eq("active", true).order("full_name"),
      supabase.from("products").select("id,name,price").eq("company_id", companyId).eq("workspace_active", true).order("name"),
    ]);
    const error = o.error || c.error || w.error || f.error || p.error;
    if (error) { setMessage(error.message); return; }
    setOrders(((o.data ?? []) as Order[]).map((order) => ({ ...order, total: Number(order.total || 0) })));
    setCustomers((c.data ?? []) as Named[]);
    setWarehouses((w.data ?? []) as Named[]);
    setForwarders((f.data ?? []) as Forwarder[]);
    setProducts(((p.data ?? []) as Product[]).map((product) => ({ ...product, price: Number(product.price || 0) })));
  }, [companyId]);

  useEffect(() => { void load(); }, [load]);

  async function createEntity(event: FormEvent<HTMLFormElement>, kind: "customer" | "warehouse" | "forwarder") {
    event.preventDefault();
    if (!supabase || !companyId) return;
    setBusy(true); setMessage("");
    const form = event.currentTarget;
    const values = new FormData(form);
    const result = kind === "customer"
      ? await supabase.from("customers").insert({ company_id: companyId, name: String(values.get("name")), address: String(values.get("address") || ""), phone: String(values.get("phone") || "") })
      : kind === "warehouse"
        ? await supabase.from("warehouses").insert({ company_id: companyId, name: String(values.get("name")), address: String(values.get("address") || "") })
        : await supabase.from("forwarders").insert({ company_id: companyId, full_name: String(values.get("name")), phone: String(values.get("phone") || ""), user_id: String(values.get("user_id") || "") || null });
    if (result.error) setMessage(result.error.message);
    else { form.reset(); setMessage("Дерек сақталды."); await load(); }
    setBusy(false);
  }

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !companyId) return;
    setBusy(true); setMessage("");
    const form = event.currentTarget;
    const values = new FormData(form);
    const product = products.find((item) => item.id === values.get("product_id"));
    if (!product) { setMessage("Тауарды таңдаңыз."); setBusy(false); return; }
    const { data: order, error } = await supabase.from("orders").insert({
      company_id: companyId,
      customer_id: String(values.get("customer_id")),
      warehouse_id: String(values.get("warehouse_id") || "") || null,
      forwarder_id: String(values.get("forwarder_id") || "") || null,
      status: "draft",
      payment_status: "unpaid",
      warehouse_status: "new",
      source: "admin",
    }).select("id").single();
    if (error || !order) { setMessage(error?.message || "Тапсырыс сақталмады."); setBusy(false); return; }
    const { error: itemError } = await supabase.from("order_items").insert({ company_id: companyId, order_id: order.id, product_id: product.id, quantity: Number(values.get("quantity") || 1), unit_price: product.price, commission_amount: 0 });
    if (itemError) { await supabase.from("orders").delete().eq("id", order.id); setMessage(itemError.message); }
    else { form.reset(); setMessage("Тапсырыс құрылды."); await load(); }
    setBusy(false);
  }

  async function saveOrder(order: Order) {
    if (!supabase) return;
    setBusy(true); setMessage("");
    const changes: Record<string, unknown> = { warehouse_id: order.warehouse_id || null, forwarder_id: order.forwarder_id || null, status: order.status, payment_status: order.payment_status };
    if (order.status === "delivered") changes.delivered_at = new Date().toISOString();
    if (order.payment_status === "paid") changes.paid_at = new Date().toISOString();
    const { error } = await supabase.from("orders").update(changes).eq("id", order.id).eq("company_id", companyId);
    setMessage(error ? error.message : "Тапсырыс жаңартылды. Delivered + paid болса, комиссия автоматты есептеледі.");
    if (!error) await load();
    setBusy(false);
  }

  function patchOrder(id: string, values: Partial<Order>) { setOrders((current) => current.map((order) => order.id === id ? { ...order, ...values } : order)); }

  return <>
    <div className="page-actions"><p>Клиенттен жеткізуге дейінгі тапсырыс ағымы.</p></div>
    {message && <div className="toast">{message}<button onClick={() => setMessage("")}>×</button></div>}
    <div className="agent-grid">
      <details className="card action-form"><summary>+ Клиент қосу</summary><form onSubmit={(event) => void createEntity(event, "customer")}><label>Атауы<input name="name" required /></label><label>Мекенжай<input name="address" /></label><label>Телефон<input name="phone" /></label><button className="primary" disabled={busy}>Сақтау</button></form></details>
      <details className="card action-form"><summary>+ Қойма қосу</summary><form onSubmit={(event) => void createEntity(event, "warehouse")}><label>Атауы<input name="name" required /></label><label>Мекенжай<input name="address" /></label><button className="primary" disabled={busy}>Сақтау</button></form></details>
      <details className="card action-form"><summary>+ Экспедитор қосу</summary><form onSubmit={(event) => void createEntity(event, "forwarder")}><label>Аты-жөні<input name="name" required /></label><label>Телефон<input name="phone" /></label><label>Auth User ID<input name="user_id" placeholder="Қызметкер UUID" /></label><button className="primary" disabled={busy}>Сақтау</button></form></details>
    </div>
    <form className="card action-form" onSubmit={createOrder}><h3>Жаңа тапсырыс</h3><div className="two"><label>Клиент<select name="customer_id" required defaultValue=""><option value="" disabled>Таңдаңыз</option>{customers.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Тауар<select name="product_id" required defaultValue=""><option value="" disabled>Таңдаңыз</option>{products.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label></div><div className="two"><label>Саны<input name="quantity" type="number" min="1" defaultValue="1" required /></label><label>Қойма<select name="warehouse_id" defaultValue=""><option value="">Кейін</option>{warehouses.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label></div><label>Экспедитор<select name="forwarder_id" defaultValue=""><option value="">Кейін</option>{forwarders.map((item) => <option value={item.id} key={item.id}>{item.full_name}</option>)}</select></label><button className="primary" disabled={busy || !customers.length || !products.length}>Тапсырысты сақтау</button></form>
    <section className="card product-card"><div className="table-head"><span>Тапсырыс</span><span>Сома</span><span>Күйі / Төлем</span><span>Логистика</span></div>{orders.map((order) => <article className="product-row" key={order.id}><div className="product-name"><span className="product-thumb">▤</span><div><strong>№{order.id.slice(0, 8).toUpperCase()}</strong><small>{customers.find((item) => item.id === order.customer_id)?.name || "Клиент"}</small></div></div><b>{money.format(order.total)}</b><div className="visibility"><select value={order.status} onChange={(event) => patchOrder(order.id, { status: event.target.value })}>{statuses.map((status) => <option value={status} key={status}>{statusLabels[status]}</option>)}</select><select value={order.payment_status} onChange={(event) => patchOrder(order.id, { payment_status: event.target.value })}><option value="unpaid">Төленбеген</option><option value="partial">Жартылай</option><option value="paid">Төленді</option><option value="refunded">Қайтарылды</option></select></div><div className="visibility"><select value={order.warehouse_id || ""} onChange={(event) => patchOrder(order.id, { warehouse_id: event.target.value || null })}><option value="">Қойма жоқ</option>{warehouses.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><select value={order.forwarder_id || ""} onChange={(event) => patchOrder(order.id, { forwarder_id: event.target.value || null })}><option value="">Экспедитор жоқ</option>{forwarders.map((item) => <option value={item.id} key={item.id}>{item.full_name}</option>)}</select><button className="primary" disabled={busy} onClick={() => void saveOrder(order)}>Сақтау</button></div></article>)}</section>
  </>;
}
