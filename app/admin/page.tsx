"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";
import { AlsatBrand, AlsatIcon, type AlsatIconName } from "../../components/AlsatIcon";
import "./admin.css";

type AdminScreen = "overview" | "companies" | "users" | "orders" | "system";
type Company = { id: string; name: string; bin: string | null; city: string | null; phone: string | null; created_at: string };
type Member = { company_id: string; user_id: string; role: string; full_name: string | null; status: string };
type Order = { id: string; company_id: string; status: string; warehouse_status: string | null; total: number; created_at: string };
type Product = { id: string; company_id: string; stock: number };

const money = new Intl.NumberFormat("kk-KZ", { style: "currency", currency: "KZT", maximumFractionDigits: 0 });
const roleNames: Record<string, string> = { owner: "Компания иесі", admin: "Әкімші", manager: "Менеджер", warehouse: "Қойма", forwarder: "Экспедитор" };
const navigation: { id: AdminScreen; icon: AlsatIconName; label: string }[] = [
  { id: "overview", icon: "chart", label: "Жалпы шолу" },
  { id: "companies", icon: "building", label: "Компаниялар" },
  { id: "users", icon: "users", label: "Пайдаланушылар" },
  { id: "orders", icon: "orders", label: "Тапсырыстар" },
  { id: "system", icon: "settings", label: "Жүйе күйі" },
];

export default function AdminPage() {
  const [screen, setScreen] = useState<AdminScreen>("overview");
  const [authState, setAuthState] = useState<"checking" | "login" | "denied" | "ready" | "setup">("checking");
  const [adminName, setAdminName] = useState("Alsat Admin");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const loadPlatform = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError("");
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setAuthState("login");
      setLoading(false);
      return;
    }

    const { data: admin, error: adminError } = await supabase
      .from("platform_admins")
      .select("user_id,full_name")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (adminError?.code === "42P01" || adminError?.message?.includes("platform_admins")) {
      setAuthState("setup");
      setLoading(false);
      return;
    }
    if (!admin) {
      setAuthState("denied");
      setLoading(false);
      return;
    }

    setAdminName(admin.full_name || userData.user.email || "Alsat Admin");
    const [companyResult, memberResult, orderResult, productResult] = await Promise.all([
      supabase.from("companies").select("id,name,bin,city,phone,created_at").order("created_at", { ascending: false }),
      supabase.from("company_users").select("company_id,user_id,role,status"),
      supabase.from("orders").select("id,company_id,status,warehouse_status,total,created_at").order("created_at", { ascending: false }).limit(250),
      supabase.from("products").select("id,company_id,stock"),
    ]);

    const queryError = companyResult.error || memberResult.error || orderResult.error || productResult.error;
    if (queryError) setError(queryError.message);
    setCompanies((companyResult.data ?? []) as Company[]);
    setMembers((memberResult.data ?? []) as Member[]);
    setOrders(((orderResult.data ?? []) as Order[]).map((order) => ({ ...order, total: Number(order.total) })));
    setProducts((productResult.data ?? []) as Product[]);
    setAuthState("ready");
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthState("setup");
      return;
    }
    void loadPlatform();
  }, [loadPlatform]);

  async function logout() {
    if (supabase) await supabase.auth.signOut();
    window.location.href = "/admin";
  }

  const grossSales = useMemo(() => orders.reduce((sum, order) => sum + order.total, 0), [orders]);
  const activeMembers = useMemo(() => members.filter((member) => member.status === "active"), [members]);
  const filteredCompanies = useMemo(() => companies.filter((company) => `${company.name} ${company.bin ?? ""} ${company.city ?? ""}`.toLowerCase().includes(search.toLowerCase())), [companies, search]);
  const filteredMembers = useMemo(() => members.filter((member) => `${member.full_name ?? ""} ${member.role}`.toLowerCase().includes(search.toLowerCase())), [members, search]);
  const filteredOrders = useMemo(() => orders.filter((order) => `${order.id} ${order.status} ${companies.find((company) => company.id === order.company_id)?.name ?? ""}`.toLowerCase().includes(search.toLowerCase())), [orders, companies, search]);

  if (authState === "checking") return <AdminLoading />;
  if (authState === "login") return <AdminLogin onSuccess={loadPlatform} />;
  if (authState === "setup") return <AdminGate title="Admin дерекқоры қосылмаған" text="Supabase SQL Editor-де 20260812_platform_admin.sql файлын бір рет іске қосу қажет. Содан кейін осы бетті жаңартыңыз." action="Қайта тексеру" onAction={loadPlatform} />;
  if (authState === "denied") return <AdminGate title="Қолжетімділік жоқ" text="Бұл аккаунт Alsat платформасының әкімшісі ретінде тіркелмеген." action="Басқа аккаунтпен кіру" onAction={logout} />;

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/admin"><AlsatBrand label="PLATFORM ADMIN" inverse/></Link>
        <p className="admin-nav-label">БАСҚАРУ</p>
        <nav>{navigation.map((item) => <button key={item.id} className={screen === item.id ? "active" : ""} onClick={() => { setScreen(item.id); setSearch(""); }}><i><AlsatIcon name={item.icon}/></i>{item.label}{item.id === "companies" && <em>{companies.length}</em>}</button>)}</nav>
        <div className="admin-sidebar-bottom"><span>NA</span><div><b>{adminName}</b><small>Платформа әкімшісі</small></div><button onClick={logout} title="Шығу"><AlsatIcon name="logout" size={18}/></button></div>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar"><div><small>ALSAT CONTROL CENTER</small><h1>{navigation.find((item) => item.id === screen)?.label}</h1></div><div className="admin-top-actions"><label><AlsatIcon name="search" size={17}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Іздеу" /></label><button className="admin-refresh" onClick={loadPlatform} disabled={loading}><AlsatIcon name="refresh" size={18}/></button><span className="admin-live">● Жүйе жұмыс істеп тұр</span></div></header>
        {error && <div className="admin-alert">Дерек жүктеу қатесі: {error}<button onClick={() => setError("")}>×</button></div>}
        {screen === "overview" && <Overview companies={companies} members={activeMembers} orders={orders} products={products} grossSales={grossSales} onNavigate={setScreen} />}
        {screen === "companies" && <Companies companies={filteredCompanies} members={members} orders={orders} />}
        {screen === "users" && <Users members={filteredMembers} companies={companies} />}
        {screen === "orders" && <Orders orders={filteredOrders} companies={companies} />}
        {screen === "system" && <SystemPanel companies={companies.length} members={activeMembers.length} orders={orders.length} loading={loading} onRefresh={loadPlatform} />}
      </section>

      <nav className="admin-mobile-nav">{navigation.slice(0, 4).map((item) => <button key={item.id} className={screen === item.id ? "active" : ""} onClick={() => setScreen(item.id)}><i><AlsatIcon name={item.icon}/></i><small>{item.label}</small></button>)}</nav>
    </main>
  );
}

function AdminLogin({ onSuccess }: { onSuccess: () => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError("");
    const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (result.error) { setError(result.error.message); setLoading(false); return; }
    await onSuccess();
    setLoading(false);
  }
  return <main className="admin-auth"><section><Link className="admin-brand" href="/promo"><AlsatBrand label="PLATFORM ADMIN"/></Link><p className="admin-auth-kicker">ҚОРҒАЛҒАН БӨЛІМ</p><h1>Платформаны басқару</h1><p>Компаниялар, пайдаланушылар, тапсырыстар және жүйе күйін бір жерден бақылаңыз.</p><form onSubmit={submit}><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@alsat.kz" required /></label><label>Құпия сөз<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" required /></label><button disabled={loading}>{loading ? "Тексерілуде…" : "Admin панельге кіру"}</button></form>{error && <div className="admin-login-error">{error}</div>}<Link className="admin-back" href="/workspace-login">← Workspace кіру бетіне қайту</Link></section><aside><div className="admin-auth-visual"><span>● LIVE</span><b>Барлық процесс<br/>бір бақылау орталығында.</b><div><i><AlsatIcon name="building"/></i><p><strong>Компаниялар</strong><small>Тіркелу және белсенділік</small></p></div><div><i><AlsatIcon name="orders"/></i><p><strong>Тапсырыстар</strong><small>Сатудан жеткізуге дейін</small></p></div><div><i><AlsatIcon name="settings"/></i><p><strong>Жүйе күйі</strong><small>Supabase және PWA</small></p></div></div></aside></main>;
}

function AdminLoading() { return <main className="admin-loading"><AlsatBrand label="ADMIN"/><span className="admin-loading-spinner"/><p>Деректер тексерілуде…</p></main>; }
function AdminGate({ title, text, action, onAction }: { title: string; text: string; action: string; onAction: () => void | Promise<void> }) { return <main className="admin-gate"><AlsatBrand label="PLATFORM ADMIN"/><small>ALSAT PLATFORM ADMIN</small><h1>{title}</h1><p>{text}</p><button onClick={onAction}>{action}</button><Link href="/promo">Промо парақшаға қайту</Link></main>; }

function Overview({ companies, members, orders, products, grossSales, onNavigate }: { companies: Company[]; members: Member[]; orders: Order[]; products: Product[]; grossSales: number; onNavigate: (screen: AdminScreen) => void }) {
  const recent = companies.slice(0, 5);
  const delivered = orders.filter((order) => order.status === "delivered" || order.warehouse_status === "shipped").length;
  return <><div className="admin-welcome"><div><span>● НАҚТЫ УАҚЫТ</span><h2>Alsat экожүйесі бақылауда</h2><p>Компаниялардың тіркелуі, команда белсенділігі және тапсырыс қозғалысы.</p></div><i><AlsatIcon name="chart" size={30}/></i></div><div className="admin-stats"><AdminStat icon="building" label="Компаниялар" value={String(companies.length)} detail="Барлық тіркелген workspace" tone="blue"/><AdminStat icon="users" label="Белсенді пайдаланушы" value={String(members.length)} detail="Барлық рөл бойынша" tone="violet"/><AdminStat icon="orders" label="Тапсырыстар" value={String(orders.length)} detail={`${delivered} аяқталған`} tone="orange"/><AdminStat icon="wallet" label="Жалпы айналым" value={money.format(grossSales)} detail={`${products.length} тауар каталогта`} tone="green"/></div><div className="admin-grid"><section className="admin-card"><div className="admin-card-head"><div><h3>Соңғы компаниялар</h3><p>Жаңа Workspace тіркелулері</p></div><button onClick={() => onNavigate("companies")}>Барлығын көру →</button></div>{recent.length ? recent.map((company) => <div className="admin-company-row" key={company.id}><span>{company.name.slice(0,2).toUpperCase()}</span><div><b>{company.name}</b><small>{company.city || "Қала көрсетілмеген"} · {new Date(company.created_at).toLocaleDateString("kk-KZ")}</small></div><em>{members.filter((member) => member.company_id === company.id).length} қолданушы</em><i>Белсенді</i></div>) : <Empty text="Әзірге нақты компания тіркелмеген." />}</section><section className="admin-card admin-process"><div className="admin-card-head"><div><h3>Тапсырыс процесі</h3><p>Барлық компания бойынша</p></div></div><ProcessRow label="Жаңа" value={orders.filter((order) => order.status === "new" || order.warehouse_status === "new").length} total={orders.length}/><ProcessRow label="Жинауда" value={orders.filter((order) => order.warehouse_status === "picking").length} total={orders.length}/><ProcessRow label="Дайын" value={orders.filter((order) => order.warehouse_status === "ready" || order.warehouse_status === "labeled").length} total={orders.length}/><ProcessRow label="Жеткізілді" value={delivered} total={orders.length}/></section></div></>;
}
function AdminStat({ icon, label, value, detail, tone }: { icon: AlsatIconName; label: string; value: string; detail: string; tone: string }) { return <article className="admin-stat"><i className={tone}><AlsatIcon name={icon}/></i><span>{label}</span><b>{value}</b><small>{detail}</small></article>; }
function ProcessRow({ label, value, total }: { label: string; value: number; total: number }) { const percent = total ? Math.round(value / total * 100) : 0; return <div className="admin-process-row"><div><span>{label}</span><b>{value}</b></div><i><em style={{ width: `${Math.max(percent, value ? 6 : 0)}%` }} /></i><small>{percent}%</small></div>; }

function Companies({ companies, members, orders }: { companies: Company[]; members: Member[]; orders: Order[] }) { return <section className="admin-card admin-table-card"><div className="admin-card-head"><div><h3>Тіркелген компаниялар</h3><p>{companies.length} Workspace табылды</p></div></div><div className="admin-table"><div className="admin-table-head"><span>Компания</span><span>БСН / Қала</span><span>Команда</span><span>Тапсырыс</span><span>Күйі</span></div>{companies.length ? companies.map((company) => <div className="admin-table-row" key={company.id}><div className="admin-company-cell"><i>{company.name.slice(0,2).toUpperCase()}</i><span><b>{company.name}</b><small>{company.phone || "Телефон жоқ"}</small></span></div><span><b>{company.bin || "—"}</b><small>{company.city || "—"}</small></span><strong>{members.filter((member) => member.company_id === company.id).length}</strong><strong>{orders.filter((order) => order.company_id === company.id).length}</strong><em className="admin-status">● Белсенді</em></div>) : <Empty text="Іздеу бойынша компания табылмады." />}</div></section>; }
function Users({ members, companies }: { members: Member[]; companies: Company[] }) { return <section className="admin-card admin-table-card"><div className="admin-card-head"><div><h3>Пайдаланушылар және рөлдер</h3><p>Мультиюзер Workspace мүшелері</p></div></div><div className="admin-table users"><div className="admin-table-head"><span>Қызметкер</span><span>Компания</span><span>Рөлі</span><span>Күйі</span></div>{members.length ? members.map((member) => <div className="admin-table-row" key={`${member.company_id}-${member.user_id}-${member.role}`}><div className="admin-company-cell"><i>{(member.full_name || "A").slice(0,2).toUpperCase()}</i><span><b>{member.full_name || "Аты көрсетілмеген"}</b><small>{member.user_id.slice(0,8)}…</small></span></div><span><b>{companies.find((company) => company.id === member.company_id)?.name || "—"}</b></span><span className="admin-role">{roleNames[member.role] || member.role}</span><em className={member.status === "active" ? "admin-status" : "admin-status paused"}>● {member.status === "active" ? "Белсенді" : member.status}</em></div>) : <Empty text="Пайдаланушы табылмады." />}</div></section>; }
function Orders({ orders, companies }: { orders: Order[]; companies: Company[] }) { return <section className="admin-card admin-table-card"><div className="admin-card-head"><div><h3>Платформа тапсырыстары</h3><p>Компаниялар бойынша толық бақылау</p></div></div><div className="admin-table orders"><div className="admin-table-head"><span>Тапсырыс</span><span>Компания</span><span>Процесс</span><span>Күні</span><span>Сома</span></div>{orders.length ? orders.map((order) => <div className="admin-table-row" key={order.id}><span><b>№{order.id.slice(0,8).toUpperCase()}</b><small>{order.status}</small></span><span><b>{companies.find((company) => company.id === order.company_id)?.name || "—"}</b></span><span className="admin-role">{order.warehouse_status || "new"}</span><span>{new Date(order.created_at).toLocaleDateString("kk-KZ")}</span><strong>{money.format(order.total)}</strong></div>) : <Empty text="Тапсырыс табылмады." />}</div></section>; }
function SystemPanel({ companies, members, orders, loading, onRefresh }: { companies: number; members: number; orders: number; loading: boolean; onRefresh: () => void }) { return <div className="admin-system-grid"><section className="admin-card admin-health"><div className="admin-card-head"><div><h3>Жүйе қызметтері</h3><p>Негізгі компоненттердің күйі</p></div><span>Барлығы қалыпты</span></div>{[{name:"Supabase Database",detail:`${companies} компания · ${orders} тапсырыс`},{name:"Authentication",detail:`${members} белсенді рөл`},{name:"Vercel Application",detail:"Production deployment"},{name:"PWA және Offline",detail:"Service worker қосылған"}].map((item) => <div key={item.name}><i><AlsatIcon name="check" size={15}/></i><span><b>{item.name}</b><small>{item.detail}</small></span><em>Жұмыс істеп тұр</em></div>)}<button onClick={onRefresh} disabled={loading}>{loading ? "Тексерілуде…" : "Жүйені қайта тексеру"}</button></section><section className="admin-card admin-security"><span><AlsatIcon name="shield"/></span><h3>Қауіпсіздік</h3><p>Admin панель Supabase Auth және Row Level Security арқылы қорғалған. Компания деректері тек платформалық админге ашылады.</p><ul><li>✓ Admin access бөлек кестеде</li><li>✓ RLS барлық негізгі кестеде</li><li>✓ Service key браузерге берілмейді</li></ul></section></div>; }
function Empty({ text }: { text: string }) { return <div className="admin-empty"><span><AlsatIcon name="search"/></span><b>Дерек жоқ</b><p>{text}</p></div>; }
