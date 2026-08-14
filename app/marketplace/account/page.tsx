"use client";

import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { demoProducts, money, type CatalogProduct } from "../../../lib/marketplace-products";
import { addCartItem, type BuyerOrder, type BuyerProfile, cancelBuyerOrder, loadBuyerOrders, loadBuyerProfile, loadFavoriteIds, loadMarketplaceCatalog, readCart, saveBuyerProfile, setFavorite, writeCart } from "../../../lib/marketplace-commerce";
import "./account.css";

type AccountTab = "overview" | "orders" | "favorites" | "profile";

const statusLabel: Record<string, string> = {
  new: "Қабылданды", draft: "Жоба", submitted: "Жіберілді", confirmed: "Расталды",
  picking: "Қойма жинап жатыр", ready: "Жөнелтуге дайын", labeled: "QR жапсырылды",
  shipped: "Жолда", delivered: "Жеткізілді", cancelled: "Бас тартылды", rejected: "Қабылданбады",
  unpaid: "Төленбеген", paid: "Төленген", partial: "Жартылай төленген",
};

function shortOrder(id: string) { return `№${id.replaceAll("-", "").slice(0, 8).toUpperCase()}`; }
function dateLabel(value: string) { return value ? new Intl.DateTimeFormat("kk-KZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—"; }

export default function MarketplaceAccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [tab, setTab] = useState<AccountTab>("overview");
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [catalog, setCatalog] = useState<CatalogProduct[]>(demoProducts);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [profile, setProfile] = useState<BuyerProfile>({ businessName: "", bin: "", contactName: "", phone: "", email: "" });
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (["overview", "orders", "favorites", "profile"].includes(requested || "")) setTab(requested as AccountTab);
    if (!supabase) { setChecking(false); return; }
    void supabase.auth.getUser().then(({ data }) => { setUser(data.user ?? null); setChecking(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setBusy(true);
    void Promise.all([loadBuyerProfile(user), loadBuyerOrders(), loadFavoriteIds(), loadMarketplaceCatalog()]).then(([buyer, nextOrders, ids, catalogResult]) => {
      if (!active) return;
      setProfile(buyer.profile);
      setOrders(nextOrders);
      setFavoriteIds(ids);
      if (catalogResult.products.length) setCatalog(catalogResult.products);
      setBusy(false);
    });
    return () => { active = false; };
  }, [user]);

  const favorites = useMemo(() => catalog.filter((product) => favoriteIds.includes(product.id)), [catalog, favoriteIds]);
  const activeOrders = orders.filter((order) => !["delivered", "cancelled", "canceled", "rejected"].includes(order.status));
  const totalPurchased = orders.filter((order) => order.status !== "cancelled").reduce((sum, order) => sum + order.total, 0);

  async function authenticate(event: FormEvent) {
    event.preventDefault();
    setError(""); setMessage(""); setBusy(true);
    if (!supabase) { setError("Supabase конфигурациясы табылмады."); setBusy(false); return; }
    if (authMode === "signin") {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError || !data.user) setError(authError?.message || "Кіру мүмкін болмады.");
      else if (new URLSearchParams(window.location.search).get("next") === "checkout") window.location.href = "/marketplace?cart=open";
      else setUser(data.user);
    } else {
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(), password,
        options: { data: { business_name: businessName.trim(), full_name: contactName.trim(), phone: phone.trim(), account_type: "marketplace_buyer" } },
      });
      if (authError) setError(authError.message);
      else if (data.user && data.session && new URLSearchParams(window.location.search).get("next") === "checkout") window.location.href = "/marketplace?cart=open";
      else if (data.user && data.session) setUser(data.user);
      else setMessage("Тіркелу аяқталды. Email-ге келген растау сілтемесін ашыңыз.");
    }
    setBusy(false);
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    setBusy(true); setError(""); setMessage("");
    try { await saveBuyerProfile(user, profile); setMessage("Компания профилі сақталды."); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Профиль сақталмады."); }
    finally { setBusy(false); }
  }

  async function removeFavorite(product: CatalogProduct) {
    setFavoriteIds((current) => current.filter((id) => id !== product.id));
    await setFavorite(product.id, false);
  }

  function addFavoriteToCart(product: CatalogProduct) {
    writeCart(addCartItem(readCart(), product));
    setMessage(`${product.name} себетке қосылды.`);
  }

  function reorder(order: BuyerOrder) {
    let cart = readCart();
    let added = 0;
    for (const item of order.items) {
      const product = catalog.find((candidate) => candidate.id === item.productId);
      if (!product || product.stock < product.minOrder) continue;
      cart = addCartItem(cart, product, Math.min(item.quantity, product.stock));
      added += 1;
    }
    if (!added) { setError("Бұл тапсырыстағы тауарлар қазір сатылымда жоқ."); return; }
    writeCart(cart);
    window.location.href = "/marketplace?cart=open";
  }

  async function cancelOrder(orderId: string) {
    setBusy(true); setError("");
    const cancelled = await cancelBuyerOrder(orderId);
    if (cancelled) setOrders((current) => current.map((order) => order.id === orderId ? { ...order, status: "cancelled" } : order));
    else setError("Бұл тапсырысты енді тоқтатуға болмайды: қойма өңдеуді бастап қойған болуы мүмкін.");
    setBusy(false);
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setUser(null); setOrders([]); setTab("overview");
  }

  if (checking) return <main className="account-state"><span/><strong>Marketplace кабинетіңіз ашылуда…</strong></main>;

  if (!user) return <main className="buyer-auth-shell">
    <section className="buyer-auth-story"><Link href="/marketplace" className="buyer-logo"><i>▲</i><span><b>ALSAT</b><small>MARKETPLACE</small></span></Link><div><span className="auth-kicker">БИЗНЕСКЕ АРНАЛҒАН САТЫП АЛУ ОРТАСЫ</span><h1>Сатып алуды<br/>бір кабинеттен<br/>басқарыңыз</h1><p>Бірнеше жеткізушіден тапсырыс беріңіз, құжаттарды сақтаңыз және жеткізуді қоймадағы QR кезеңінен соңғы нүктеге дейін бақылаңыз.</p><ul><li>Көтерме бағалар мен тексерілген жеткізушілер</li><li>Бір себет — әр жеткізушіге қауіпсіз жеке тапсырыс</li><li>Тапсырыс, төлем және жеткізу тарихы</li></ul></div></section>
    <section className="buyer-auth-card"><Link href="/marketplace" className="auth-back">← Marketplace-ке оралу</Link><span className="auth-kicker">ALSAT B2B ACCOUNT</span><h2>{authMode === "signin" ? "Қайта оралғаныңызға қуаныштымыз" : "Сатып алушы компанияны тіркеу"}</h2><p>{authMode === "signin" ? "Тапсырыстар мен жеткізулерді көру үшін кіріңіз." : "Marketplace аккаунты Workspace компаниясын ашуға міндеттемейді."}</p>
      <form onSubmit={authenticate}>{authMode === "signup" && <><label>Компания немесе дүкен атауы<input required value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="Строймаг ЖШС"/></label><div className="auth-two"><label>Байланыс тұлғасы<input required value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Нұрлан Ә."/></label><label>Телефон<input required value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+7 700 000 00 00"/></label></div></>}<label>Email<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="office@company.kz"/></label><label>Құпия сөз<input required minLength={6} type="password" autoComplete={authMode === "signin" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Кемінде 6 таңба"/></label>{error && <div className="account-error">{error}</div>}{message && <div className="account-message">{message}</div>}<button className="auth-submit" disabled={busy}>{busy ? "Күте тұрыңыз…" : authMode === "signin" ? "Кіру" : "Тіркелу"}</button></form>
      <button className="auth-switch" onClick={() => { setAuthMode((mode) => mode === "signin" ? "signup" : "signin"); setError(""); setMessage(""); }}>{authMode === "signin" ? "Аккаунт жоқ па? Компанияны тіркеу" : "Аккаунт бар ма? Кіру"}</button><div className="auth-workspace">Тауар сатасыз ба? <Link href="/workspace-signup">Жеткізуші Workspace ашу →</Link></div>
    </section>
  </main>;

  return <main className="buyer-account-shell">
    <aside className="buyer-sidebar"><Link href="/marketplace" className="buyer-logo"><i>▲</i><span><b>ALSAT</b><small>MARKETPLACE</small></span></Link><nav><button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}><i>⌂</i>Шолу</button><button className={tab === "orders" ? "active" : ""} onClick={() => setTab("orders")}><i>▤</i>Тапсырыстар <b>{activeOrders.length}</b></button><button className={tab === "favorites" ? "active" : ""} onClick={() => setTab("favorites")}><i>♡</i>Таңдаулылар</button><button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}><i>♙</i>Компания профилі</button></nav><div className="sidebar-business"><span>{profile.businessName.slice(0, 1) || "B"}</span><div><b>{profile.businessName || user.email}</b><small>B2B сатып алушы</small></div></div><Link className="workspace-route" href="/workspace-login">↗ Жеткізуші Workspace</Link><button className="buyer-signout" onClick={() => void signOut()}>↪ Шығу</button></aside>
    <section className="buyer-content"><header><div><span>ALSAT MARKETPLACE</span><h1>{tab === "overview" ? "Қайырлы күн!" : tab === "orders" ? "Тапсырыстар" : tab === "favorites" ? "Таңдаулылар" : "Компания профилі"}</h1></div><div><Link href="/marketplace">Каталогқа өту</Link><button aria-label="Хабарламалар">♢</button></div></header>{error && <div className="account-error global">{error}</div>}{message && <div className="account-message global">{message}<button onClick={() => setMessage("")}>×</button></div>}

      {tab === "overview" && <><section className="buyer-welcome"><div><span>B2B САТЫП АЛУ КАБИНЕТІ</span><h2>{profile.businessName || "Компания профилін толтырыңыз"}</h2><p>Тапсырыс, қойма QR, экспедитор және төлем статусы бір тізбекте.</p><button onClick={() => setTab("orders")}>Тапсырыстарды көру →</button></div><div className="welcome-metric"><small>Жалпы сатып алу</small><strong>{money.format(totalPurchased)}</strong><span>{orders.length} тапсырыс</span></div></section><section className="buyer-stat-grid"><article><span>▤</span><div><small>Белсенді тапсырыстар</small><strong>{activeOrders.length}</strong></div></article><article><span>▱</span><div><small>Жолдағы тапсырыстар</small><strong>{orders.filter((order) => ["shipped", "labeled", "ready"].includes(order.warehouseStatus)).length}</strong></div></article><article><span>✓</span><div><small>Жеткізілген</small><strong>{orders.filter((order) => order.status === "delivered").length}</strong></div></article><article><span>♡</span><div><small>Таңдаулы тауарлар</small><strong>{favoriteIds.length}</strong></div></article></section><section className="account-panel"><div className="panel-head"><div><h2>Соңғы тапсырыстар</h2><span>Жеткізушілер мен логистика статусы</span></div><button onClick={() => setTab("orders")}>Барлығын көру</button></div><OrderList orders={orders.slice(0, 3)} expanded={expandedOrder} onExpand={setExpandedOrder} onCancel={(id) => void cancelOrder(id)} onReorder={reorder} busy={busy}/></section></>}

      {tab === "orders" && <section className="account-panel orders-panel"><div className="panel-head"><div><h2>Сатып алу тарихы</h2><span>Marketplace арқылы жасалған барлық тапсырыс</span></div><Link href="/marketplace/catalog">+ Жаңа тапсырыс</Link></div>{busy && !orders.length ? <div className="account-empty">Тапсырыстар жүктелуде…</div> : <OrderList orders={orders} expanded={expandedOrder} onExpand={setExpandedOrder} onCancel={(id) => void cancelOrder(id)} onReorder={reorder} busy={busy}/>}</section>}

      {tab === "favorites" && <section className="account-panel"><div className="panel-head"><div><h2>Сақталған ұсыныстар</h2><span>Бағасын бақылап, кейін себетке қосыңыз</span></div><Link href="/marketplace#offers">Каталогтан қосу</Link></div>{favorites.length ? <div className="account-favorite-grid">{favorites.map((product) => <article key={product.id}><Link href={`/marketplace/product/${encodeURIComponent(product.id)}`} className="favorite-visual">{product.imageUrl ? <img src={product.imageUrl} alt=""/> : <span>▣</span>}</Link><small>{product.brand || product.category}</small><Link href={`/marketplace/product/${encodeURIComponent(product.id)}`}><strong>{product.name}</strong></Link><b>{money.format(product.price)}</b><div><button onClick={() => addFavoriteToCart(product)}>Себетке қосу</button><button onClick={() => void removeFavorite(product)} aria-label="Өшіру">×</button></div></article>)}</div> : <div className="account-empty"><span>♡</span><strong>Таңдаулы тауар жоқ</strong><p>Қажетті тауарға жүрек белгісін басыңыз — ол осында сақталады.</p><Link href="/marketplace#offers">Каталогты ашу</Link></div>}</section>}

      {tab === "profile" && <section className="account-panel profile-panel"><div className="panel-head"><div><h2>Компания реквизиттері</h2><span>Шот, жүкқұжат және жеткізу үшін қолданылады</span></div></div><form onSubmit={saveProfile}><label>Компания немесе дүкен атауы<input required value={profile.businessName} onChange={(event) => setProfile((current) => ({ ...current, businessName: event.target.value }))}/></label><div className="profile-two"><label>БСН<input inputMode="numeric" value={profile.bin} onChange={(event) => setProfile((current) => ({ ...current, bin: event.target.value.replace(/\D/g, "").slice(0, 12) }))} placeholder="12 сан"/></label><label>Email<input type="email" value={profile.email} onChange={(event) => setProfile((current) => ({ ...current, email: event.target.value }))}/></label></div><div className="profile-two"><label>Байланыс тұлғасы<input required value={profile.contactName} onChange={(event) => setProfile((current) => ({ ...current, contactName: event.target.value }))}/></label><label>Телефон<input required value={profile.phone} onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))}/></label></div><button disabled={busy}>{busy ? "Сақталуда…" : "Өзгерістерді сақтау"}</button></form><aside><strong>Деректерді қорғау</strong><p>Компания реквизиттері тек тапсырыс құжаттары, жеткізу және төлем үшін қолданылады.</p><Link href="/legal/privacy">Құпиялық саясаты →</Link></aside></section>}
    </section>
    <nav className="buyer-mobile-nav"><button onClick={() => setTab("overview")} className={tab === "overview" ? "active" : ""}>⌂<span>Шолу</span></button><button onClick={() => setTab("orders")} className={tab === "orders" ? "active" : ""}>▤<span>Тапсырыс</span></button><Link href="/marketplace">▦<span>Каталог</span></Link><button onClick={() => setTab("favorites")} className={tab === "favorites" ? "active" : ""}>♡<span>Таңдаулар</span></button><button onClick={() => setTab("profile")} className={tab === "profile" ? "active" : ""}>♙<span>Профиль</span></button></nav>
  </main>;
}

function OrderList({ orders, expanded, onExpand, onCancel, onReorder, busy }: { orders: BuyerOrder[]; expanded: string | null; onExpand: (id: string | null) => void; onCancel: (id: string) => void; onReorder: (order: BuyerOrder) => void; busy: boolean }) {
  if (!orders.length) return <div className="account-empty"><span>▤</span><strong>Әзірге тапсырыс жоқ</strong><p>Каталогтан тауар таңдап, алғашқы B2B тапсырысыңызды жасаңыз.</p><Link href="/marketplace">Каталогты ашу</Link></div>;
  return <div className="buyer-order-list">{orders.map((order) => <article className={expanded === order.id ? "expanded" : ""} key={order.id}><button className="order-summary" onClick={() => onExpand(expanded === order.id ? null : order.id)}><span className="order-icon">▤</span><span><b>{shortOrder(order.id)}</b><small>{dateLabel(order.createdAt)} · {order.sellerName}</small></span><span className={`order-status status-${order.status}`}>{statusLabel[order.status] || order.status}</span><span className="order-logistics"><small>Қойма</small><b>{statusLabel[order.warehouseStatus] || order.warehouseStatus}</b></span><strong>{money.format(order.total)}</strong><i>{expanded === order.id ? "⌃" : "⌄"}</i></button>{expanded === order.id && <div className="order-detail"><div className="order-progress"><i className="done">✓<small>Қабылданды</small></i><span/><i className={["picking", "ready", "labeled", "shipped", "delivered"].includes(order.warehouseStatus) ? "done" : ""}>2<small>Қойма</small></i><span/><i className={["shipped", "delivered"].includes(order.warehouseStatus) ? "done" : ""}>3<small>Жолда</small></i><span/><i className={order.status === "delivered" ? "done" : ""}>4<small>Жеткізілді</small></i></div><div className="order-lines">{order.items.map((item) => <div key={item.id}><span><b>{item.name}</b><small>{item.sku} · {item.quantity} дана × {money.format(item.unitPrice)}</small></span><strong>{money.format(item.lineTotal)}</strong></div>)}</div><div className="order-detail-footer"><span>Төлем: <b>{statusLabel[order.paymentStatus] || order.paymentStatus}</b></span><div><button className="reorder-button" onClick={() => onReorder(order)}>Қайта тапсырыс беру</button>{["new", "draft", "submitted"].includes(order.status) && order.warehouseStatus === "new" && <button disabled={busy} onClick={() => onCancel(order.id)}>Бас тарту</button>}</div></div></div>}</article>)}</div>;
}
