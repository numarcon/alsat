"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { getRemoteOrderId, updateWarehouseOrder } from "../../lib/order-sync";
import { supabase } from "../../lib/supabase";
import { buildPickupQrValue } from "../../lib/warehouse-qr";

type Screen = "dashboard" | "products" | "product" | "receive" | "issue" | "stock" | "locations" | "inventory" | "orders" | "order" | "notifications" | "reports" | "profile" | "scanner" | "transfer" | "return" | "offline" | "more";
type Product = { name: string; sku: string; stock: number; price: number; state: "Қолжетімді" | "Аз қалды" | "Төмен"; icon: string };
type OrderStatus = "new" | "picking" | "ready" | "labeled" | "shipped";
type WarehouseOrder = { id: string; remoteId?: string; store: string; address: string; total: number; createdAt: string; status: OrderStatus; delivered?: boolean; deliveredAt?: string; recipientName?: string; items: { name: string; quantity: number; price: number }[]; sticker?: string; waybill?: string; stickerAttached?: boolean; waybillPlaced?: boolean };
type RemoteWarehouseOrder = { id: string; status: string; total: number | string; created_at: string; warehouse_status: string | null; delivered_at: string | null; delivery_recipient_name: string | null; sticker_code: string | null; waybill_number: string | null; customers: { name: string; address: string | null } | Array<{ name: string; address: string | null }> | null; order_items: Array<{ quantity: number; unit_price: number | string; products: { name: string } | Array<{ name: string }> | null }> };
const products: Product[] = [
  { name: "KRAUSZ Шам A60 12W E27 6500K", sku: "KLZ-A60-12W-6500", stock: 1250, price: 650, state: "Қолжетімді", icon: "◌" },
  { name: "KRAUSZ Проектор 100W 6500K IP65", sku: "KLZ-FL-100W-6500", stock: 320, price: 8500, state: "Аз қалды", icon: "▣" },
  { name: "KRAUSZ Панель LED 36W 595x595", sku: "KLZ-PL-36W-6500", stock: 560, price: 4200, state: "Қолжетімді", icon: "□" },
  { name: "KRAUSZ Линейный светильник 36W", sku: "KLZ-LN-36W-6500", stock: 150, price: 5200, state: "Төмен", icon: "▱" },
  { name: "KRAUSZ Розетка 2P+E 16A Белая", sku: "KLZ-SKT-2P-E-16A", stock: 890, price: 490, state: "Қолжетімді", icon: "⊙" },
];
const money = (value: number) => `${value.toLocaleString("kk-KZ")} ₸`;
const statusLabel: Record<OrderStatus, string> = { new: "Қоймаға түсті", picking: "Жинауда", ready: "Дайын", labeled: "Экспедиторға дайын", shipped: "Экспедитор алып кетті" };
const orderStatusClass: Record<OrderStatus, string> = { new: "blue", picking: "yellow", ready: "green", labeled: "green", shipped: "green" };
const warehouseOrderLabel = (order: WarehouseOrder) => order.delivered ? "Жеткізілді" : statusLabel[order.status];
const initialOrders: WarehouseOrder[] = [
  { id: "№100045", store: "Строймаг", address: "Алматы қ., Райымбек 348", total: 245000, createdAt: "12.05.2024 · 10:30", status: "new", items: [{ name: products[0].name, quantity: 10, price: 650 }, { name: products[1].name, quantity: 2, price: 8500 }, { name: products[2].name, quantity: 5, price: 4200 }] },
  { id: "№100046", store: "ЭлектроДом", address: "Алматы қ., Төле би 215", total: 185000, createdAt: "12.05.2024 · 11:15", status: "picking", items: [{ name: products[0].name, quantity: 20, price: 650 }, { name: products[4].name, quantity: 12, price: 490 }] },
  { id: "№100047", store: "Техносвет", address: "Алматы қ., Абай 68", total: 92000, createdAt: "12.05.2024 · 12:00", status: "ready", items: [{ name: products[2].name, quantity: 8, price: 4200 }] },
  { id: "№100048", store: "Светлый дом", address: "Алматы қ., Сайын 22", total: 70000, createdAt: "12.05.2024 · 13:00", status: "labeled", sticker: "ST-100048", waybill: "НК-100048", items: [{ name: products[3].name, quantity: 5, price: 5200 }] },
];

export default function WarehouseApp() {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [logged, setLogged] = useState(false);
  const [selected, setSelected] = useState(products[0]);
  const [orders, setOrders] = useState<WarehouseOrder[]>(initialOrders);
  const [selectedOrderId, setSelectedOrderId] = useState<string>(initialOrders[0].id);
  const selectedOrder = useMemo(() => orders.find((order) => order.id === selectedOrderId) ?? orders[0], [orders, selectedOrderId]);
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let active = true;
    const authorize = async (userId?: string) => {
      if (!userId) { if (active) setLogged(false); return; }
      const { data: membership } = await client.from("company_users").select("company_id").eq("user_id", userId).eq("role", "warehouse").eq("status", "active").limit(1).maybeSingle();
      if (!active) return;
      if (membership) localStorage.setItem("alsat-company-id", membership.company_id);
      setLogged(Boolean(membership));
    };
    client.auth.getSession().then(({ data }) => { void authorize(data.session?.user.id); });
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => { void authorize(session?.user.id); });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    const client = supabase;
    if (!logged || !client) return;
    const companyId = localStorage.getItem("alsat-company-id");
    if (!companyId || !/^[0-9a-f-]{36}$/i.test(companyId)) return;
    let active = true;

    const loadRemoteOrders = async () => {
      const { data, error } = await client
        .from("orders")
        .select("id,status,total,created_at,warehouse_status,delivered_at,delivery_recipient_name,sticker_code,waybill_number,customers(name,address),order_items(quantity,unit_price,products(name))")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (!active || error || !data) return;

      const remoteOrders = (data as unknown as RemoteWarehouseOrder[]).map((row) => {
        const store = Array.isArray(row.customers) ? row.customers[0] : row.customers;
        const status = (["new", "picking", "ready", "labeled", "shipped"] as const).includes(row.warehouse_status as OrderStatus)
          ? row.warehouse_status as OrderStatus
          : "new";
        return {
          id: `№${row.id.slice(0, 8).toUpperCase()}`,
          remoteId: row.id,
          store: store?.name ?? "Клиент тапсырысы",
          address: store?.address ?? "Мекенжай тапсырыстан алынады",
          total: Number(row.total),
          createdAt: new Date(row.created_at).toLocaleString("kk-KZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
          status,
          delivered: row.status === "delivered" || Boolean(row.delivered_at),
          deliveredAt: row.delivered_at ? new Date(row.delivered_at).toLocaleString("kk-KZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : undefined,
          recipientName: row.delivery_recipient_name ?? undefined,
          sticker: row.sticker_code ?? undefined,
          waybill: row.waybill_number ?? undefined,
          stickerAttached: status === "labeled" || status === "shipped",
          waybillPlaced: status === "labeled" || status === "shipped",
          items: row.order_items.map((line, index) => {
            const product = Array.isArray(line.products) ? line.products[0] : line.products;
            return { name: product?.name ?? `Тауар позициясы ${index + 1}`, quantity: line.quantity, price: Number(line.unit_price) };
          }),
        } satisfies WarehouseOrder;
      });
      setOrders((current) => [...remoteOrders, ...current.filter((order) => !order.remoteId)]);
    };

    void loadRemoteOrders();
    const channel = client
      .channel(`warehouse-orders-${companyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `company_id=eq.${companyId}` }, () => { void loadRemoteOrders(); })
      .subscribe();
    return () => { active = false; void client.removeChannel(channel); };
  }, [logged]);
  useEffect(() => {
    const saved = localStorage.getItem("alsat-warehouse-orders");
    if (saved) { try { setOrders(JSON.parse(saved)); } catch { localStorage.removeItem("alsat-warehouse-orders"); } }
    const agentOrders = localStorage.getItem("alsat-agent-orders");
    if (agentOrders) {
      try {
        const incoming = JSON.parse(agentOrders) as Array<{ id: string; client: string; total: number; createdAt: string; items: Array<{ name: string; price: number }> }>;
        setOrders((current) => {
          const additions = incoming.filter((item) => !current.some((order) => order.id === item.id)).map((item) => ({ id: item.id, store: item.client, address: "Мекенжайы тапсырыстан алынады", total: item.total, createdAt: item.createdAt, status: "new" as OrderStatus, items: item.items.map((line) => ({ name: line.name, quantity: 1, price: line.price })) }));
          const next = [...additions, ...current];
          localStorage.setItem("alsat-warehouse-orders", JSON.stringify(next));
          return next;
        });
      } catch { /* Ignore an incomplete offline order payload. */ }
    }
  }, []);
  useEffect(() => {
    const mergeIncomingOrder = (raw: string | null) => {
      if (!raw) return;
      try {
        const incoming = JSON.parse(raw) as Array<{ id: string; client: string; total: number; createdAt: string; items: Array<{ name: string; price: number }> }>;
        setOrders((current) => {
          const additions = incoming.filter((item) => !current.some((order) => order.id === item.id)).map((item) => ({ id: item.id, remoteId: getRemoteOrderId(item.id), store: item.client, address: "Мекенжайы тапсырыстан алынады", total: item.total, createdAt: item.createdAt, status: "new" as OrderStatus, items: item.items.map((line) => ({ name: line.name, quantity: 1, price: line.price })) }));
          return additions.length ? [...additions, ...current] : current;
        });
      } catch { /* Ignore an incomplete offline order payload. */ }
    };
    const hydrateRemoteIds = () => setOrders((current) => current.map((order) => order.remoteId ? order : { ...order, remoteId: getRemoteOrderId(order.id) }));
    const onStorage = (event: StorageEvent) => {
      if (event.key === "alsat-agent-orders") mergeIncomingOrder(event.newValue);
      if (event.key === "alsat-remote-order-map") hydrateRemoteIds();
      if (event.key === "alsat-warehouse-orders" && event.newValue) {
        try {
          const changed = JSON.parse(event.newValue) as WarehouseOrder[];
          setOrders((current) => current.map((order) => {
            const updated = changed.find((candidate) => candidate.id === order.id);
            return updated ? { ...order, status: updated.status, delivered: updated.delivered, deliveredAt: updated.deliveredAt, recipientName: updated.recipientName, sticker: updated.sticker, waybill: updated.waybill } : order;
          }));
        } catch { /* Ignore an incomplete handoff cache update. */ }
      }
    };
    const onAgentOrder = (event: Event) => { const detail = (event as CustomEvent).detail; if (detail) mergeIncomingOrder(JSON.stringify([detail])); };
    const onAgentOrderSynced = () => hydrateRemoteIds();
    window.addEventListener("storage", onStorage);
    window.addEventListener("alsat-agent-order-saved", onAgentOrder);
    window.addEventListener("alsat-agent-order-synced", onAgentOrderSynced);
    return () => { window.removeEventListener("storage", onStorage); window.removeEventListener("alsat-agent-order-saved", onAgentOrder); window.removeEventListener("alsat-agent-order-synced", onAgentOrderSynced); };
  }, []);
  useEffect(() => { if (logged) localStorage.setItem("alsat-warehouse-orders", JSON.stringify(orders)); }, [orders, logged]);
  useEffect(() => {
    const printOrder = (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest("button");
      if (target?.textContent?.trim() === "⌯") window.print();
    };
    document.addEventListener("click", printOrder);
    return () => document.removeEventListener("click", printOrder);
  }, []);

  if (!logged) return <WarehouseLoginAlsat onLogin={() => { window.location.href = "/workspace-login"; }} />;
  const go = (next: Screen) => setScreen(next);
  const openOrder = (order: WarehouseOrder) => { setSelectedOrderId(order.id); go("order"); };
  const updateOrder = (patch: Partial<WarehouseOrder>) => {
    if (!selectedOrder) return;
    setOrders((current) => current.map((order) => order.id === selectedOrder.id ? { ...order, ...patch } : order));
    if (patch.status) void updateWarehouseOrder(selectedOrder.remoteId, patch.status, { sticker: patch.sticker, waybill: patch.waybill });
  };
  return <main className="qmart-role warehouse-shell">
    <header className="role-header"><button onClick={() => go("more")}>☰</button><div><b>ALSAT</b><small>ҚОЙМА МЕНЕДЖЕРІ</small></div><button onClick={() => go("notifications")}>♧</button></header>
    {screen === "dashboard" && <WarehouseDashboard go={go} />}
    {screen === "products" && <WarehouseProducts go={go} onSelect={(product) => { setSelected(product); go("product"); }} />}
    {screen === "product" && <ProductDetail product={selected} go={go} />}
    {screen === "receive" && <WarehouseOperation type="receive" go={go} />}
    {screen === "issue" && <WarehouseOperation type="issue" go={go} />}
    {screen === "stock" && <WarehouseStock go={go} />}
    {screen === "locations" && <WarehouseLocations go={go} />}
    {screen === "inventory" && <Inventory go={go} />}
    {screen === "orders" && <WarehouseOrders orders={orders} go={go} onSelect={openOrder} />}
    {screen === "order" && selectedOrder && <WarehouseOrderDetailWithPrint order={selectedOrder} go={go} updateOrder={updateOrder} />}
    {screen === "notifications" && <WarehouseNotifications go={go} />}
    {screen === "reports" && <WarehouseReports go={go} orders={orders} />}
    {screen === "profile" && <WarehouseProfile go={go} />}
    {screen === "scanner" && <WarehouseScanner go={go} />}
    {screen === "transfer" && <Transfer go={go} />}
    {screen === "return" && <ReturnGoods go={go} />}
    {screen === "offline" && <Offline go={go} />}
    {screen === "more" && <WarehouseMore go={go} />}
    <nav className="role-bottom"><button className={screen === "dashboard" ? "active" : ""} onClick={() => go("dashboard")}>⌂<small>Басты</small></button><button className={screen === "products" || screen === "product" || screen === "stock" ? "active" : ""} onClick={() => go("products")}>▤<small>Тауарлар</small></button><button className={screen === "receive" || screen === "issue" || screen === "transfer" || screen === "return" ? "active" : ""} onClick={() => go("receive")}>♧<small>Операциялар</small></button><button className={screen === "orders" ? "active" : ""} onClick={() => go("orders")}>▣<small>Тапсырыстар</small></button><button className={screen === "more" || screen === "profile" ? "active" : ""} onClick={() => go("more")}>•••<small>Көбірек</small></button></nav>
  </main>;
}

function WarehouseLogin({ onLogin }: { onLogin: () => void }) { return <main className="role-login warehouse-login"><div className="role-login-brand"><span>Q</span><b>QMART</b><small>ҚОЙМА МЕНЕДЖЕРІ</small></div><h1>Жүйеге кіру</h1><p>Аккаунтыңызға кіріп, қойма жұмысыңызды басқарыңыз</p><label>Телефон нөмірі<input placeholder="⌕ +7 (___) ___-__-__" inputMode="tel"/></label><label>Құпия сөз<input placeholder="••••••••••••" type="password"/></label><div className="login-check"><span>☑　Мені есте сақтау</span><a>Құпия сөзді ұмыттыңыз ба?</a></div><button className="role-primary" onClick={onLogin}>Кіру</button><div className="role-or">немесе</div><button className="role-secondary" onClick={onLogin}>▣　SMS арқылы кіру</button></main> }
function WarehouseDashboard({ go }: { go: (screen: Screen) => void }) { return <section className="role-screen"><div className="role-profile"><span className="role-avatar">НӘ</span><div><strong>Сәлеметсіз бе,<br/>Нұрлан!</strong><small>Қойма менеджері</small></div><button onClick={() => go("notifications")}>♧</button></div><section className="role-metrics warehouse-metrics"><small>Бүгінгі көрсеткіштер</small><p>12 мамыр, жексенбі</p><div><span>Кіріс<strong>120</strong><em>+12%</em></span><span>Қалдық<strong>3 456</strong><em>+2%</em></span><span>Шығыс<strong>98</strong><em>+8%</em></span><span>Тапсырыстар<strong>24</strong><em>+5%</em></span></div></section><div className="role-section-title"><h3>Жылдам әрекеттер</h3></div><div className="warehouse-actions"><button onClick={() => go("receive")}>▣<small>Тауарды қабылдау</small></button><button onClick={() => go("issue")}>▤<small>Тауарды шығару</small></button><button onClick={() => go("locations")}>▦<small>Қалдық санау</small></button><button onClick={() => go("transfer")}>♧<small>Трансфер</small></button><button onClick={() => go("return")}>↶<small>Қайтарым</small></button><button onClick={() => go("orders")}>▣<small>Жаңа тапсырыс</small></button></div><div className="role-section-title"><h3>Соңғы операциялар</h3><button onClick={() => go("reports")}>Барлығын көру ›</button></div><div className="operation-row"><span className="op green">▣</span><div><strong>Тауар қабылданды</strong><small>№P100045 · 11.05.2024 10:30</small></div><b className="positive">+250</b></div><div className="operation-row"><span className="op red">▤</span><div><strong>Тауар шығарылды</strong><small>№S010032 · 11.05.2024 15:20</small></div><b className="negative">−120</b></div><div className="operation-row"><span className="op gray">▦</span><div><strong>Қалдық санау</strong><small>№C100007 · 11.05.2024 18:10</small></div><b>✓</b></div></section> }
function WarehouseProducts({ go, onSelect }: { go: (screen: Screen) => void; onSelect: (product: Product) => void }) { const [query,setQuery]=useState("");const [filter,setFilter]=useState("all");const filtered=products.filter((product)=>`${product.name} ${product.sku}`.toLowerCase().includes(query.toLowerCase())&&(filter==="all"||filter==="stock"&&product.stock>0||filter==="low"&&product.state!=="Қолжетімді"));return <section className="role-screen"><div className="role-heading"><h1>Тауарлар</h1><button onClick={()=>go("scanner")}>⌁</button></div><input className="role-input" value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="⌕　Іздеу"/><div className="role-tabs"><button className={filter==="all"?"active":""} onClick={()=>setFilter("all")}>Барлығы {products.length}</button><button className={filter==="stock"?"active":""} onClick={()=>setFilter("stock")}>Қалдықта</button><button className={filter==="low"?"active":""} onClick={()=>setFilter("low")}>Аз қалған</button><button onClick={()=>go("locations")}>Топтар</button></div>{filtered.map((product)=><button className="warehouse-product" key={product.sku} onClick={()=>onSelect(product)}><span className="warehouse-product-icon">{product.icon}</span><div><strong>{product.name}</strong><small>SKU: {product.sku}</small><span>{product.stock} дана</span></div><em className={product.state==="Қолжетімді"?"green":product.state==="Аз қалды"?"yellow":"red"}>{product.state}</em></button>)}</section> }
function ProductDetail({ product, go }: { product: Product; go: (screen: Screen) => void }) { const [tab,setTab]=useState("info");const [editing,setEditing]=useState(false);return <section className="role-screen"><div className="role-heading"><button className="back" onClick={()=>go("products")}>‹</button><h1>Тауар карточкасы</h1><button onClick={()=>setEditing((value)=>!value)}>✎</button></div><div className="product-detail-top"><span className="product-large-icon">{product.icon}</span><div><h2>{product.name}</h2><small>SKU: {product.sku}</small><em className="green">Қолжетімді</em></div></div><div className="role-tabs">{[["info","Ақпараты"],["stock","Қалдық"],["operations","Операциялар"],["photos","Суреттер"]].map(([id,label])=><button className={tab===id?"active":""} onClick={()=>setTab(id)} key={id}>{label}</button>)}</div>{editing&&<div className="action-panel"><strong>Тауарды өңдеу</strong><input className="role-input" defaultValue={product.name}/><input className="role-input" type="number" defaultValue={product.price}/><button onClick={()=>setEditing(false)}>Сақтау</button></div>}{tab==="info"&&<div className="detail-card"><Info label="Санат" value="Шамдар"/><Info label="Бренд" value="KRAUSZ"/><Info label="Штрихкод" value="4870123456789"/><Info label="Өлшем бірлік" value="дана"/><Info label="Сатып алу бағасы" value="450 ₸"/><Info label="Сату бағасы" value={money(product.price)}/><Info label="ҚҚС" value="12%"/><Info label="Орналасуы" value="A-01-02-03"/></div>}{tab==="stock"&&<div className="detail-card"><Info label="Қолда бар" value={`${product.stock} дана`}/><Info label="Резерв" value="24 дана"/><Info label="Қолжетімді" value={`${Math.max(0,product.stock-24)} дана`}/></div>}{tab==="operations"&&<div className="detail-card"><Info label="Соңғы кіріс" value="+250 · 12.05.2024"/><Info label="Соңғы шығыс" value="−120 · 11.05.2024"/></div>}{tab==="photos"&&<div className="action-panel"><strong>Тауар суреттері</strong><p>Негізгі сурет және қаптама фотосы осы жерде сақталады.</p><button onClick={()=>setEditing(true)}>Сурет қосу</button></div>}<div className="operation-buttons"><button onClick={()=>go("transfer")}>Трансфер</button><button onClick={()=>go("issue")}>Операция⌄</button></div></section> }
function WarehouseOperation({ type, go }: { type: "receive" | "issue"; go: (screen: Screen) => void }) { const incoming=type==="receive";const [tab,setTab]=useState("new");const [added,setAdded]=useState(false);const [saved,setSaved]=useState(false);return <section className="role-screen"><div className="role-heading"><button className="back" onClick={()=>go("dashboard")}>‹</button><h1>{incoming?"Қабылдау":"Шығару"}</h1><button onClick={()=>go("scanner")}>⌁</button></div><div className="role-tabs"><button className={tab==="new"?"active":""} onClick={()=>setTab("new")}>Жаңа {incoming?"қабылдау":"шығару"}</button><button className={tab==="history"?"active":""} onClick={()=>setTab("history")}>Тарих</button></div>{tab==="history"?<div className="detail-card"><Info label="12.05.2024" value={incoming?"P010045 · +250":"S010032 · −120"}/><Info label="11.05.2024" value={incoming?"P010044 · +180":"S010031 · −86"}/></div>:<><div className="detail-card operation-form"><Info label="Құжат түрі" value={incoming?"Кіріс құжаты (ПО)":"Шығыс құжаты (СО)"}/><Info label={incoming?"Жеткізуші":"Алушы"} value={incoming?"KRAUSZ Electric":"Строймаг"}/><Info label="Құжат нөмірі" value={incoming?"P010045":"S010032"}/><Info label="Тауарлар" value={added?(incoming?"4 тауар · 251 дана":"3 тауар · 121 дана"):(incoming?"3 тауар · 250 дана":"2 тауар · 120 дана")}/></div>{saved&&<div className="action-panel success">✓ Операция сақталды</div>}<button className="role-primary" onClick={()=>setAdded(true)}>{added?"✓ Тауар қосылды":"Тауарларды қосу"}</button><button className="role-primary secondary-green" onClick={()=>setSaved(true)}>{incoming?"Қабылдауды сақтау":"Шығаруды сақтау"}</button></>}</section> }
function WarehouseStock({ go }: { go: (screen: Screen) => void }) { const [query,setQuery]=useState("");const [filter,setFilter]=useState("all");const filtered=products.filter((product)=>product.name.toLowerCase().includes(query.toLowerCase())&&(filter==="all"||filter==="low"&&product.state!=="Қолжетімді"||filter==="idle"&&product.stock<200));return <section className="role-screen"><div className="role-heading"><button className="back" onClick={()=>go("products")}>‹</button><h1>Қалдықтар</h1><button onClick={()=>go("locations")}>⌖</button></div><input className="role-input" value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="⌕　Іздеу"/><div className="stock-summary"><span><small>Барлық тауар</small><b>{products.length}</b></span><span><small>Жалпы қалдық</small><b>{products.reduce((sum,product)=>sum+product.stock,0)}</b></span><span><small>Құндылығы</small><b>{money(products.reduce((sum,product)=>sum+product.stock*product.price,0))}</b></span></div><div className="role-tabs"><button className={filter==="all"?"active":""} onClick={()=>setFilter("all")}>Барлығы</button><button className={filter==="low"?"active":""} onClick={()=>setFilter("low")}>Аз қалған</button><button className={filter==="idle"?"active":""} onClick={()=>setFilter("idle")}>Қозғалмай тұрған</button></div>{filtered.map((product)=><div className="warehouse-product stock-product" key={product.sku}><span className="warehouse-product-icon">{product.icon}</span><div><strong>{product.name}</strong><small>{product.stock} дана</small></div><b>{money(product.stock*product.price)}</b></div>)}</section> }
function WarehouseLocations({ go }: { go: (screen: Screen) => void }) { const [query,setQuery]=useState("");const [section,setSection]=useState("all");const [selected,setSelected]=useState("");const locations=["A-01-01","A-01-02","A-01-03","A-01-04","A-02-01","A-02-02","A-02-03","A-02-04","B-01-01","B-01-02","B-01-03","B-01-04"];const visible=locations.filter((item)=>item.toLowerCase().includes(query.toLowerCase())&&(section==="all"||item.startsWith(section)));return <section className="role-screen"><div className="role-heading"><button className="back" onClick={()=>go("products")}>‹</button><h1>Склад картасы</h1><button onClick={()=>go("inventory")}>▦</button></div><input className="role-input" value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="⌕　Орналасуды іздеу"/><div className="role-tabs">{[["all","Барлығы"],["A","A қоймасы"],["B","B қоймасы"],["C","C қоймасы"]].map(([id,label])=><button className={section===id?"active":""} onClick={()=>setSection(id)} key={id}>{label}</button>)}</div>{selected&&<div className="action-panel success">{selected} · {selected.endsWith("02")?"Тауар орналасқан":"Бос ұяшық"}</div>}<div className="location-grid">{visible.map((item,index)=><button className={`${index===1?"occupied":""} ${selected===item?"active":""}`} onClick={()=>setSelected(item)} key={item}>{item}</button>)}</div></section> }
function Inventory({ go }: { go: (screen: Screen) => void }) { const [done,setDone]=useState(false);const [tab,setTab]=useState("new");return <section className="role-screen"><div className="role-heading"><button className="back" onClick={()=>go("stock")}>‹</button><h1>Қалдық санау</h1><button onClick={()=>go("scanner")}>⌁</button></div><div className="role-tabs"><button className={tab==="new"?"active":""} onClick={()=>setTab("new")}>Жаңа санау</button><button className={tab==="history"?"active":""} onClick={()=>setTab("history")}>Тарих</button></div>{tab==="history"?<div className="detail-card"><Info label="12.05.2024 · A қоймасы" value="98% сәйкестік"/><Info label="05.05.2024 · B қоймасы" value="99% сәйкестік"/></div>:<><div className="detail-card operation-form"><Info label="Санау түрі" value="Толық санау"/><Info label="Қойма" value="A қоймасы"/><Info label="Орындаушылар" value="Барлығы"/><Info label="Басталу күні" value="12.05.2024"/></div><div className="inventory-summary"><span>Тауарлар<b>1 256</b></span><span>Саналған<b>{done?246:245}</b></span><span>Сәйкестік<b>98%</b></span></div><button className="role-primary" onClick={()=>setDone(true)}>{done?"Санау жүріп жатыр":"Санауды бастау"}</button></>}</section> }
function WarehouseOrders({ orders, go, onSelect }: { orders: WarehouseOrder[]; go: (screen: Screen) => void; onSelect: (order: WarehouseOrder) => void }) {
  const [filter, setFilter] = useState<OrderStatus | "all" | "delivered">("all");
  const visible = filter === "all" ? orders : filter === "delivered" ? orders.filter((order) => order.delivered) : filter === "shipped" ? orders.filter((order) => order.status === "shipped" && !order.delivered) : filter === "ready" ? orders.filter((order) => order.status === "ready" || order.status === "labeled") : orders.filter((order) => order.status === filter && !order.delivered);
  return <section className="role-screen"><div className="role-heading"><h1>Тапсырыстар</h1><button onClick={() => go("scanner")}>⌕</button></div><p className="role-muted">СӨ өкілдерінен түскен тапсырыстарды қабылдап, жинауды және жеткізу тарихын басқарыңыз.</p><div className="role-tabs warehouse-order-tabs"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Барлығы {orders.length}</button><button className={filter === "new" ? "active" : ""} onClick={() => setFilter("new")}>Қоймаға түсті</button><button className={filter === "picking" ? "active" : ""} onClick={() => setFilter("picking")}>Жинауда</button><button className={filter === "ready" ? "active" : ""} onClick={() => setFilter("ready")}>Дайын</button><button className={filter === "shipped" ? "active" : ""} onClick={() => setFilter("shipped")}>Экспедиторда</button><button className={filter === "delivered" ? "active" : ""} onClick={() => setFilter("delivered")}>Жеткізілді</button></div>{visible.length ? visible.map((order) => <button className="role-list-row" key={order.id} onClick={() => onSelect(order)}><span className="list-icon">♧</span><div><strong>{order.id} · {order.store}</strong><small>{order.address}<br/>{order.deliveredAt || order.createdAt} · {order.items.length} позиция</small></div><div className="role-row-right"><b>{money(order.total)}</b><em className={`status ${order.delivered ? "green" : orderStatusClass[order.status]}`}>{warehouseOrderLabel(order)}</em></div></button>) : <div className="empty">Бұл сүзгіде тапсырыс жоқ</div>}</section>
}

function WarehouseOrderDetail({ order, go, updateOrder }: { order: WarehouseOrder; go: (screen: Screen) => void; updateOrder: (patch: Partial<WarehouseOrder>) => void }) {
  const documentNumber = order.id.replace(/\D/g, "").slice(-6).padStart(6, "0");
  const [sticker, setSticker] = useState(order.sticker ?? `ST-${documentNumber}`);
  const [waybill, setWaybill] = useState(order.waybill ?? `НК-${documentNumber}`);
  const [stickerAttached, setStickerAttached] = useState(order.stickerAttached ?? false);
  const [waybillPlaced, setWaybillPlaced] = useState(order.waybillPlaced ?? false);
  const steps: Array<{ key: OrderStatus; label: string }> = [{ key: "new", label: "Қоймаға түсті" }, { key: "picking", label: "Жинауға кірістім" }, { key: "ready", label: "Жинау аяқталды" }, { key: "labeled", label: "Стикер және накладной" }, { key: "shipped", label: "Жөнелтілді" }];
  const currentIndex = steps.findIndex((step) => step.key === order.status);
  const advance = () => {
    if (order.status === "new") updateOrder({ status: "picking" });
    else if (order.status === "picking") updateOrder({ status: "ready", sticker, waybill });
    else if (order.status === "ready" && stickerAttached && waybillPlaced) updateOrder({ status: "labeled", sticker, waybill, stickerAttached, waybillPlaced });
    else if (order.status === "labeled") updateOrder({ status: "shipped" });
  };
  const actionLabel = order.status === "new" ? "Қабылдадым, жинауға кірістім" : order.status === "picking" ? "Жинау аяқталды — дайын" : order.status === "ready" ? "Стикер және накладной бекіту" : order.status === "labeled" ? "Жөнелтуге беру" : "Тапсырыс аяқталды";
    return <section className="role-screen"><div className="role-heading"><button className="back" onClick={() => go("orders")}>‹</button><h1>{order.id}</h1><button>⌯</button></div><div className="order-detail-head"><div><span className={`status ${orderStatusClass[order.status]}`}>{statusLabel[order.status]}</span><h2>{order.store}</h2><small>{order.address}</small></div><b>{money(order.total)}</b></div><div className="workflow">{steps.map((step, index) => <div className={`workflow-step ${index < currentIndex ? "done" : ""} ${index === currentIndex ? "active" : ""}`} key={step.key}><span>{index < currentIndex ? "✓" : index + 1}</span><div><strong>{step.label}</strong><small>{index === 0 ? "СӨ тапсырысы автоматты түсті" : index === 1 ? "Қоймашы жинауды бастайды" : index === 2 ? "Барлық позиция жиналды" : index === 3 ? "Стикер және накладной қосылады" : "Экспедиторға берілді"}</small></div></div>)}</div><div className="role-section-title"><h3>Тауарлар ({order.items.length})</h3><button onClick={() => go("products")}>Қоймадан көру</button></div><div className="detail-card product-lines">{order.items.map((item) => <span key={item.name}>{item.name}<b>{item.quantity} × {money(item.price)}</b></span>)}<strong>Жалпы сома <b>{money(order.total)}</b></strong></div>{order.status === "ready" && <div className="document-card"><h3>Жөнелтуге дайындау</h3><p>Жиналған қораптың сыртына стикер жапсырып, накладнойды үстіне қойыңыз.</p><label>Стикер нөмірі<input value={sticker} onChange={(event) => setSticker(event.target.value)} placeholder="Мысалы: ST-100047" /></label><label>Накладной нөмірі<input value={waybill} onChange={(event) => setWaybill(event.target.value)} placeholder="Мысалы: НК-100047" /></label><label className="document-check"><input type="checkbox" checked={stickerAttached} onChange={(event) => setStickerAttached(event.target.checked)} /> Стикер жапсырылды</label><label className="document-check"><input type="checkbox" checked={waybillPlaced} onChange={(event) => setWaybillPlaced(event.target.checked)} /> Накладной қойылды</label></div>}{order.status === "labeled" && <div className="document-card success-card"><strong>✓ Құжаттар дайын</strong><span>Стикер: {order.sticker}</span><span>Накладной: {order.waybill}</span></div>}<button className="role-primary" onClick={advance} disabled={order.status === "shipped" || (order.status === "ready" && (!sticker.trim() || !waybill.trim() || !stickerAttached || !waybillPlaced))}>{actionLabel}</button>{order.status === "ready" && (!sticker.trim() || !waybill.trim() || !stickerAttached || !waybillPlaced) && <small className="form-hint">Стикер нөмірін және накладнойды енгізіп, екі құжаттың да қойылғанын белгілеңіз.</small>}</section>
}
function WarehouseLoginAlsat({ onLogin }: { onLogin: () => void }) { return <main className="role-login warehouse-login"><div className="role-login-brand"><span>A</span><b>ALSAT</b><small>ҚОЙМА МЕНЕДЖЕРІ</small></div><h1>Жүйеге кіру</h1><p>Аккаунтыңызға кіріп, қойма жұмысыңызды басқарыңыз</p><label>Телефон нөмірі<input placeholder="⌕ +7 (___) ___-__-__" inputMode="tel"/></label><label>Құпия сөз<input placeholder="••••••••••••" type="password"/></label><div className="login-check"><span>☑　Мені есте сақтау</span><a>Құпия сөзді ұмыттыңыз ба?</a></div><button className="role-primary" onClick={onLogin}>Кіру</button><div className="role-or">немесе</div><button className="role-secondary" onClick={onLogin}>▣　SMS арқылы кіру</button></main> }

function escapePrintText(value: string) { return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character); }

async function printWarehouseDocument(kind: "sticker" | "waybill", order: WarehouseOrder, sticker: string, waybill: string) {
  if (typeof window === "undefined") return;
  const popup = window.open("", "_blank", "width=760,height=900");
  if (!popup) return;
  const qrDataUrl = await QRCode.toDataURL(buildPickupQrValue(sticker, order.remoteId), { width: 360, margin: 1, errorCorrectionLevel: "M", color: { dark: "#102a25", light: "#ffffff" } });
  const safeOrder = escapePrintText(order.id);
  const safeStore = escapePrintText(order.store);
  const safeAddress = escapePrintText(order.address);
  const safeSticker = escapePrintText(sticker);
  const safeWaybill = escapePrintText(waybill);
  const items = order.items.map((item) => `<tr><td>${escapePrintText(item.name)}</td><td>${item.quantity}</td><td>${escapePrintText(money(item.price))}</td></tr>`).join("");
  const content = kind === "sticker"
    ? `<article class="sticker"><div class="brand">ALSAT <small>ҚОЙМА · ЖӨНЕЛТУ СТИКЕРІ</small></div><h1>${safeStore}</h1><img class="qr" src="${qrDataUrl}" alt="${safeSticker} QR"/><strong class="code">${safeSticker}</strong><p>${safeOrder}</p><p>${safeAddress}</p><hr/><b>${order.items.length} позиция · ${escapePrintText(money(order.total))}</b><small class="hint">Экспедитор осы QR кодты сканерлеп қабылдайды</small></article>`
    : `<article class="waybill"><div class="brand">ALSAT <small>WAREHOUSE WAYBILL</small></div><h1>Накладной</h1><div class="meta"><b>${safeWaybill}</b><span>${safeOrder}</span></div><p><b>Клиент:</b> ${safeStore}</p><p><b>Мекенжай:</b> ${safeAddress}</p><table><thead><tr><th>Тауар</th><th>Саны</th><th>Бағасы</th></tr></thead><tbody>${items}</tbody><tfoot><tr><th colSpan="2">Жалпы сома</th><th>${escapePrintText(money(order.total))}</th></tr></tfoot></table><div class="signatures"><span>Қоймашы: __________________</span><span>Экспедитор: ________________</span></div></article>`;
  popup.document.write(`<!doctype html><html lang="kk"><head><meta charset="utf-8"/><title>${kind === "sticker" ? safeSticker : safeWaybill}</title><style>@page{margin:10mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#102a25;margin:0;padding:18px}.brand{font-weight:800;letter-spacing:2px;color:#159345}.brand small{display:block;font-size:9px;letter-spacing:1px;color:#6b7b73;margin-top:4px}.sticker{width:300px;border:2px solid #102a25;border-radius:12px;padding:22px;text-align:center;margin:0 auto}.sticker h1{font-size:22px;margin:20px 0 12px}.sticker .qr{display:block;width:190px;height:190px;margin:0 auto}.sticker p{font-size:11px;margin:7px 0}.sticker .code{display:block;font-size:24px;letter-spacing:1.5px;margin:10px 0 16px}.sticker hr{border:0;border-top:1px solid #cad8cf;margin:18px 0}.sticker .hint{display:block;margin-top:13px;color:#6b7b73;font-size:8px;line-height:1.4}.waybill{max-width:760px;margin:0 auto}.waybill h1{font-size:24px;margin:28px 0 12px}.meta{display:flex;justify-content:space-between;border:1px solid #cad8cf;border-radius:8px;padding:12px;margin-bottom:18px}.meta b{color:#159345}.waybill p{font-size:13px;margin:8px 0}table{width:100%;border-collapse:collapse;margin-top:22px;font-size:12px}th,td{border:1px solid #cad8cf;padding:9px;text-align:left}th:nth-child(2),td:nth-child(2),th:nth-child(3),td:nth-child(3){text-align:right}.signatures{display:flex;justify-content:space-between;margin-top:70px;font-size:11px}@media print{body{padding:0}}</style></head><body>${content}</body></html>`);
  popup.document.close();
  popup.focus();
  popup.onafterprint = () => popup.close();
  window.setTimeout(() => popup.print(), 250);
}

function WarehouseQrPreview({ order, sticker }: { order: WarehouseOrder; sticker: string }) {
  const [source, setSource] = useState("");
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(buildPickupQrValue(sticker, order.remoteId), { width: 260, margin: 1, errorCorrectionLevel: "M", color: { dark: "#102a25", light: "#ffffff" } })
      .then((value: string) => { if (active) setSource(value); })
      .catch(() => { if (active) setSource(""); });
    return () => { active = false; };
  }, [order.remoteId, sticker]);
  return <div className="warehouse-qr-preview">{source ? <img src={source} alt={`${sticker} QR коды`} /> : <span>QR дайындалуда…</span>}<div><small>ҚОРАПҚА ЖАБЫСТЫРЫЛАДЫ</small><strong>{sticker}</strong><p>Экспедитор сканерлегенде қабылдау автоматты расталады.</p></div></div>;
}

function WarehouseDocumentActions({ order, sticker, waybill }: { order: WarehouseOrder; sticker: string; waybill: string }) {
  const buttonStyle = { border: "1px solid #b8dfc0", background: "#effaf1", color: "#159345", borderRadius: 8, padding: "9px 10px", fontSize: 10, cursor: "pointer" } as const;
  return <><WarehouseQrPreview order={order} sticker={sticker}/><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}><button style={buttonStyle} onClick={() => { void printWarehouseDocument("sticker", order, sticker, waybill); }}>QR стикерді басып шығару</button><button style={buttonStyle} onClick={() => { void printWarehouseDocument("waybill", order, sticker, waybill); }}>Накладнойды басып шығару</button></div></>;
}

function WarehouseOrderDetailWithPrint({ order, go, updateOrder }: { order: WarehouseOrder; go: (screen: Screen) => void; updateOrder: (patch: Partial<WarehouseOrder>) => void }) {
  const documentNumber = order.remoteId ? order.remoteId.slice(0, 8).toUpperCase() : order.id.replace(/\D/g, "").slice(-6).padStart(6, "0");
  const sticker = order.sticker ?? `ST-${documentNumber}`;
  const waybill = order.waybill ?? `НК-${documentNumber}`;
  const [stickerAttached, setStickerAttached] = useState(order.stickerAttached ?? false);
  const [waybillPlaced, setWaybillPlaced] = useState(order.waybillPlaced ?? false);
  const steps: Array<{ key: OrderStatus; label: string }> = [{ key: "new", label: "Қоймаға түсті" }, { key: "picking", label: "Жинауға кірістім" }, { key: "ready", label: "Жинау аяқталды" }, { key: "labeled", label: "Стикер және накладной" }, { key: "shipped", label: "Жөнелтілді" }];
  const currentIndex = steps.findIndex((step) => step.key === order.status);
  const advance = () => {
    if (order.status === "new") updateOrder({ status: "picking" });
    else if (order.status === "picking") updateOrder({ status: "ready", sticker, waybill });
    else if (order.status === "ready" && stickerAttached && waybillPlaced) updateOrder({ status: "labeled", sticker, waybill, stickerAttached, waybillPlaced });
    else if (order.status === "labeled") window.alert("Бұл тапсырыс экспедиторға дайын. Күйі экспедитор қораптағы QR кодты сканерлегенде автоматты өзгереді.");
  };
  const actionLabel = order.status === "new" ? "Қабылдадым, жинауға кірістім" : order.status === "picking" ? "Жинау аяқталды — QR дайындау" : order.status === "ready" ? "Стикер және накладной бекіту" : order.status === "labeled" ? "Экспедитордың QR сканерлеуін күту" : "Экспедитор алып кетті";
  return <section className="role-screen">
    <div className="role-heading"><button className="back" onClick={() => go("orders")}>‹</button><h1>{order.id}</h1><button>⌯</button></div>
    <div className="order-detail-head"><div><span className={`status ${orderStatusClass[order.status]}`}>{warehouseOrderLabel(order)}</span><h2>{order.store}</h2><small>{order.address}</small></div><b>{money(order.total)}</b></div>
    <div className="workflow">{steps.map((step, index) => <div className={`workflow-step ${index < currentIndex ? "done" : ""} ${index === currentIndex ? "active" : ""}`} key={step.key}><span>{index < currentIndex ? "✓" : index + 1}</span><div><strong>{step.label}</strong><small>{index === 0 ? "СӨ тапсырысы автоматты түсті" : index === 1 ? "Қоймашы жинауды бастайды" : index === 2 ? "Барлық позиция жиналды" : index === 3 ? "Қорап QR стикерімен дайын" : "Экспедитор QR арқылы қабылдады"}</small></div></div>)}</div>
    <div className="role-section-title"><h3>Тауарлар ({order.items.length})</h3><button onClick={() => go("products")}>Қоймадан көру</button></div>
    <div className="detail-card product-lines">{order.items.map((item) => <span key={item.name}>{item.name}<b>{item.quantity} × {money(item.price)}</b></span>)}<strong>Жалпы сома <b>{money(order.total)}</b></strong></div>
    {order.status === "ready" && <div className="document-card"><h3>QR стикер автоматты дайын</h3><p>Стикерді басып шығарып қорапқа жабыстырыңыз. Накладнойды қораптың үстіне қойыңыз.</p><div className="document-code"><span>Стикер</span><strong>{sticker}</strong></div><div className="document-code"><span>Накладной</span><strong>{waybill}</strong></div><WarehouseDocumentActions order={order} sticker={sticker} waybill={waybill}/><label className="document-check"><input type="checkbox" checked={stickerAttached} onChange={(event) => setStickerAttached(event.target.checked)} /> QR стикер қорапқа жапсырылды</label><label className="document-check"><input type="checkbox" checked={waybillPlaced} onChange={(event) => setWaybillPlaced(event.target.checked)} /> Накладной қораптың үстіне қойылды</label></div>}
    {order.status === "labeled" && <div className="document-card success-card"><strong>✓ Қорап экспедиторға дайын</strong><span>QR стикер: {sticker}</span><span>Накладной: {waybill}</span><WarehouseDocumentActions order={order} sticker={sticker} waybill={waybill}/><div className="handoff-wait-note"><b>⌁</b><span><strong>Экспедиторды күту</strong><small>Күй тек QR сканерленгенде өзгереді.</small></span></div></div>}
    {order.status === "shipped" && !order.delivered && <div className="handoff-complete"><span>✓</span><div><strong>Экспедитор тапсырысты қабылдады</strong><small>Қораптағы QR код сканерленіп, алып кету расталды.</small></div></div>}
    {order.delivered && <div className="handoff-complete delivered-card"><span>✓</span><div><strong>Тапсырыс клиентке жеткізілді</strong><small>{order.deliveredAt || "Жеткізу уақыты сақталды"}{order.recipientName ? ` · Қабылдаған: ${order.recipientName}` : ""}</small></div></div>}
    <button className="role-primary" onClick={advance} disabled={order.status === "labeled" || order.status === "shipped" || (order.status === "ready" && (!stickerAttached || !waybillPlaced))}>{actionLabel}</button>
    {order.status === "ready" && (!stickerAttached || !waybillPlaced) && <small className="form-hint">Екі құжатты басып шығарып, физикалық түрде бекіткен соң белгілеңіз.</small>}
  </section>;
}

function WarehouseNotifications({ go }: { go: (screen: Screen) => void }) { const [read,setRead]=useState<number[]>([]);const [unreadOnly,setUnreadOnly]=useState(false);const items=["Қалдық аз қалды","Тауар қабылданды","Санау аяқталды","Тапсырыс дайын"];return <section className="role-screen"><div className="role-heading"><h1>Хабарламалар</h1><button onClick={()=>setUnreadOnly((value)=>!value)}>{unreadOnly?"Барлығы":"Оқылмаған"}</button></div>{items.map((name,index)=>(!unreadOnly||!read.includes(index))&&<button className="notification-row" onClick={()=>setRead((current)=>[...current,index])} key={name}><span className={`notification-icon n${index}`}>●</span><div><strong>{name}</strong><small>{index===0?"KRAUSZ Проектор 100W қоймада аз қалды":"Операция сәтті сақталды"}</small><em>12.05.2024 · 10:30</em></div>{!read.includes(index)&&<b>•</b>}</button>)}<button className="role-primary" onClick={()=>{setRead(items.map((_,index)=>index));go("dashboard")}}>Барлығын оқу</button></section> }
function WarehouseReports({ go, orders }: { go: (screen: Screen) => void; orders: WarehouseOrder[] }) { const [selected,setSelected]=useState(""); const delivered=orders.filter((order)=>order.delivered); return <section className="role-screen"><div className="role-heading"><h1>Есеп</h1><button onClick={()=>window.print()}>⎙</button></div><div className="report-summary"><div><span>Барлық тапсырыс</span><strong>{orders.length}</strong></div><div><span>Жеткізілді</span><strong>{delivered.length}</strong></div><div><span>Қоймада</span><strong>{orders.filter((order)=>!order.delivered && ["new","picking","ready","labeled"].includes(order.status)).length}</strong></div></div>{delivered.length > 0 && <div className="report-delivered"><div className="role-section-title"><h3>Жеткізілген тапсырыстар</h3><span>{delivered.length}</span></div>{delivered.slice(0,5).map((order)=><div className="report-delivered-row" key={order.id}><div><strong>{order.id} · {order.store}</strong><small>{order.deliveredAt || "Жеткізу уақыты сақталуда"}</small></div><b>{money(order.total)}</b></div>)}</div>}{["Қалдық есебі","Қозғалыс есебі","Тауарлардың қозғалысы","Қабылдау есебі","Шығару есебі","Қалдық бойынша ABC талдау","Қоймадағы тұрған тауарлар"].map((name)=><button className="setting-row role-setting" key={name} onClick={()=>setSelected(name)}>▣　{name}<b>›</b></button>)}{selected&&<div className="action-panel"><strong>{selected}</strong><p>Есеп дайын. Экраннан қарауға немесе басып шығаруға болады.</p><div className="store-form-actions"><button onClick={()=>go("stock")}>Деректерді ашу</button><button onClick={()=>window.print()}>Басып шығару</button></div></div>}</section> }
function WarehouseProfile({ go }: { go: (screen: Screen) => void }) { const [setting,setSetting]=useState("");return <section className="role-screen"><div className="role-heading"><button onClick={()=>go("more")}>‹</button><h1>Профиль</h1><span/></div><div className="profile-card role-profile-card"><span className="role-avatar large">НӘ</span><h1>Нұрлан Әбілрахманов</h1><p>Қойма менеджері</p><strong>n.abdirakhmanov@alsat.kz</strong></div>{["Профильді өңдеу","Қоймалар","Пайдаланушылар","Құрылғы баптаулары","Тіл · Қазақша","Қолдау қызметі"].map((item)=><button className="setting-row role-setting" key={item} onClick={()=>setSetting(item)}>{item}<b>›</b></button>)}{setting&&<div className="action-panel"><strong>{setting}</strong><p>{setting==="Қолдау қызметі"?"support@alsat.kz · +7 700 123-45-67":"Бөлім ашылды. Өзгерістер осы құрылғыда сақталады."}</p><button onClick={()=>setSetting("")}>Дайын</button></div>}<button className="logout" onClick={()=>go("dashboard")}>⇥　Шығу</button></section> }
function WarehouseScanner({ go }: { go: (screen: Screen) => void }) { const [tab,setTab]=useState("manual");const [code,setCode]=useState("");const [torch,setTorch]=useState(false);const [gallery,setGallery]=useState(false);return <section className="role-screen scanner-screen"><div className="role-heading"><button className="back" onClick={()=>go("products")}>‹</button><h1>Штрихкод сканері</h1><button onClick={()=>setCode("")}>×</button></div><div className={`scanner-box ${torch?"torch-on":""}`}><div className="scan-corners">▣</div><p>{torch?"Фонарик қосылды":"Штрихкодты рамкаға орналастырыңыз"}</p></div><div className="role-tabs"><button className={tab==="history"?"active":""} onClick={()=>setTab("history")}>Тарих</button><button className={tab==="manual"?"active":""} onClick={()=>setTab("manual")}>Қолмен енгізу</button></div>{tab==="history"?<div className="detail-card"><Info label="4870123456789" value="KRAUSZ Шам"/><Info label="4870123456790" value="KRAUSZ Панель"/></div>:<input className="role-input" value={code} onChange={(event)=>setCode(event.target.value)} placeholder="Штрихкод енгізу　⌕"/>}<div className="scanner-actions"><button className={torch?"active":""} onClick={()=>setTorch((value)=>!value)}>♨<small>Фонарик</small></button><button className={gallery?"active":""} onClick={()=>setGallery((value)=>!value)}>▧<small>Галерея</small></button></div>{gallery&&<div className="action-panel">Галереядан штрихкод суретін таңдау режимі қосылды.</div>}<button className="role-primary" onClick={()=>go("product")} disabled={tab==="manual"&&!code.trim()}>Тауарды ашу</button></section> }
function Transfer({ go }: { go: (screen: Screen) => void }) { const [tab,setTab]=useState("new");const [saved,setSaved]=useState(false);return <section className="role-screen"><div className="role-heading"><button className="back" onClick={()=>go("more")}>‹</button><h1>Трансфер</h1><button onClick={()=>window.print()}>▣</button></div><div className="role-tabs"><button className={tab==="new"?"active":""} onClick={()=>setTab("new")}>Жаңа трансфер</button><button className={tab==="history"?"active":""} onClick={()=>setTab("history")}>Тарих</button></div>{tab==="history"?<div className="detail-card"><Info label="TR-10024" value="A-01 → B-02 · 100 дана"/><Info label="TR-10023" value="B-01 → A-03 · 45 дана"/></div>:<><div className="detail-card operation-form"><Info label="Көлік" value="A-01-02-03　›"/><Info label="Қойма" value="A-02-04-01　›"/><Info label="Тауар" value={products[0].name}/><Info label="Саны" value="100 дана"/></div>{saved&&<div className="action-panel success">✓ Трансфер сақталды</div>}<button className="role-primary" onClick={()=>setSaved(true)}>Трансферді сақтау</button></>}</section> }
function ReturnGoods({ go }: { go: (screen: Screen) => void }) { const [tab,setTab]=useState("new");const [saved,setSaved]=useState(false);return <section className="role-screen"><div className="role-heading"><button className="back" onClick={()=>go("more")}>‹</button><h1>Қайтарым (Return)</h1><button onClick={()=>window.print()}>▣</button></div><div className="role-tabs"><button className={tab==="new"?"active":""} onClick={()=>setTab("new")}>Жаңа қайтарым</button><button className={tab==="history"?"active":""} onClick={()=>setTab("history")}>Тарих</button></div>{tab==="history"?<div className="detail-card"><Info label="RTN10005" value="Строймаг · 10 дана"/><Info label="RTN10004" value="ЭлектроДом · 4 дана"/></div>:<><div className="detail-card operation-form"><Info label="Құжат түрі" value="Қайтарым (RTN)"/><Info label="Алушы" value="Строймаг"/><Info label="Құжат нөмірі" value="RTN10005"/><Info label="Құжат күні" value="12.05.2024"/><Info label="Тауарлар" value="1 тауар · 10 дана"/></div>{saved&&<div className="action-panel success">✓ Қайтарым сақталды</div>}<button className="role-primary" onClick={()=>setSaved(true)}>Қайтарымды сақтау</button></>}</section> }
function Offline({ go }: { go: (screen: Screen) => void }) { return <section className="role-screen offline-screen"><span className="offline-symbol">⌁</span><h1>Интернет байланысы жоқ</h1><p>Кейбір функциялар істемейді. Деректер байланыс қалпына келгенде синхрондалады.</p><button className="role-primary" onClick={() => go("dashboard")}>Қайта қосылу</button></section> }
function WarehouseMore({ go }: { go: (screen: Screen) => void }) { return <section className="role-screen"><h1>Көбірек</h1><button className="setting-row role-setting" onClick={() => go("profile")}>⚙　Профиль және баптаулар <b>›</b></button><button className="setting-row role-setting" onClick={() => go("reports")}>▥　Есеп <b>›</b></button><button className="setting-row role-setting" onClick={() => go("scanner")}>⌁　Штрихкод сканері <b>›</b></button><button className="setting-row role-setting" onClick={() => go("offline")}>⌁　Offline режимі <b>›</b></button><button className="setting-row role-setting" onClick={() => go("notifications")}>♧　Хабарламалар <b>›</b></button></section> }
function Info({ label, value }: { label: string; value: string }) { return <div className="info-line"><span>{label}</span><b>{value}</b></div> }

