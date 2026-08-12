"use client";

import { useEffect, useMemo, useState } from "react";
import RouteMap from "../../components/RouteMap";
import { queueOfflineAction } from "../../lib/offline-queue";
import { supabase } from "../../lib/supabase";
import { flushOrderQueue } from "../../lib/order-sync";

type Screen = "dashboard" | "clients" | "client" | "catalog" | "order" | "orders" | "detail" | "route" | "visit" | "reports" | "profile" | "more";
type Product = { id: number; name: string; subtitle: string; price: number; stock: number };
type OrderRecord = { id: string; client: string; total: number; status: string; createdAt: string; items: Product[] };
type SyncState = "idle" | "syncing" | "synced" | "offline";

const products: Product[] = [
  { id: 1, name: "KRAUSZ Шам A60 12W E27", subtitle: "6500K", price: 650, stock: 1250 },
  { id: 2, name: "KRAUSZ Шам A60 15W E27", subtitle: "6500K", price: 720, stock: 980 },
  { id: 3, name: "KRAUSZ Проектор 100W", subtitle: "6500K IP65", price: 8500, stock: 48 },
  { id: 4, name: "KRAUSZ Панель LED 36W", subtitle: "595x595 6500K", price: 4200, stock: 76 },
  { id: 5, name: "KRAUSZ Линейный светильник 36W", subtitle: "6500K", price: 5200, stock: 35 },
];
const clients = ["Строймаг", "ЭлектроДом", "Техносвет", "Светлый дом", "1000 Мелочей", "ПромЭлектро"];
const money = (value: number) => `${value.toLocaleString("kk-KZ")} ₸`;
const initialOrders: OrderRecord[] = [
  { id: "№10045", client: "Строймаг", total: 245000, status: "Бекітілген", createdAt: "12.05.2024", items: products.slice(0, 3) },
  { id: "№10044", client: "ЭлектроДом", total: 185000, status: "Күтуде", createdAt: "12.05.2024", items: products.slice(0, 2) },
  { id: "№10043", client: "Техносвет", total: 315000, status: "Жеткізілді", createdAt: "11.05.2024", items: products.slice(1, 4) },
  { id: "№10042", client: "Светлый дом", total: 70000, status: "Қайтарылды", createdAt: "10.05.2024", items: products.slice(2, 4) },
];

export default function AgentApp() {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [cart, setCart] = useState<Product[]>([products[0], products[2], products[3]]);
  const [selectedClient, setSelectedClient] = useState("Строймаг");
  const [orderSaved, setOrderSaved] = useState(false);
  const [orders, setOrders] = useState<OrderRecord[]>(initialOrders);
  const [lastOrder, setLastOrder] = useState<OrderRecord | null>(null);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const total = useMemo(() => cart.reduce((sum, item) => sum + item.price, 0), [cart]);
  useEffect(() => {
    const saved = localStorage.getItem("alsat-agent-orders");
    if (saved) {
      try { setOrders(JSON.parse(saved)); } catch { localStorage.removeItem("alsat-agent-orders"); }
    }
  }, []);
  useEffect(() => {
    let mounted = true;
    const flush = async () => {
      if (!mounted) return;
      setSyncState("syncing");
      const result = await flushOrderQueue();
      if (mounted) setSyncState(result.remaining ? "offline" : result.synced ? "synced" : "idle");
    };
    void flush();
    window.addEventListener("online", flush);
    return () => { mounted = false; window.removeEventListener("online", flush); };
  }, []);
  const go = (next: Screen) => setScreen(next);
  const add = (product: Product) => setCart((current) => [...current, product]);
  const remove = (id: number) => setCart((current) => { const index = current.findIndex((item) => item.id === id); return index < 0 ? current : [...current.slice(0, index), ...current.slice(index + 1)]; });
  const saveOrder = () => {
    if (!cart.length) return;
    const order: OrderRecord = { id: `№${10045 + orders.length + 1}`, client: selectedClient, total: Math.round(total * .95), status: "Жаңа", createdAt: new Date().toLocaleDateString("kk-KZ"), items: cart };
    const next = [order, ...orders];
    setOrders(next);
    localStorage.setItem("alsat-agent-orders", JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("alsat-agent-order-saved", { detail: order }));
    queueOfflineAction("order", order);
    setLastOrder(order);
    setSyncState("syncing");
    void flushOrderQueue().then((result) => { setSyncState(result.remaining ? "offline" : "synced"); window.dispatchEvent(new CustomEvent("alsat-agent-order-synced")); });
    setOrderSaved(true);
    setCart([]);
    go("detail");
  };

  return <main className="qmart-suite">
    <header className="suite-header"><button className="icon-button" onClick={() => go("more")}>☰</button><div className="suite-brand"><b>Qmart</b><small>САУДА ӨКІЛІ</small></div><button className="icon-button">♧</button></header>
    {screen === "dashboard" && <Dashboard go={go} syncState={syncState} />}
    {screen === "clients" && <Clients go={go} onSelect={(name) => { setSelectedClient(name); go("client"); }} />}
    {screen === "client" && <ClientCard name={selectedClient} go={go} />}
    {screen === "catalog" && <Catalog products={products} cart={cart} add={add} go={go} />}
    {screen === "order" && <OrderForm products={products} cart={cart} total={total} client={selectedClient} remove={remove} go={go} onSave={saveOrder} />}
    {screen === "orders" && <Orders orders={orders} go={go} onSelect={(order) => { setSelectedClient(order.client); setOrderSaved(order.status !== "Жаңа"); setLastOrder(order); setCart(order.items); go("detail"); }} />}
    {screen === "detail" && <OrderDetail order={lastOrder} total={total} client={selectedClient} saved={orderSaved} go={go} />}
    {screen === "route" && <RouteScreen go={go} onClient={(name) => { setSelectedClient(name); go("visit"); }} />}
    {screen === "visit" && <VisitScreen client={selectedClient} go={go} />}
    {screen === "reports" && <Reports go={go} />}
    {screen === "profile" && <Profile go={go} />}
    {screen === "more" && <More go={go} />}
    <nav className="suite-bottom"><button className={screen === "dashboard" ? "active" : ""} onClick={() => go("dashboard")}>⌂<small>Басты</small></button><button className={screen === "clients" || screen === "client" ? "active" : ""} onClick={() => go("clients")}>♙<small>Клиенттер</small></button><button className={screen === "orders" || screen === "order" || screen === "detail" ? "active" : ""} onClick={() => go("orders")}>▤<small>Тапсырыстар</small></button><button className={screen === "reports" ? "active" : ""} onClick={() => go("reports")}>▥<small>Есеп</small></button><button className={screen === "more" || screen === "profile" ? "active" : ""} onClick={() => go("more")}>•••<small>Көбірек</small></button></nav>
  </main>;
}

function Dashboard({ go, syncState }: { go: (screen: Screen) => void; syncState: SyncState }) {
  const syncLabel = syncState === "syncing" ? "Синхрондалып жатыр" : syncState === "synced" ? "Supabase-пен синхрондалды" : syncState === "offline" ? "Offline кезегі" : "Дерек дайын";
  return <section className="suite-screen"><div className="profile-strip"><span className="person">А</span><div><strong>Нұрлан Әбілрахманов</strong><small>Сауда өкілі</small></div><span className={`sync-dot ${syncState}`} title={syncLabel}>●</span></div><div className={`sync-status ${syncState}`}>{syncLabel}</div><section className="metric-card"><small>Бүгінгі көрсеткіштер</small><p>12 мамыр, жексенбі</p><div className="metrics"><span>Тапсырыс<strong>1 245 000 ₸</strong><em>+12%</em></span><span>Клиенттер<strong>24</strong><em>+3</em></span><span>Жаңа клиент<strong>3</strong><em>+3</em></span><span>Орташа чек<strong>51 875 ₸</strong><em>›</em></span></div></section><SectionTitle title="Жылдам әрекеттер"/><div className="quick-actions"><button onClick={() => go("order")}>▣<span>Тапсырыс қосу</span></button><button onClick={() => go("clients")}>♙<span>Клиент қосу</span></button><button onClick={() => go("catalog")}>▦<span>Тауарлар</span></button><button onClick={() => go("route")}>⌖<span>Маршрут</span></button><button onClick={() => go("reports")}>▥<span>Есептер</span></button><button onClick={() => go("catalog")}>▧<span>Қойма қалдығы</span></button></div><SectionTitle title="Соңғы тапсырыстар" action="Барлығын көру ›" onClick={() => go("orders")}/><OrderMini number="№10045" name="Строймаг" amount="245 000 ₸" status="Жаңа тапсырыс"/><OrderMini number="№10044" name="ЭлектроДом" amount="185 000 ₸" status="Жеткізуге дайын"/><OrderMini number="№10043" name="Техносвет" amount="315 000 ₸" status="Жеткізілді"/></section>
}
function SectionTitle({ title, action, onClick }: { title: string; action?: string; onClick?: () => void }) { return <div className="section-title"><h3>{title}</h3>{action && <button onClick={onClick}>{action}</button>}</div> }
function OrderMini({ number, name, amount, status }: { number: string; name: string; amount: string; status: string }) { return <div className="order-mini"><span>▣</span><div><strong>{number} – {name}</strong><small>12.05.2024 · <i>{status}</i></small></div><b>{amount}</b></div> }
function Clients({ go, onSelect }: { go: (screen: Screen) => void; onSelect: (name: string) => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const filtered = clients.filter((client, index) => client.toLowerCase().includes(query.toLowerCase()) && (filter !== "new" || index > 3));
  return <section className="suite-screen"><div className="screen-heading"><div><p className="overline">САТУ ӘКІЛІ</p><h1>Клиенттер</h1></div><button className="round-button" onClick={() => setQuery("")}>+</button></div><input className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="⌕  Іздеу"/><div className="filters"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Барлығы 128</button><button className={filter === "active" ? "active" : ""} onClick={() => setFilter("active")}>Белсенді 98</button><button className={filter === "new" ? "active" : ""} onClick={() => setFilter("new")}>Жаңа 12</button></div>{filtered.length ? filtered.map((client) => { const index = clients.indexOf(client); return <button className="client-row" key={client} onClick={() => onSelect(client)}><span className="client-icon">♧</span><div><strong>{client}</strong><small>Алматы қ., {index % 2 ? "Төле би 215" : "Райымбек 348"}<br/>{[120000,85000,95000,70000,60000,55000][index].toLocaleString("kk-KZ")} ₸</small></div><div className="client-right"><b>{[120,85,95,70,60,55][index]}.000 ₸</b><em>Белсенді</em></div></button>; }) : <div className="empty">Клиент табылмады</div>}</section>
}
function ClientCard({ name, go }: { name: string; go: (screen: Screen) => void }) { return <section className="suite-screen"><button className="back-link" onClick={() => go("clients")}>‹ Клиенттер</button><div className="client-card-head"><div><span className="tag">Белсенді клиент</span><h1>{name}</h1><small>ЖШС · Алматы қ., Райымбек 348<br/>+7 777 123 45 67<br/>Жауапты: Нұрлан Ә.</small></div><button className="icon-button dark">✎</button></div><div className="client-actions"><button onClick={() => go("order")}>▣<small>Тапсырыс</small></button><button>⌕<small>Қоңырау</small></button><button onClick={() => go("route")}>⌖<small>Маршрут</small></button><button onClick={() => go("more")}>•••<small>Көбірек</small></button></div><div className="tabs"><button className="active">Ақпарат</button><button>Тапсырыстар</button><button>Төлемдер</button><button>Ескертпелер</button></div><div className="info-card"><InfoRow label="Борышы" value="120 000 ₸"/><InfoRow label="Жалпы сатып алу" value="5 450 000 ₸"/><InfoRow label="Соңғы тапсырыс" value="12.05.2024"/><InfoRow label="Төлем түрі" value="Несие (14 күн)"/><InfoRow label="Жеңілдік" value="5%"/><InfoRow label="Лимит" value="1 000 000 ₸"/></div><div className="info-card"><strong>Байланыс тұлға</strong><InfoRow label="Алексей · Директор" value="+7 777 987 65 43"/><strong>Мекенжай</strong><InfoRow label="Негізгі" value="Алматы қ., Райымбек 348"/></div></section> }
function InfoRow({ label, value }: { label: string; value: string }) { return <div className="info-row"><span>{label}</span><b>{value}</b></div> }
function Catalog({ products, cart, add, go }: { products: Product[]; cart: Product[]; add: (product: Product) => void; go: (screen: Screen) => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const filtered = products.filter((product) => {
    const matchesQuery = `${product.name} ${product.subtitle}`.toLowerCase().includes(query.toLowerCase());
    const haystack = `${product.name} ${product.subtitle}`.toLowerCase();
    const matchesFilter = filter === "all" || (filter === "lamp" && haystack.includes("шам")) || (filter === "projector" && haystack.includes("проектор")) || (filter === "panel" && haystack.includes("панель"));
    return matchesQuery && matchesFilter;
  });
  return <section className="suite-screen"><div className="screen-heading"><div><button className="back-link" onClick={() => go("dashboard")}>‹ Басты бет</button><h1>Тауарлар</h1></div><button className="cart-button" onClick={() => go("order")}>🛒<i>{cart.length}</i></button></div><input className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="⌕  Тауар іздеу"/><div className="filters"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Барлығы</button><button className={filter === "lamp" ? "active" : ""} onClick={() => setFilter("lamp")}>Шамдар</button><button className={filter === "projector" ? "active" : ""} onClick={() => setFilter("projector")}>Проекторлар</button><button className={filter === "panel" ? "active" : ""} onClick={() => setFilter("panel")}>Панельдер</button></div>{filtered.length ? filtered.map(product => <div className="product-row" key={product.id}><span className="product-icon">◌</span><div><strong>{product.name}</strong><small>{product.subtitle}</small><b>{money(product.price)}</b><em>Қоймада: {product.stock} дана</em></div><button onClick={() => add(product)}>+</button></div>) : <div className="empty">Тауар табылмады</div>}</section>
}
function OrderForm({ products, cart, total, client, remove, go, onSave }: { products: Product[]; cart: Product[]; total: number; client: string; remove: (id: number) => void; go: (screen: Screen) => void; onSave: () => void }) { return <section className="suite-screen"><button className="back-link" onClick={() => go("catalog")}>‹ Тауарлар</button><div className="screen-heading"><h1>Тапсырыс жасау</h1><span>{cart.length} тауар</span></div><button className="selected-client" onClick={() => go("clients")}><div><strong>{client}</strong><small>Борышы: 120 000 ₸</small></div><b>›</b></button><input className="search" placeholder="⌕  Тауар іздеу"/>{cart.map(product => <div className="cart-row" key={product.id}><span className="product-icon">◌</span><div><strong>{product.name}</strong><small>{product.subtitle}</small></div><div className="quantity"><button onClick={() => remove(product.id)}>−</button><b>1</b><button>+</button><strong>{money(product.price)}</strong></div></div>)}<div className="order-summary"><InfoRow label={`Тауарлар (${cart.length})`} value={money(total)}/><InfoRow label="Жеңілдік (5%)" value={`- ${money(Math.round(total * .05))}`}/><InfoRow label="Жалпы сома" value={money(Math.round(total * .95))}/></div><button className="save-order" onClick={onSave}>Тапсырысты сақтау</button></section> }
function Orders({ orders, go, onSelect }: { orders: OrderRecord[]; go: (screen: Screen) => void; onSelect: (order: OrderRecord) => void }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? orders : orders.filter((order) => order.status === filter);
  const statusClass = (status: string) => status === "Бекітілген" || status === "Жаңа" ? "green" : status === "Жеткізілді" ? "blue" : "yellow";
  return <section className="suite-screen"><div className="screen-heading"><h1>Тапсырыстар</h1><button className="cart-button" onClick={() => go("order")}>＋</button></div><div className="filters"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Барлығы</button><button className={filter === "Жаңа" ? "active" : ""} onClick={() => setFilter("Жаңа")}>Күтуде</button><button className={filter === "Бекітілген" ? "active" : ""} onClick={() => setFilter("Бекітілген")}>Бекітілген</button><button className={filter === "Жеткізілді" ? "active" : ""} onClick={() => setFilter("Жеткізілді")}>Жеткізілді</button></div>{filtered.length ? filtered.map((order) => <button className="order-list-row" key={order.id} onClick={() => onSelect(order)}><span className="client-icon">▣</span><div><strong>{order.id} · {order.client}</strong><small>{order.createdAt} · {order.items.length} тауар</small></div><div><b>{money(order.total)}</b><em className={statusClass(order.status)}>{order.status}</em></div></button>) : <div className="empty">Бұл сүзгіде тапсырыс жоқ</div>}</section>
}
function OrderDetail({ order, total, client, saved, go }: { order: OrderRecord | null; total: number; client: string; saved: boolean; go: (screen: Screen) => void }) {
  const gross = order ? Math.round(order.total / .95) : (total || 44500);
  const items = order?.items ?? products.slice(0, 3);
  return <section className="suite-screen"><button className="back-link" onClick={() => go("orders")}>‹ Тапсырыстар</button><div className="screen-heading"><h1>Тапсырыс {order?.id ?? "№10045"}</h1><button className="icon-button dark">⎙</button></div><span className="status-pill green">{order?.status ?? (saved ? "Бекітілген" : "Жаңа")}</span><div className="info-card"><strong>{order?.client ?? client}</strong><small>Алматы қ., Райымбек 348<br/>+7 777 123 45 67</small></div><div className="info-card"><InfoRow label="Құру уақыты" value={order?.createdAt ?? "12.05.2024 10:30"}/><InfoRow label="Төлем түрі" value="Несие (14 күн)"/><InfoRow label="Жеткізу күні" value="15.05.2024"/><InfoRow label="Жеңілдік" value="5%"/></div><SectionTitle title="Тауарлар"/><div className="info-card">{items.map((item) => <InfoRow key={item.id} label={item.name} value={money(item.price)}/>)}<InfoRow label={`Тауарлар (${items.length})`} value={money(gross)}/><InfoRow label="Жеңілдік (5%)" value={`- ${money(Math.round(gross * .05))}`}/><InfoRow label="Жалпы сома" value={money(order?.total ?? Math.round(gross * .95))}/></div><button className="save-order" onClick={() => go("orders")}>Төлемді белгілеу</button></section>
}
function RouteScreen({ go, onClient }: { go: (screen: Screen) => void; onClient: (name: string) => void }) { const stops=[{name:"Строймаг",coordinates:[76.8897,43.2383] as [number,number],status:"Бітірілді"},{name:"ЭлектроДом",coordinates:[76.912,43.256] as [number,number],status:"Бітірілді"},{name:"Техносвет",coordinates:[76.905,43.225] as [number,number],status:"Бара жатыр"},{name:"Светлый дом",coordinates:[76.87,43.245] as [number,number],status:"Келесі"}]; return <section className="suite-screen"><div className="screen-heading"><div><button className="back-link" onClick={() => go("dashboard")}>‹ Басты бет</button><h1>Маршрут</h1></div><button className="icon-button dark">▣</button></div><div className="route-day">12 мамыр, жексенбі　›</div><div className="route-stat-grid"><span>Клиенттер<strong>12</strong></span><span>Бару керек<strong>8</strong></span><span>Бітірілді<strong>4</strong></span></div><RouteMap stops={stops}/>{stops.map((stop, i) => <button className="route-stop" key={stop.name} onClick={() => onClient(stop.name)}><span className={i < 2 ? "done" : ""}>{i + 1}</span><div><strong>{stop.name}</strong><small>{`${9 + i}:00 – ${9 + i}:30`} · Алматы қ.</small></div><em>{stop.status}</em></button>)}<button className="save-order">Маршрутты бастау</button></section> }
function VisitScreen({ client, go }: { client: string; go: (screen: Screen) => void }) { return <section className="suite-screen"><button className="back-link" onClick={() => go("route")}>‹ Маршрут</button><div className="screen-heading"><h1>{client}</h1><span>1 / 8</span></div><div className="tabs"><button className="active">Ақпарат</button><button>Тапсырыс</button><button>Тарих</button><button>Ескертпе</button></div><div className="info-card"><InfoRow label="Борышы" value="120 000 ₸"/><InfoRow label="Соңғы тапсырыс" value="12.05.2024"/><InfoRow label="Жалпы сатып алу" value="5 450 000 ₸"/><InfoRow label="Жеңілдік" value="5%"/></div><SectionTitle title="Бүгінгі әрекет"/><div className="checklist"><label>◉ Тапсырыс алу</label><label>◉ Тауар үлгісін көрсету</label><label>◉ Төлемді тексеру</label><label>◉ Сөре фотосуреті</label></div><button className="save-order" onClick={() => go("order")}>Тапсырыс қосу</button></section> }
function Reports({ go }: { go: (screen: Screen) => void }) { return <section className="suite-screen"><div className="screen-heading"><h1>Есеп</h1><button className="period">Бұл ай⌄</button></div><div className="report-hero"><small>Жалпы сома</small><strong>18 450 000 ₸</strong><p>+18% өткен аймен салыстырғанда</p><div className="chart">▁▂▃▅▆▇▆▅▇▇▆▇</div></div><div className="report-cards"><div><small>Тапсырыстар</small><strong>245</strong><em>+15%</em></div><div><small>Орташа чек</small><strong>75 306 ₸</strong><em>+8%</em></div><div><small>Жаңа клиенттер</small><strong>18</strong><em>+5%</em></div><div><small>Қайтарым</small><strong>2.5%</strong><em className="negative">−0.5%</em></div></div><SectionTitle title="Топ тауарлар" action="Барлығы ›"/><div className="product-row compact"><span className="product-icon">◌</span><div><strong>KRAUSZ Шам A60 12W E27</strong><small>Сатылды: 1 250 дана</small></div><b>8 125 000 ₸</b></div></section> }
function Profile({ go }: { go: (screen: Screen) => void }) {
  async function logout() { if (supabase) await supabase.auth.signOut(); window.location.href = "/agent-login"; }
  return <section className="suite-screen"><button className="icon-button dark" onClick={() => go("more")}>⚙</button><div className="profile-card"><span className="person big">А</span><h1>Нұрлан Әбілрахманов</h1><p>Сауда өкілі</p><strong>+7 777 123 45 67</strong></div>{["Жеке ақпарат", "Құпия сөзді өзгерту", "Хабарлама баптаулары", "Тіл　　　　　　　　 Қазақша", "Қолдау қызметі", "Қосымша туралы"].map(item => <button className="setting-row" key={item}>{item}<b>›</b></button>)}<button className="logout" onClick={logout}>⇥　Шығу</button></section>
}
function More({ go }: { go: (screen: Screen) => void }) { return <section className="suite-screen"><h1>Көбірек</h1><button className="setting-row" onClick={() => go("profile")}>⚙　Профиль және баптаулар <b>›</b></button><button className="setting-row" onClick={() => go("route")}>⌖　Маршрут және сапарлар <b>›</b></button><button className="setting-row" onClick={() => go("reports")}>▥　Комиссия және мақсаттар <b>›</b></button><button className="setting-row">◉　Хабарлама және қолдау <b>›</b></button></section> }
