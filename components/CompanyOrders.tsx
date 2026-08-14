"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Named = { id: string; name: string };
type Forwarder = { id: string; full_name: string };
type Product = { id: string; name: string; price: number };
type Order = { id: string; customer_id: string | null; warehouse_id: string | null; forwarder_id: string | null; status: string; payment_status: string; total: number; source: string };

const money = { format: (value: number) => `${Math.round(Number(value) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₸` };
const statuses = ["new", "draft", "submitted", "confirmed", "picking", "out_for_delivery", "delivered", "cancelled"];
const statusLabels: Record<string, string> = { new: "Жаңа", draft: "Жоба", submitted: "Жіберілді", confirmed: "Бекітілді", picking: "Жиналуда", out_for_delivery: "Жеткізілуде", delivered: "Жеткізілді", cancelled: "Бас тартылды" };

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

  return <section className="ws2-orders">
    <header className="ws2-orders-intro">
      <div><span>САТУ АҒЫМЫ</span><h1>Тапсырыстарды басқару</h1><p>Клиенттен қоймаға, одан экспедитор мен төлемге дейінгі толық процесс.</p></div>
      <div className="ws2-orders-counter"><strong>{orders.length}</strong><small>жалпы тапсырыс</small></div>
    </header>

    {message && <div className="toast">{message}<button onClick={() => setMessage("")}>×</button></div>}

    <div className="ws2-order-tools">
      <details className="ws2-order-tool"><summary><span>+</span><div><strong>Клиент қосу</strong><small>Жаңа сауда нүктесі</small></div><b>⌄</b></summary><form onSubmit={(event) => void createEntity(event, "customer")}><label>Атауы<input name="name" required placeholder="Мысалы, Строймаг" /></label><label>Мекенжай<input name="address" placeholder="Қала, көше" /></label><label>Телефон<input name="phone" placeholder="+7 700 000 00 00" /></label><button className="primary" disabled={busy}>Клиентті сақтау</button></form></details>
      <details className="ws2-order-tool"><summary><span>+</span><div><strong>Қойма қосу</strong><small>Компания қоймасы</small></div><b>⌄</b></summary><form onSubmit={(event) => void createEntity(event, "warehouse")}><label>Атауы<input name="name" required placeholder="Негізгі қойма" /></label><label>Мекенжай<input name="address" placeholder="Қала, көше" /></label><button className="primary" disabled={busy}>Қойманы сақтау</button></form></details>
      <details className="ws2-order-tool"><summary><span>+</span><div><strong>Экспедитор қосу</strong><small>Жеткізу қызметкері</small></div><b>⌄</b></summary><form onSubmit={(event) => void createEntity(event, "forwarder")}><label>Аты-жөні<input name="name" required placeholder="Қызметкердің аты" /></label><label>Телефон<input name="phone" placeholder="+7 700 000 00 00" /></label><label>Auth User ID<input name="user_id" placeholder="Қызметкер UUID" /></label><button className="primary" disabled={busy}>Экспедиторды сақтау</button></form></details>
    </div>

    <form className="ws2-order-create" onSubmit={createOrder}>
      <div className="ws2-order-create-head"><div><span>+</span><div><h2>Жаңа тапсырыс</h2><p>Негізгі деректерді таңдаңыз. Логистиканы кейін де бекітуге болады.</p></div></div><small>ЖОБА РЕТІНДЕ САҚТАЛАДЫ</small></div>
      <div className="ws2-order-fields">
        <label>Клиент<select name="customer_id" required defaultValue=""><option value="" disabled>Клиентті таңдаңыз</option>{customers.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
        <label className="ws2-order-product-field">Тауар<select name="product_id" required defaultValue=""><option value="" disabled>Тауарды таңдаңыз</option>{products.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
        <label>Саны<input name="quantity" type="number" min="1" defaultValue="1" required /></label>
        <label>Қойма<select name="warehouse_id" defaultValue=""><option value="">Кейін бекіту</option>{warehouses.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
        <label>Экспедитор<select name="forwarder_id" defaultValue=""><option value="">Кейін бекіту</option>{forwarders.map((item) => <option value={item.id} key={item.id}>{item.full_name}</option>)}</select></label>
      </div>
      <div className="ws2-order-create-foot"><p>{!customers.length ? "Алдымен клиент қосыңыз." : !products.length ? "Алдымен белсенді тауар қосыңыз." : "Тапсырыс компанияңыздың шекарасында қорғалады."}</p><button className="primary" disabled={busy || !customers.length || !products.length}>{busy ? "Сақталуда…" : "Тапсырысты сақтау"}<span>→</span></button></div>
    </form>

    <section className="ws2-orders-list">
      <header><div><h2>Соңғы тапсырыстар</h2><p>Күй, төлем және жеткізу жауаптыларын бір жерден басқарыңыз.</p></div><span>{orders.length} жазба</span></header>
      {orders.length > 0 && <div className="ws2-order-table-head"><span>Тапсырыс</span><span>Сома</span><span>Күйі және төлем</span><span>Логистика</span></div>}
      {orders.map((order) => <article className="ws2-order-row" key={order.id}>
        <div className="ws2-order-identity"><span>▤</span><div><strong>№{order.id.slice(0, 8).toUpperCase()}</strong><small>{customers.find((item) => item.id === order.customer_id)?.name || "Клиент"}</small><em>{order.source === "agent" ? "Сауда өкілі" : order.source === "marketplace" ? "Marketplace" : "Workspace"}</em></div></div>
        <div className="ws2-order-sum"><strong>{money.format(order.total)}</strong><small>Жалпы сома</small></div>
        <div className="ws2-order-selects"><label>Күйі<select value={order.status} onChange={(event) => patchOrder(order.id, { status: event.target.value })}>{statuses.map((status) => <option value={status} key={status}>{statusLabels[status]}</option>)}</select></label><label>Төлем<select value={order.payment_status} onChange={(event) => patchOrder(order.id, { payment_status: event.target.value })}><option value="unpaid">Төленбеген</option><option value="partial">Жартылай</option><option value="paid">Төленді</option><option value="refunded">Қайтарылды</option></select></label></div>
        <div className="ws2-order-logistics"><div><label>Қойма<select value={order.warehouse_id || ""} onChange={(event) => patchOrder(order.id, { warehouse_id: event.target.value || null })}><option value="">Қойма жоқ</option>{warehouses.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Экспедитор<select value={order.forwarder_id || ""} onChange={(event) => patchOrder(order.id, { forwarder_id: event.target.value || null })}><option value="">Экспедитор жоқ</option>{forwarders.map((item) => <option value={item.id} key={item.id}>{item.full_name}</option>)}</select></label></div><button className="primary" disabled={busy} onClick={() => void saveOrder(order)}>Сақтау</button></div>
      </article>)}
      {!orders.length && <div className="ws2-orders-empty"><span>▤</span><h3>Әзірге тапсырыс жоқ</h3><p>Жоғарғы форма арқылы алғашқы тапсырысты жасаңыз.</p></div>}
    </section>
  </section>;
}
