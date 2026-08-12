"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import RouteMap from "../../components/RouteMap";
import LocationPicker, { LocationValue } from "../../components/LocationPicker";
import { queueOfflineAction } from "../../lib/offline-queue";
import { supabase } from "../../lib/supabase";
import { flushOrderQueue } from "../../lib/order-sync";

type Screen = "dashboard" | "clients" | "new-store" | "client" | "catalog" | "order" | "orders" | "detail" | "route" | "visit" | "reports" | "profile" | "notifications" | "more";
type Product = { id: number; name: string; subtitle: string; price: number; stock: number };
type OrderRecord = { id: string; client: string; total: number; status: string; createdAt: string; items: Product[] };
type AgentStore = { name: string; address: string; contact: string; phone: string; latitude?: number; longitude?: number };
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
  const [storeNames, setStoreNames] = useState<string[]>(clients);
  const [storeDetails, setStoreDetails] = useState<AgentStore[]>([]);
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
    const savedStores = localStorage.getItem("alsat-agent-stores");
    if (savedStores) {
      try { setStoreNames(JSON.parse(savedStores)); } catch { localStorage.removeItem("alsat-agent-stores"); }
    }
    const savedDetails = localStorage.getItem("alsat-agent-store-details");
    if (savedDetails) {
      try { setStoreDetails(JSON.parse(savedDetails)); } catch { localStorage.removeItem("alsat-agent-store-details"); }
    }
    const companyId = localStorage.getItem("alsat-company-id");
    if (supabase && companyId) {
      void supabase.from("stores").select("name,address,contact_name,phone,latitude,longitude").eq("company_id", companyId).then(({ data }) => {
        if (!data?.length) return;
        const remoteStores: AgentStore[] = data.map((store) => ({ name: store.name, address: store.address || "", contact: store.contact_name || "", phone: store.phone || "", latitude: store.latitude ?? undefined, longitude: store.longitude ?? undefined }));
        setStoreDetails((current) => [...remoteStores, ...current.filter((local) => !remoteStores.some((remote) => remote.name.toLowerCase() === local.name.toLowerCase()))]);
        setStoreNames((current) => [...remoteStores.map((store) => store.name), ...current.filter((name) => !remoteStores.some((store) => store.name.toLowerCase() === name.toLowerCase()))]);
      });
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
  const addStore = async (store: AgentStore) => {
    const next = [store.name, ...storeNames.filter((name) => name.toLowerCase() !== store.name.toLowerCase())];
    const nextDetails = [store, ...storeDetails.filter((item) => item.name.toLowerCase() !== store.name.toLowerCase())];
    setStoreNames(next);
    setStoreDetails(nextDetails);
    localStorage.setItem("alsat-agent-stores", JSON.stringify(next));
    localStorage.setItem("alsat-agent-store-details", JSON.stringify(nextDetails));
    const companyId = localStorage.getItem("alsat-company-id");
    if (supabase && companyId) {
      await supabase.from("stores").insert({ company_id: companyId, name: store.name, address: store.address, contact_name: store.contact, phone: store.phone, latitude: store.latitude, longitude: store.longitude });
    }
    setSelectedClient(store.name);
    go("client");
  };
  const updateStore = async (store: AgentStore) => {
    const nextDetails = [store, ...storeDetails.filter((item) => item.name.toLowerCase() !== selectedClient.toLowerCase())];
    const nextNames = [store.name, ...storeNames.filter((name) => name.toLowerCase() !== selectedClient.toLowerCase())];
    setStoreDetails(nextDetails);
    setStoreNames(nextNames);
    setSelectedClient(store.name);
    localStorage.setItem("alsat-agent-store-details", JSON.stringify(nextDetails));
    localStorage.setItem("alsat-agent-stores", JSON.stringify(nextNames));
    const companyId = localStorage.getItem("alsat-company-id");
    if (supabase && companyId) {
      await supabase.from("stores").update({ name: store.name, address: store.address, contact_name: store.contact, phone: store.phone, latitude: store.latitude, longitude: store.longitude }).eq("company_id", companyId).eq("name", selectedClient);
    }
  };
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
    <header className="suite-header"><button className="icon-button" onClick={() => go("more")}>☰</button><div className="suite-brand"><b>ALSAT</b><small>САУДА ӨКІЛІ</small></div><button className="icon-button" onClick={() => go("notifications")} aria-label="Хабарламалар">♧</button></header>
    {screen === "dashboard" && <Dashboard go={go} syncState={syncState} />}
    {screen === "clients" && <Clients clients={storeNames} go={go} onAdd={() => go("new-store")} onSelect={(name) => { setSelectedClient(name); go("client"); }} />}
    {screen === "new-store" && <NewStoreForm onCancel={() => go("clients")} onSave={addStore} />}
    {screen === "client" && <ClientCard name={selectedClient} store={storeDetails.find((store) => store.name.toLowerCase() === selectedClient.toLowerCase())} orders={orders} go={go} onUpdate={updateStore} />}
    {screen === "catalog" && <Catalog products={products} cart={cart} add={add} go={go} />}
    {screen === "order" && <OrderForm products={products} cart={cart} total={total} client={selectedClient} add={add} remove={remove} go={go} onSave={saveOrder} />}
    {screen === "orders" && <Orders orders={orders} go={go} onSelect={(order) => { setSelectedClient(order.client); setOrderSaved(order.status !== "Жаңа"); setLastOrder(order); setCart(order.items); go("detail"); }} />}
    {screen === "detail" && <OrderDetail order={lastOrder} total={total} client={selectedClient} saved={orderSaved} go={go} />}
    {screen === "route" && <RouteScreen go={go} onClient={(name) => { setSelectedClient(name); go("visit"); }} />}
    {screen === "visit" && <VisitScreen client={selectedClient} go={go} />}
    {screen === "reports" && <Reports go={go} />}
    {screen === "profile" && <Profile go={go} />}
    {screen === "notifications" && <AgentNotifications go={go} />}
    {screen === "more" && <More go={go} />}
    <nav className="suite-bottom"><button className={screen === "dashboard" ? "active" : ""} onClick={() => go("dashboard")}>⌂<small>Басты</small></button><button className={screen === "clients" || screen === "new-store" || screen === "client" ? "active" : ""} onClick={() => go("clients")}>♙<small>Клиенттер</small></button><button className={screen === "orders" || screen === "order" || screen === "detail" ? "active" : ""} onClick={() => go("orders")}>▤<small>Тапсырыстар</small></button><button className={screen === "reports" ? "active" : ""} onClick={() => go("reports")}>▥<small>Есеп</small></button><button className={screen === "more" || screen === "profile" ? "active" : ""} onClick={() => go("more")}>•••<small>Көбірек</small></button></nav>
  </main>;
}

function Dashboard({ go, syncState }: { go: (screen: Screen) => void; syncState: SyncState }) {
  const syncLabel = syncState === "syncing" ? "Синхрондалып жатыр" : syncState === "synced" ? "Supabase-пен синхрондалды" : syncState === "offline" ? "Offline кезегі" : "Дерек дайын";
  return <section className="suite-screen"><div className="profile-strip"><span className="person">А</span><div><strong>Нұрлан Әбілрахманов</strong><small>Сауда өкілі</small></div><span className={`sync-dot ${syncState}`} title={syncLabel}>●</span></div><div className={`sync-status ${syncState}`}>{syncLabel}</div><section className="metric-card"><small>Бүгінгі көрсеткіштер</small><p>12 мамыр, жексенбі</p><div className="metrics"><span>Тапсырыс<strong>1 245 000 ₸</strong><em>+12%</em></span><span>Клиенттер<strong>24</strong><em>+3</em></span><span>Жаңа клиент<strong>3</strong><em>+3</em></span><span>Орташа чек<strong>51 875 ₸</strong><em>›</em></span></div></section><SectionTitle title="Жылдам әрекеттер"/><div className="quick-actions"><button onClick={() => go("order")}>▣<span>Тапсырыс қосу</span></button><button onClick={() => go("clients")}>♙<span>Клиент қосу</span></button><button onClick={() => go("catalog")}>▦<span>Тауарлар</span></button><button onClick={() => go("route")}>⌖<span>Маршрут</span></button><button onClick={() => go("reports")}>▥<span>Есептер</span></button><button onClick={() => go("catalog")}>▧<span>Қойма қалдығы</span></button></div><SectionTitle title="Соңғы тапсырыстар" action="Барлығын көру ›" onClick={() => go("orders")}/><OrderMini number="№10045" name="Строймаг" amount="245 000 ₸" status="Жаңа тапсырыс"/><OrderMini number="№10044" name="ЭлектроДом" amount="185 000 ₸" status="Жеткізуге дайын"/><OrderMini number="№10043" name="Техносвет" amount="315 000 ₸" status="Жеткізілді"/></section>
}
function SectionTitle({ title, action, onClick }: { title: string; action?: string; onClick?: () => void }) { return <div className="section-title"><h3>{title}</h3>{action && <button onClick={onClick}>{action}</button>}</div> }
function OrderMini({ number, name, amount, status }: { number: string; name: string; amount: string; status: string }) { return <div className="order-mini"><span>▣</span><div><strong>{number} – {name}</strong><small>12.05.2024 · <i>{status}</i></small></div><b>{amount}</b></div> }
function Clients({ clients: clientList, go, onAdd, onSelect }: { clients: string[]; go: (screen: Screen) => void; onAdd: () => void; onSelect: (name: string) => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const filtered = clientList.filter((client, index) => client.toLowerCase().includes(query.toLowerCase()) && (filter !== "new" || index > 3));
  return <section className="suite-screen"><div className="screen-heading"><div><p className="overline">САТУ ӘКІЛІ</p><h1>Клиенттер</h1></div><button className="round-button" onClick={onAdd} aria-label="Жаңа дүкен қосу">+</button></div><input className="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="⌕  Іздеу"/><div className="filters"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Барлығы {clientList.length}</button><button className={filter === "active" ? "active" : ""} onClick={() => setFilter("active")}>Белсенді {clientList.length}</button><button className={filter === "new" ? "active" : ""} onClick={() => setFilter("new")}>Жаңа</button></div>{filtered.length ? filtered.map((client) => { const index = clientList.indexOf(client); const debt = [120000,85000,95000,70000,60000,55000][index] ?? 0; return <button className="client-row" key={client} onClick={() => onSelect(client)}><span className="client-icon">♧</span><div><strong>{client}</strong><small>Алматы қ., {index % 2 ? "Төле би 215" : "Райымбек 348"}<br/>{debt.toLocaleString("kk-KZ")} ₸</small></div><div className="client-right"><b>{Math.round(debt / 1000)}.000 ₸</b><em>Белсенді</em></div></button>; }) : <div className="empty">Дүкен табылмады</div>}</section>
}
function NewStoreForm({ onCancel, onSave }: { onCancel: () => void; onSave: (store: AgentStore) => void }) {
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [locationError, setLocationError] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!location) {
      setLocationError("Дүкеннің нақты орнын картадан белгілеңіз.");
      return;
    }
    const data = new FormData(event.currentTarget);
    onSave({ name: String(data.get("name") || "").trim(), address: String(data.get("address") || "").trim(), contact: String(data.get("contact") || "").trim(), phone: String(data.get("phone") || "").trim(), latitude: location.latitude, longitude: location.longitude });
  };
  return <section className="suite-screen new-store-screen"><button className="back-link" onClick={onCancel}>‹ Клиенттер</button><div className="screen-heading"><div><p className="overline">СӨ КАБИНЕТІ</p><h1>Жаңа дүкен</h1></div><span className="new-store-mark">+</span></div><p className="store-form-intro">Дүкен туралы ақпаратты енгізіңіз. Картадағы нүкте кейін экспедитор маршрутына автоматты қосылады.</p><form className="store-form" onSubmit={submit}><label>Дүкен атауы *<input name="name" placeholder="Мысалы, Строймаг" required autoFocus /></label><label>Мекенжайы *<input name="address" placeholder="Алматы қ., Райымбек 348" required /></label><label>Байланыс тұлғасы<input name="contact" placeholder="Алексей, директор" /></label><label>Телефон нөмірі<input name="phone" placeholder="+7 777 123 45 67" type="tel" /></label><LocationPicker value={location} onChange={(value) => { setLocation(value); setLocationError(""); }} />{locationError && <p className="location-error">{locationError}</p>}<div className="store-form-actions"><button type="button" onClick={onCancel}>Болдырмау</button><button className="save-order" type="submit">Дүкенді сақтау　→</button></div></form></section>
}
function ClientCard({ name, store, orders, go, onUpdate }: { name: string; store?: AgentStore; orders: OrderRecord[]; go: (screen: Screen) => void; onUpdate: (store: AgentStore) => void }) {
  const [tab, setTab] = useState<"info" | "orders" | "payments" | "notes">("info");
  const [notes, setNotes] = useState<string[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [payments, setPayments] = useState<Array<{ id: number; amount: number; method: string; date: string }>>([]);
  const [editing, setEditing] = useState(false);
  const clientOrders = orders.filter((order) => order.client === name);
  const address = store ? (store.address || "Көрсетілмеген") : "Алматы қ., Райымбек 348";
  const contact = store ? (store.contact || "Көрсетілмеген") : "Алексей · Директор";
  const phone = store ? (store.phone || "Көрсетілмеген") : "+7 777 987 65 43";
  const callablePhone = phone.replace(/[^+\d]/g, "");

  useEffect(() => {
    const notesKey = `alsat-client-notes-${encodeURIComponent(name)}`;
    const paymentsKey = `alsat-client-payments-${encodeURIComponent(name)}`;
    try { setNotes(JSON.parse(localStorage.getItem(notesKey) || "[]")); } catch { setNotes([]); }
    try { setPayments(JSON.parse(localStorage.getItem(paymentsKey) || "[]")); } catch { setPayments([]); }
    setTab("info");
  }, [name]);

  const saveNote = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = noteDraft.trim();
    if (!value) return;
    const next = [`${value} · ${new Date().toLocaleDateString("kk-KZ")}`, ...notes];
    setNotes(next);
    localStorage.setItem(`alsat-client-notes-${encodeURIComponent(name)}`, JSON.stringify(next));
    setNoteDraft("");
  };

  const savePayment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = Number(form.get("amount"));
    if (!amount || amount < 1) return;
    const next = [{ id: Date.now(), amount, method: String(form.get("method") || "Қолма-қол"), date: new Date().toLocaleDateString("kk-KZ") }, ...payments];
    setPayments(next);
    localStorage.setItem(`alsat-client-payments-${encodeURIComponent(name)}`, JSON.stringify(next));
    event.currentTarget.reset();
  };
  const saveClient = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onUpdate({ name: String(form.get("name") || name).trim(), address: String(form.get("address") || address).trim(), contact: String(form.get("contact") || contact).trim(), phone: String(form.get("phone") || phone).trim(), latitude: store?.latitude, longitude: store?.longitude });
    setEditing(false);
  };


  return <section className="suite-screen">
    <button className="back-link" onClick={() => go("clients")}>‹ Клиенттер</button>
    <div className="client-card-head"><div><span className="tag">Белсенді клиент</span><h1>{name}</h1><small>ЖШС · {address}<br/>{phone}<br/>Жауапты: Нұрлан Ә.</small></div><button className="icon-button dark" onClick={() => setEditing((value) => !value)} aria-label="Клиентті өңдеу">✎</button></div>
    {editing && <form className="client-inline-form client-edit-form" onSubmit={saveClient}><label>Дүкен атауы<input name="name" defaultValue={name} required /></label><label>Мекенжай<input name="address" defaultValue={address} required /></label><label>Байланыс тұлғасы<input name="contact" defaultValue={contact} /></label><label>Телефон<input name="phone" defaultValue={phone} type="tel" /></label><div className="store-form-actions"><button type="button" onClick={() => setEditing(false)}>Болдырмау</button><button className="save-order" type="submit">Өзгерісті сақтау</button></div></form>}
    <div className="client-actions"><button onClick={() => go("order")}>▣<small>Тапсырыс</small></button><button onClick={() => { if (callablePhone) window.location.href = `tel:${callablePhone}`; }}>⌕<small>Қоңырау</small></button><button onClick={() => go("route")}>⌖<small>Маршрут</small></button><button onClick={() => go("more")}>•••<small>Көбірек</small></button></div>
    <div className="tabs client-tabs"><button className={tab === "info" ? "active" : ""} onClick={() => setTab("info")}>Ақпарат</button><button className={tab === "orders" ? "active" : ""} onClick={() => setTab("orders")}>Тапсырыстар</button><button className={tab === "payments" ? "active" : ""} onClick={() => setTab("payments")}>Төлемдер</button><button className={tab === "notes" ? "active" : ""} onClick={() => setTab("notes")}>Ескертпелер</button></div>

    {tab === "info" && <div className="client-tab-panel"><div className="info-card"><InfoRow label="Борышы" value="120 000 ₸"/><InfoRow label="Жалпы сатып алу" value="5 450 000 ₸"/><InfoRow label="Соңғы тапсырыс" value="12.05.2024"/><InfoRow label="Төлем түрі" value="Несие (14 күн)"/><InfoRow label="Жеңілдік" value="5%"/><InfoRow label="Лимит" value="1 000 000 ₸"/></div><div className="info-card"><strong>Байланыс тұлға</strong><InfoRow label={contact} value={phone}/><strong>Мекенжай</strong><InfoRow label="Негізгі" value={address}/>{store?.latitude != null && store?.longitude != null && <InfoRow label="Карта нүктесі" value={`${store.latitude.toFixed(5)}, ${store.longitude.toFixed(5)}`}/>}</div></div>}

    {tab === "orders" && <div className="client-tab-panel"><div className="tab-panel-heading"><div><strong>Дүкен тапсырыстары</strong><small>{clientOrders.length} тапсырыс</small></div><button onClick={() => go("order")}>＋ Жаңа</button></div>{clientOrders.length ? clientOrders.map((order) => <button className="client-history-row" key={order.id} onClick={() => go("orders")}><span>▣</span><div><strong>{order.id}</strong><small>{order.createdAt} · {order.items.length} тауар</small></div><div><b>{money(order.total)}</b><em>{order.status}</em></div></button>) : <div className="empty client-empty">Бұл дүкенде тапсырыс жоқ.<button onClick={() => go("order")}>Алғашқы тапсырысты қосу</button></div>}</div>}

    {tab === "payments" && <div className="client-tab-panel"><div className="info-card payment-summary"><InfoRow label="Ағымдағы борыш" value="120 000 ₸"/><InfoRow label="Соңғы төлемдер" value={money(payments.reduce((sum, payment) => sum + payment.amount, 0))}/></div><form className="client-inline-form" onSubmit={savePayment}><label>Төлем сомасы<input name="amount" type="number" min="1" placeholder="50 000" required /></label><label>Төлем түрі<select name="method"><option>Қолма-қол</option><option>Аударым</option><option>Карта</option></select></label><button className="save-order" type="submit">Төлемді қосу</button></form>{payments.length ? payments.map((payment) => <div className="payment-row" key={payment.id}><span>₸</span><div><strong>{money(payment.amount)}</strong><small>{payment.method} · {payment.date}</small></div><em>Қабылданды</em></div>) : <div className="empty client-empty">Төлем тарихы бос</div>}</div>}

    {tab === "notes" && <div className="client-tab-panel"><form className="note-form" onSubmit={saveNote}><label>Жаңа ескертпе<textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Клиент туралы ескертпе жазыңыз..." required /></label><button className="save-order" type="submit">Ескертпені сақтау</button></form>{notes.length ? notes.map((note, index) => <div className="note-row" key={`${note}-${index}`}><span>✎</span><p>{note}</p></div>) : <div className="empty client-empty">Ескертпе жоқ</div>}</div>}
  </section>;
}
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
function OrderForm({ cart, total, client, add, remove, go, onSave }: { products: Product[]; cart: Product[]; total: number; client: string; add: (product: Product) => void; remove: (id: number) => void; go: (screen: Screen) => void; onSave: () => void }) { const grouped = cart.reduce<Array<{ product: Product; quantity: number }>>((result, product) => { const found = result.find((row) => row.product.id === product.id); if (found) found.quantity += 1; else result.push({ product, quantity: 1 }); return result; }, []); return <section className="suite-screen"><button className="back-link" onClick={() => go("catalog")}>‹ Тауарлар</button><div className="screen-heading"><h1>Тапсырыс жасау</h1><span>{cart.length} дана</span></div><button className="selected-client" onClick={() => go("clients")}><div><strong>{client}</strong><small>Борышы: 120 000 ₸</small></div><b>›</b></button><button className="search search-button" onClick={() => go("catalog")}>⌕  Тағы тауар қосу</button>{grouped.map(({ product, quantity }) => <div className="cart-row" key={product.id}><span className="product-icon">◌</span><div><strong>{product.name}</strong><small>{product.subtitle}</small></div><div className="quantity"><button onClick={() => remove(product.id)}>−</button><b>{quantity}</b><button onClick={() => add(product)}>+</button><strong>{money(product.price * quantity)}</strong></div></div>)}<div className="order-summary"><InfoRow label={`Тауарлар (${cart.length})`} value={money(total)}/><InfoRow label="Жеңілдік (5%)" value={`- ${money(Math.round(total * .05))}`}/><InfoRow label="Жалпы сома" value={money(Math.round(total * .95))}/></div><button className="save-order" onClick={cart.length ? onSave : () => go("catalog")}>{cart.length ? "Тапсырысты сақтау" : "Тауар таңдау"}</button></section> }
function Orders({ orders, go, onSelect }: { orders: OrderRecord[]; go: (screen: Screen) => void; onSelect: (order: OrderRecord) => void }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? orders : orders.filter((order) => order.status === filter);
  const statusClass = (status: string) => status === "Бекітілген" || status === "Жаңа" ? "green" : status === "Жеткізілді" ? "blue" : "yellow";
  return <section className="suite-screen"><div className="screen-heading"><h1>Тапсырыстар</h1><button className="cart-button" onClick={() => go("order")}>＋</button></div><div className="filters"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Барлығы</button><button className={filter === "Жаңа" ? "active" : ""} onClick={() => setFilter("Жаңа")}>Күтуде</button><button className={filter === "Бекітілген" ? "active" : ""} onClick={() => setFilter("Бекітілген")}>Бекітілген</button><button className={filter === "Жеткізілді" ? "active" : ""} onClick={() => setFilter("Жеткізілді")}>Жеткізілді</button></div>{filtered.length ? filtered.map((order) => <button className="order-list-row" key={order.id} onClick={() => onSelect(order)}><span className="client-icon">▣</span><div><strong>{order.id} · {order.client}</strong><small>{order.createdAt} · {order.items.length} тауар</small></div><div><b>{money(order.total)}</b><em className={statusClass(order.status)}>{order.status}</em></div></button>) : <div className="empty">Бұл сүзгіде тапсырыс жоқ</div>}</section>
}
function OrderDetail({ order, total, client, saved, go }: { order: OrderRecord | null; total: number; client: string; saved: boolean; go: (screen: Screen) => void }) {
  const gross = order ? Math.round(order.total / .95) : (total || 44500);
  const items = order?.items ?? products.slice(0, 3);
  return <section className="suite-screen"><button className="back-link" onClick={() => go("orders")}>‹ Тапсырыстар</button><div className="screen-heading"><h1>Тапсырыс {order?.id ?? "№10045"}</h1><button className="icon-button dark" onClick={() => window.print()} aria-label="Тапсырысты басып шығару">⎙</button></div><span className="status-pill green">{order?.status ?? (saved ? "Бекітілген" : "Жаңа")}</span><div className="info-card"><strong>{order?.client ?? client}</strong><small>Алматы қ., Райымбек 348<br/>+7 777 123 45 67</small></div><div className="info-card"><InfoRow label="Құру уақыты" value={order?.createdAt ?? "12.05.2024 10:30"}/><InfoRow label="Төлем түрі" value="Несие (14 күн)"/><InfoRow label="Жеткізу күні" value="15.05.2024"/><InfoRow label="Жеңілдік" value="5%"/></div><SectionTitle title="Тауарлар"/><div className="info-card">{items.map((item) => <InfoRow key={item.id} label={item.name} value={money(item.price)}/>)}<InfoRow label={`Тауарлар (${items.length})`} value={money(gross)}/><InfoRow label="Жеңілдік (5%)" value={`- ${money(Math.round(gross * .05))}`}/><InfoRow label="Жалпы сома" value={money(order?.total ?? Math.round(gross * .95))}/></div><button className="save-order" onClick={() => go("orders")}>Төлемді белгілеу</button></section>
}
function RouteScreen({ go, onClient }: { go: (screen: Screen) => void; onClient: (name: string) => void }) {
  const [started, setStarted] = useState(() => localStorage.getItem("alsat-agent-route-started") === "1");
  const stops=[{name:"Строймаг",coordinates:[76.8897,43.2383] as [number,number],status:"Бітірілді"},{name:"ЭлектроДом",coordinates:[76.912,43.256] as [number,number],status:"Бітірілді"},{name:"Техносвет",coordinates:[76.905,43.225] as [number,number],status:"Бара жатыр"},{name:"Светлый дом",coordinates:[76.87,43.245] as [number,number],status:"Келесі"}];
  const start = () => { setStarted(true); localStorage.setItem("alsat-agent-route-started", "1"); };
  return <section className="suite-screen"><div className="screen-heading"><div><button className="back-link" onClick={() => go("dashboard")}>‹ Басты бет</button><h1>Маршрут</h1></div><button className="icon-button dark" onClick={() => window.print()} aria-label="Маршрутты басып шығару">▣</button></div><div className="route-day">12 мамыр, жексенбі　›</div><div className="route-stat-grid"><span>Клиенттер<strong>12</strong></span><span>Бару керек<strong>8</strong></span><span>Бітірілді<strong>4</strong></span></div>{started && <div className="action-panel success">● Маршрут белсенді. Келесі нүкте: Техносвет</div>}<RouteMap stops={stops}/>{stops.map((stop, i) => <button className="route-stop" key={stop.name} onClick={() => onClient(stop.name)}><span className={i < 2 ? "done" : ""}>{i + 1}</span><div><strong>{stop.name}</strong><small>{`${9 + i}:00 – ${9 + i}:30`} · Алматы қ.</small></div><em>{stop.status}</em></button>)}<button className="save-order" onClick={started ? () => onClient("Техносвет") : start}>{started ? "Келесі клиентті ашу" : "Маршрутты бастау"}</button></section>;
}
function VisitScreen({ client, go }: { client: string; go: (screen: Screen) => void }) {
  const [tab, setTab] = useState<"info" | "order" | "history" | "note">("info");
  const [tasks, setTasks] = useState([false, false, false, false]);
  const labels = ["Тапсырыс алу", "Тауар үлгісін көрсету", "Төлемді тексеру", "Сөре фотосуреті"];
  const toggle = (index: number) => setTasks((current) => current.map((item, itemIndex) => itemIndex === index ? !item : item));
  return <section className="suite-screen"><button className="back-link" onClick={() => go("route")}>‹ Маршрут</button><div className="screen-heading"><h1>{client}</h1><span>1 / 8</span></div><div className="tabs"><button className={tab === "info" ? "active" : ""} onClick={() => setTab("info")}>Ақпарат</button><button className={tab === "order" ? "active" : ""} onClick={() => setTab("order")}>Тапсырыс</button><button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>Тарих</button><button className={tab === "note" ? "active" : ""} onClick={() => setTab("note")}>Ескертпе</button></div>{tab === "info" && <div className="info-card"><InfoRow label="Борышы" value="120 000 ₸"/><InfoRow label="Соңғы тапсырыс" value="12.05.2024"/><InfoRow label="Жалпы сатып алу" value="5 450 000 ₸"/><InfoRow label="Жеңілдік" value="5%"/></div>}{tab === "order" && <div className="action-panel"><strong>Бүгінгі тапсырыс</strong><p>Клиентке жаңа тапсырыс жасаңыз немесе алдыңғы тапсырыстарды ашыңыз.</p><button onClick={() => go("order")}>Тапсырыс қосу</button></div>}{tab === "history" && <div className="action-panel"><strong>Соңғы визиттер</strong><p>12.05.2024 · тапсырыс қабылданды</p><p>05.05.2024 · төлем тексерілді</p></div>}{tab === "note" && <div className="action-panel"><textarea placeholder="Визит ескертпесін жазыңыз"/><button onClick={() => setTab("info")}>Сақтау</button></div>}<SectionTitle title="Бүгінгі әрекет"/><div className="checklist interactive">{labels.map((label, index) => <button className={tasks[index] ? "done" : ""} key={label} onClick={() => toggle(index)}>{tasks[index] ? "✓" : "○"} {label}</button>)}</div><button className="save-order" onClick={() => go("order")}>Тапсырыс қосу</button></section>;
}
function Reports({ go }: { go: (screen: Screen) => void }) {
  const periods = ["Бүгін", "Бұл апта", "Бұл ай"]; const [period, setPeriod] = useState(2);
  return <section className="suite-screen"><div className="screen-heading"><h1>Есеп</h1><button className="period" onClick={() => setPeriod((value) => (value + 1) % periods.length)}>{periods[period]}⌄</button></div><div className="report-hero"><small>Жалпы сома · {periods[period]}</small><strong>{period === 0 ? "1 245 000 ₸" : period === 1 ? "5 860 000 ₸" : "18 450 000 ₸"}</strong><p>+18% алдыңғы кезеңмен салыстырғанда</p><div className="chart">▁▂▃▅▆▇▆▅▇▇▆▇</div></div><div className="report-cards"><div><small>Тапсырыстар</small><strong>245</strong><em>+15%</em></div><div><small>Орташа чек</small><strong>75 306 ₸</strong><em>+8%</em></div><div><small>Жаңа клиенттер</small><strong>18</strong><em>+5%</em></div><div><small>Қайтарым</small><strong>2.5%</strong><em className="negative">−0.5%</em></div></div><SectionTitle title="Топ тауарлар" action="Барлығы ›" onClick={() => go("catalog")}/><div className="product-row compact"><span className="product-icon">◌</span><div><strong>KRAUSZ Шам A60 12W E27</strong><small>Сатылды: 1 250 дана</small></div><b>8 125 000 ₸</b></div></section>;
}
function Profile({ go }: { go: (screen: Screen) => void }) {
  async function logout() { if (supabase) await supabase.auth.signOut(); window.location.href = "/agent-login"; }
  const [setting, setSetting] = useState("");
  return <section className="suite-screen"><button className="icon-button dark" onClick={() => go("more")}>‹</button><div className="profile-card"><span className="person big">А</span><h1>Нұрлан Әбілрахманов</h1><p>Сауда өкілі</p><strong>+7 777 123 45 67</strong></div>{["Жеке ақпарат", "Құпия сөзді өзгерту", "Хабарлама баптаулары", "Тіл · Қазақша", "Қолдау қызметі", "Қосымша туралы"].map(item => <button className="setting-row" onClick={() => setSetting(item)} key={item}>{item}<b>›</b></button>)}{setting && <div className="action-panel"><strong>{setting}</strong><p>{setting === "Құпия сөзді өзгерту" ? "Құпия сөзді өзгерту сілтемесі тіркелген email-ға жіберіледі." : setting === "Қолдау қызметі" ? "Қолдау: +7 700 123-45-67 · support@alsat.kz" : "Бұл бөлім сақтауға және өңдеуге дайын."}</p><button onClick={() => setSetting("")}>Дайын</button></div>}<button className="logout" onClick={logout}>⇥　Шығу</button></section>
}
function AgentNotifications({ go }: { go: (screen: Screen) => void }) { const [unreadOnly, setUnreadOnly] = useState(false); const [read, setRead] = useState<number[]>([]); const items = ["Жаңа тапсырыс қоймаға жіберілді", "Маршрут жаңартылды", "Клиент төлем қосты"]; return <section className="suite-screen"><div className="screen-heading"><button className="back-link" onClick={() => go("dashboard")}>‹ Басты бет</button><h1>Хабарламалар</h1></div><div className="tabs"><button className={!unreadOnly ? "active" : ""} onClick={() => setUnreadOnly(false)}>Барлығы</button><button className={unreadOnly ? "active" : ""} onClick={() => setUnreadOnly(true)}>Оқылмаған</button></div>{items.map((item, index) => (!unreadOnly || !read.includes(index)) && <button className="setting-row" key={item} onClick={() => setRead((current) => [...current, index])}><span>{read.includes(index) ? "✓" : "●"}　{item}</span><b>›</b></button>)}<button className="save-order" onClick={() => setRead(items.map((_, index) => index))}>Барлығын оқу</button></section>; }
function More({ go }: { go: (screen: Screen) => void }) { return <section className="suite-screen"><h1>Көбірек</h1><button className="setting-row" onClick={() => go("profile")}>⚙　Профиль және баптаулар <b>›</b></button><button className="setting-row" onClick={() => go("route")}>⌖　Маршрут және сапарлар <b>›</b></button><button className="setting-row" onClick={() => go("reports")}>▥　Комиссия және мақсаттар <b>›</b></button><button className="setting-row" onClick={() => go("notifications")}>◉　Хабарлама және қолдау <b>›</b></button></section> }
