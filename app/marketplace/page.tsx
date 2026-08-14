"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { getWorkspaceIdentity } from "../../lib/workspace-auth";
import { type CatalogProduct, demoProducts, money, normalizeProduct } from "../../lib/marketplace-products";
import "./marketplace.css";

type CheckoutStore = { id: string; name: string; address: string; contactName: string; phone: string };

const cartStorageKey = "alsat-marketplace-cart-v1";

const popularCategories = [
  { title: "Өнеркәсіп жабдықтары", category: "Өнеркәсіп және бизнес", icon: "⚙" },
  { title: "Құрылыс және жөндеу", category: "Құрылыс және жөндеу", icon: "▦" },
  { title: "Электроника және техника", category: "Электроника және техника", icon: "⌁" },
  { title: "Кеңсе және қағаз өнімдері", category: "Үй, жиһаз және бақша", icon: "▤" },
  { title: "Тұрмыстық тауарлар және химия", category: "Үй, жиһаз және бақша", icon: "♧" },
  { title: "Қаптама және ыдыстар", category: "Өнеркәсіп және бизнес", icon: "▣" },
  { title: "Киім және қорғаныс құралдары", category: "Өнеркәсіп және бизнес", icon: "♙" },
  { title: "Азық-түлік және сусындар", category: "Азық-түлік және сусындар", icon: "▥" },
] as const;

const trustBenefits = [
  { icon: "⌾", title: "Сенімді жеткізушілер", text: "Тексерілген серіктестер" },
  { icon: "♢", title: "Ыңғайлы шарттар", text: "Ең жақсы бағалар" },
  { icon: "▱", title: "Жылдам жеткізу", text: "Уақытында және сапалы" },
  { icon: "▣", title: "Қауіпсіз төлем", text: "100% қорғаныс" },
] as const;

const platformBenefits = [
  { icon: "⌬", title: "B2B үшін арнайы", text: "Шағын және орта бизнеске арналған шешімдер" },
  { icon: "◎", title: "Кең таңдау", text: "Мыңдаған тауар және жеткізушілер" },
  { icon: "♙", title: "Жеке менеджер", text: "Сізге жеке қолдау көрсетеміз" },
  { icon: "◌", title: "Ыңғайлы интерфейс", text: "Тез іздеу және оңай тапсырыс беру" },
] as const;

const brandNames = ["BOSCH", "3M", "Makita", "TORK", "PHILIPS", "NESCAFÉ"];

export default function MarketplacePage() {
  const [products, setProducts] = useState<CatalogProduct[]>(demoProducts);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Барлығы");
  const [subcategory, setSubcategory] = useState("Барлығы");
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutSuccess, setCheckoutSuccess] = useState("");
  const [checkoutStores, setCheckoutStores] = useState<CheckoutStore[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [sellerCompanyId, setSellerCompanyId] = useState("");
  const [newStore, setNewStore] = useState({ name: "", address: "", contactName: "", phone: "" });
  const [checkoutNote, setCheckoutNote] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(Boolean(supabase));
  const [usingDemo, setUsingDemo] = useState(!supabase);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(cartStorageKey) || "{}");
      if (saved && typeof saved === "object") {
        const safeCart = Object.fromEntries(Object.entries(saved).filter(([id, quantity]) => typeof id === "string" && Number.isFinite(Number(quantity)) && Number(quantity) > 0).map(([id, quantity]) => [id, Math.floor(Number(quantity))]));
        setCart(safeCart);
      }
    } catch { /* Keep an empty cart if the previous browser cache is invalid. */ }
  }, []);

  useEffect(() => {
    localStorage.setItem(cartStorageKey, JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    let active = true;
    async function loadCatalog() {
      if (!supabase) { setLoading(false); return; }
      const result = await supabase
        .from("products")
        .select("id,company_id,name,sku,price,stock,category,subcategory,brand,description,bullet_points,unit,image_urls,marketplace_title,marketplace_description,marketplace_category,marketplace_subcategory,marketplace_image_url,image_url,marketplace_min_order")
        .eq("workspace_active", true)
        .eq("marketplace_published", true)
        .gt("stock", 0)
        .order("created_at", { ascending: false });
      if (!active) return;
      if (!result.error && result.data?.length) {
        setProducts((result.data as Record<string, unknown>[]).map(normalizeProduct));
        setUsingDemo(false);
      } else if (result.error) {
        setNotice("Marketplace каталогына migration қосылған соң нақты тауарлар көрінеді. Қазір демо каталог ашылды.");
      } else {
        setProducts(demoProducts);
        setUsingDemo(true);
      }
      setLoading(false);
    }
    void loadCatalog();
    return () => { active = false; };
  }, []);

  const visibleProducts = useMemo(() => products.filter((product) => {
    const matchesQuery = `${product.name} ${product.sku} ${product.brand} ${product.category} ${product.subcategory}`.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = category === "Барлығы" || product.category === category;
    const matchesSubcategory = subcategory === "Барлығы" || product.subcategory === subcategory;
    return matchesQuery && matchesCategory && matchesSubcategory;
  }), [category, products, query, subcategory]);
  const cartLines = useMemo(() => Object.entries(cart).map(([id, quantity]) => {
    const product = products.find((item) => item.id === id);
    return product ? { product, quantity } : null;
  }).filter((line): line is { product: CatalogProduct; quantity: number } => Boolean(line)), [cart, products]);
  const cartCount = cartLines.reduce((sum, line) => sum + line.quantity, 0);
  const cartTotal = cartLines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);

  function addToCart(product: CatalogProduct, amount = product.minOrder) {
    setCart((current) => ({ ...current, [product.id]: Math.min(product.stock, (current[product.id] || 0) + amount) }));
    setNotice(`${product.name} себетке қосылды`);
  }

  function changeQuantity(product: CatalogProduct, delta: number) {
    setCart((current) => {
      const next = Math.max(0, Math.min(product.stock, (current[product.id] || 0) + delta));
      const copy = { ...current };
      if (next === 0) delete copy[product.id]; else copy[product.id] = next;
      return copy;
    });
  }

  async function openCheckout() {
    setCheckoutError("");
    setCheckoutSuccess("");
    setSellerCompanyId("");
    if (!cartLines.length) return;
    if (cartLines.some((line) => line.product.id.startsWith("demo-"))) {
      setNotice("Нақты тапсырыс үшін алдымен Supabase migration-ын қосып, жарияланған тауарды таңдаңыз.");
      return;
    }
    if (!supabase) {
      setNotice("Тапсырыс беру үшін Supabase және Workspace авторизациясы қажет.");
      return;
    }
    const companyIds = [...new Set(cartLines.map((line) => line.product.companyId).filter((id): id is string => Boolean(id)))];
    if (companyIds.length !== 1) {
      setCheckoutError("Бір тапсырысқа бір компанияның тауарларын ғана қосуға болады. Себетті бөліп рәсімдеңіз.");
      setCheckoutOpen(true);
      return;
    }
    setCheckoutLoading(true);
    const identity = await getWorkspaceIdentity();
    const membership = identity.memberships.find((item) => item.company_id === companyIds[0] && ["owner", "admin", "manager"].includes(item.role));
    if (!identity.user || !membership) {
      setCheckoutError("Бұл Marketplace тапсырысын жіберу үшін тиісті Alsat Workspace-ке кіріңіз.");
      setCheckoutOpen(true);
      setCheckoutLoading(false);
      return;
    }
    setSellerCompanyId(membership.company_id);
    const { data, error } = await supabase.from("customers").select("id,name,address,contact_name,phone").eq("company_id", membership.company_id).order("created_at", { ascending: false });
    if (error) setCheckoutError(error.message);
    const stores = (data ?? []).map((store) => ({ id: store.id, name: store.name, address: store.address ?? "", contactName: store.contact_name ?? "", phone: store.phone ?? "" }));
    setCheckoutStores(stores);
    setSelectedStoreId(stores[0]?.id ?? "");
    setCheckoutOpen(true);
    setCartOpen(false);
    setCheckoutLoading(false);
  }

  async function submitCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCheckoutError("");
    if (!supabase || !sellerCompanyId) { setCheckoutError("Workspace компаниясы анықталмады. Қайта кіріп көріңіз."); return; }
    setCheckoutLoading(true);
    try {
      let storeId = selectedStoreId;
      if (!storeId) {
        if (!newStore.name.trim() || !newStore.address.trim() || !newStore.phone.trim()) throw new Error("Дүкен атауы, мекенжайы және телефон нөмірі міндетті.");
        const { data: createdStore, error: storeError } = await supabase.from("customers").insert({ company_id: sellerCompanyId, name: newStore.name.trim(), address: newStore.address.trim(), contact_name: newStore.contactName.trim() || null, phone: newStore.phone.trim() }).select("id").single();
        if (storeError || !createdStore) throw new Error(storeError?.message || "Дүкенді сақтау мүмкін болмады.");
        storeId = createdStore.id;
      }
      const { data: order, error: orderError } = await supabase.from("orders").insert({ company_id: sellerCompanyId, customer_id: storeId, status: "new", warehouse_status: "new", total: cartTotal, source: "marketplace", marketplace_note: checkoutNote.trim() || null }).select("id").single();
      if (orderError || !order) throw new Error(orderError?.message || "Тапсырысты сақтау мүмкін болмады.");
      const { error: itemsError } = await supabase.from("order_items").insert(cartLines.map((line) => ({ company_id: sellerCompanyId, order_id: order.id, product_id: line.product.id, quantity: line.quantity, unit_price: line.product.price, commission_amount: 0 })));
      if (itemsError) throw new Error(`Тапсырыс жасалды, бірақ тауар жолдары сақталмады: ${itemsError.message}`);
      setCart({});
      setCheckoutSuccess(order.id.slice(0, 8).toUpperCase());
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Тапсырыс жасау мүмкін болмады.");
    } finally {
      setCheckoutLoading(false);
    }
  }

  return <main className="marketplace-shell">
    <div className="marketplace-page">
      <header className="marketplace-header">
        <Link className="marketplace-logo" href="/" aria-label="Alsat Marketplace басты беті"><span className="alsat-mark"/><div><strong>ALSAT</strong><small>MARKETPLACE</small></div></Link>
        <button className="catalog-menu-button" onClick={() => document.getElementById("popular-categories")?.scrollIntoView({ behavior: "smooth" })}><span>☰</span>Каталог</button>
        <label className="marketplace-search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Тауарларды іздеу"/><span>⌕</span></label>
        <div className="marketplace-header-actions"><button className="language-button">KZ⌄</button><button className="header-icon" aria-label="Таңдаулылар">♡</button><button className="header-icon header-cart" onClick={() => setCartOpen(true)} aria-label="Себет">♧{cartCount > 0 && <b>{cartCount}</b>}</button><Link className="marketplace-login" href="/workspace-login">Кіру / Тіркелу</Link></div>
      </header>

      <div className="mobile-search-row"><label className="marketplace-search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Тауарларды іздеу"/><span>⌕</span></label></div>

      <section className="marketplace-hero">
        <div className="hero-copy"><h1>Бизнесіңе арналған<br/>бәрі бір жерде</h1><p>Алсат маркетплейсі – бизнесті дамытуға арналған сенімді B2B платформа</p><div className="hero-actions desktop-hero-actions"><a className="primary-cta" href="#offers">Каталогты қарау</a><Link className="secondary-cta" href="/workspace-signup">Жеткізуші болу</Link></div></div>
        <div className="hero-visual"><img src="/marketplace/hero-container-v1.png" alt="Жасыл жүк контейнері және тауар қораптары"/><div className="container-brand"><span className="alsat-mark white"/><b>ALSAT<small>MARKETPLACE</small></b></div></div>
        <div className="hero-actions mobile-hero-actions"><a className="primary-cta" href="#offers">Каталогты қарау</a><Link className="secondary-cta" href="/workspace-signup">Жеткізуші болу</Link></div>
      </section>

      <section className="trust-strip" id="benefits">{trustBenefits.map((item) => <article key={item.title}><i>{item.icon}</i><div><strong>{item.title}</strong><span>{item.text}</span></div><b>›</b></article>)}</section>

      <section className="marketplace-section categories-section" id="popular-categories">
        <div className="marketplace-section-head"><h2>Популярлы категориялар</h2><button onClick={() => { setCategory("Барлығы"); setSubcategory("Барлығы"); document.getElementById("offers")?.scrollIntoView({ behavior: "smooth" }); }}>Барлық категориялар</button></div>
        <div className="popular-category-grid">{popularCategories.map((item, index) => <button key={item.title} className={category === item.category ? "category-card active" : "category-card"} onClick={() => { setCategory(item.category); setSubcategory("Барлығы"); document.getElementById("offers")?.scrollIntoView({ behavior: "smooth" }); }}><span className={`category-art category-art-${index}`}/><i>{item.icon}</i><strong>{item.title}</strong></button>)}</div>
      </section>

      <section className="why-section marketplace-section">
        <h2>Неге Алсат маркетплейсі?</h2>
        <div className="why-grid">{platformBenefits.map((item) => <article key={item.title}><i>{item.icon}</i><div><strong>{item.title}</strong><span>{item.text}</span></div></article>)}</div>
      </section>

      <section className="supplier-banner"><div><h2>Жеткізуші болыңыз<br/>және бизнесіңізді өсіріңіз</h2><p>Алсат маркетплейсінде өз тауарларыңызды ұсыныңыз және жаңа клиенттерге қол жеткізіңіз</p><Link href="/workspace-signup">Толығырақ</Link></div></section>

      <section className="marketplace-section offers-section" id="offers">
        <div className="marketplace-section-head"><div><h2>Танымал ұсыныстар</h2>{category !== "Барлығы" && <span>{category}</span>}</div><button onClick={() => { setCategory("Барлығы"); setSubcategory("Барлығы"); }}>Барлығын көру</button></div>
        {loading && <div className="marketplace-loading">Каталог жүктелуде…</div>}
        {!loading && !visibleProducts.length && <div className="marketplace-empty"><strong>Тауар табылмады</strong><span>Іздеу сөзін немесе категорияны өзгертіп көріңіз.</span><button onClick={() => { setQuery(""); setCategory("Барлығы"); }}>Барлығын көрсету</button></div>}
        <div className="showcase-grid">{visibleProducts.slice(0, 5).map((product, index) => <article className="showcase-card" key={product.id}><button className="favorite-button" aria-label="Таңдаулыларға қосу">♡</button><Link className={product.imageUrl ? "showcase-visual has-image" : `showcase-visual showcase-art-${index % 5}`} href={`/marketplace/product/${encodeURIComponent(product.id)}`} aria-label={`${product.name} парақшасын ашу`}>{product.imageUrl && <img src={product.imageUrl} alt=""/>}</Link><div className="showcase-copy"><small>{product.brand || product.category}</small><h3><Link className="showcase-title-link" href={`/marketplace/product/${encodeURIComponent(product.id)}`}>{product.name}</Link></h3><span>{product.minOrder > 1 ? `Мин. ${product.minOrder} ${product.unit}` : product.subcategory}</span><strong>{money.format(product.price)}</strong><button onClick={() => addToCart(product)}>Себетке қосу</button></div></article>)}</div>
        <div className="slider-dots"><i className="active"/><i/><i/></div>
      </section>

      <section className="brand-section marketplace-section"><div className="marketplace-section-head"><h2>Сенімді брендтер</h2><div><button aria-label="Алдыңғы бренд">‹</button><button aria-label="Келесі бренд">›</button></div></div><div className="brand-rail">{brandNames.map((brand) => <strong key={brand}>{brand}</strong>)}</div><div className="slider-dots"><i className="active"/><i/><i/></div></section>

      <footer className="marketplace-footer">
        <div className="footer-grid"><div className="footer-brand"><Link className="marketplace-logo light" href="/"><span className="alsat-mark white"/><div><strong>ALSAT</strong><small>MARKETPLACE</small></div></Link><p>Алсат маркетплейсі – бизнеске арналған сенімді B2B платформа</p><div className="socials"><span>f</span><span>◎</span><span>in</span></div></div><div><strong>Компания</strong><Link href="/promo">Біз туралы</Link><Link href="/workspace-signup">Жеткізушілерге</Link><Link href="/legal/terms">Платформа ережелері</Link><Link href="/legal/offer">Жария оферта</Link></div><div><strong>Көмек</strong><Link href="/legal/payment">Төлем және қауіпсіздік</Link><Link href="/legal/delivery">Жеткізу шарттары</Link><Link href="/legal/refund">Қайтару және бас тарту</Link><Link href="/legal/contacts">Байланыс</Link></div><div><strong>Жеке кабинет</strong><Link href="/workspace-login">Тапсырыстарым</Link><Link href="/workspace-login">Таңдаулылар</Link><Link href="/workspace-login">Хабарламалар</Link><Link href="/workspace-login">Профиль</Link></div><div className="footer-contacts"><strong>Байланыс</strong><a href="tel:+77003003009">+7 (700) 300-30-09</a><a href="mailto:info@alsat.kz">info@alsat.kz</a><span>Алматы қ., Айналмалы көшесі, 69А</span><span>Дс–Жм: 09:00–18:00</span></div></div>
        <div className="legal-requisites"><strong>Жүйе иесі: «Krausz &amp; Deisler» ЖШС</strong><span>БСН 090740009232</span><span>Қазақстан Республикасы, Алматы қ., Айналмалы көшесі, 69А</span><span>Тел.: +7 (700) 300-30-09</span><span>Email: info@alsat.kz</span></div>
        <div className="payment-readiness"><div><b>Freedom Pay</b><span>Интернет-эквайрингке дайын</span></div><span>Төлемдер теңгемен жүргізіледі. Карта деректері Alsat серверлерінде сақталмайды; төлем қосылғаннан кейін Freedom Pay қорғалған бетінде өңделеді.</span></div>
        <div className="footer-bottom"><span>© 2026 Alsat Marketplace. Барлық құқықтар қорғалған.</span><div><Link href="/legal/offer">Пайдаланушы келісімі</Link><Link href="/legal/privacy">Құпиялық саясаты</Link><Link href="/legal/cookies">Cookie саясаты</Link></div></div>
      </footer>
    </div>
    <nav className="mobile-marketplace-nav"><a href="#" className="active"><i>⌂</i><span>Басты бет</span></a><a href="#popular-categories"><i>▦</i><span>Каталог</span></a><button onClick={() => setCartOpen(true)}><i>♧</i><span>Себет</span>{cartCount > 0 && <b>{cartCount}</b>}</button><button><i>♡</i><span>Таңдаулар</span></button><Link href="/workspace-login"><i>♙</i><span>Профиль</span></Link></nav>
    {notice && <div className="marketplace-toast">{notice}<button onClick={() => setNotice("")}>×</button></div>}

    {cartOpen && <div className="marketplace-overlay" onClick={() => setCartOpen(false)}><aside className="marketplace-cart" onClick={(event) => event.stopPropagation()}><div className="cart-head"><div><span className="marketplace-kicker">ALSAT MARKETPLACE</span><h2>Себет</h2></div><button className="modal-close" onClick={() => setCartOpen(false)}>×</button></div>{cartLines.length ? <><div className="cart-lines">{cartLines.map(({ product, quantity }) => <div className="cart-line" key={product.id}><div className="cart-line-visual">▣</div><div className="cart-line-copy"><strong>{product.name}</strong><small>{money.format(product.price)}</small><div className="quantity-control"><button onClick={() => changeQuantity(product, -1)}>−</button><b>{quantity}</b><button onClick={() => changeQuantity(product, 1)}>+</button></div></div><strong>{money.format(product.price * quantity)}</strong></div>)}</div><div className="cart-summary"><span>Барлығы <b>{cartCount} дана</b></span><strong>{money.format(cartTotal)}</strong></div><button className="modal-primary" onClick={() => void openCheckout()} disabled={checkoutLoading}>{checkoutLoading ? "Тексерілуде…" : "Тапсырысты рәсімдеу →"}</button><small className="cart-hint">Тапсырыс жасалғанда ол бірден Alsat қоймасының жұмыс тізбегіне түседі.</small></> : <div className="cart-empty"><span>🛒</span><strong>Себет бос</strong><small>Каталогтан тауар қосыңыз.</small><button className="modal-primary" onClick={() => setCartOpen(false)}>Каталогқа оралу</button></div>}</aside></div>}
    {checkoutOpen && <div className="marketplace-overlay" onClick={() => setCheckoutOpen(false)}><section className="checkout-modal" onClick={(event) => event.stopPropagation()}><div className="cart-head"><div><span className="marketplace-kicker">ALSAT MARKETPLACE</span><h2>{checkoutSuccess ? "Тапсырыс қабылданды" : "Тапсырысты рәсімдеу"}</h2></div><button className="modal-close" onClick={() => setCheckoutOpen(false)}>×</button></div>{checkoutSuccess ? <div className="checkout-success"><span>✓</span><strong>№{checkoutSuccess}</strong><p>Тапсырыс қоймаға жіберілді. Қоймашы қабылдағаннан кейін QR стикер мен накладной дайындалады.</p><button className="modal-primary" onClick={() => { setCheckoutOpen(false); setCheckoutSuccess(""); }}>Marketplace-ке оралу</button></div> : checkoutError && !sellerCompanyId ? <div className="checkout-auth-error"><strong>Workspace-ке кіру қажет</strong><p>{checkoutError}</p><Link className="modal-primary" href="/workspace-login">Workspace-ке кіру →</Link></div> : <form className="checkout-form" onSubmit={submitCheckout}>{checkoutError && <div className="checkout-error">{checkoutError}</div>}{checkoutStores.length > 0 && <label>Дүкенді таңдаңыз<select value={selectedStoreId} onChange={(event) => setSelectedStoreId(event.target.value)}><option value="">+ Жаңа дүкен қосу</option>{checkoutStores.map((store) => <option value={store.id} key={store.id}>{store.name} · {store.address}</option>)}</select></label>}{!selectedStoreId && <><label>Дүкен атауы<input required value={newStore.name} onChange={(event) => setNewStore((current) => ({ ...current, name: event.target.value }))} placeholder="Строймаг"/></label><label>Мекенжай<input required value={newStore.address} onChange={(event) => setNewStore((current) => ({ ...current, address: event.target.value }))} placeholder="Алматы қ., Райымбек 348"/></label><div className="checkout-two"><label>Байланыс тұлғасы<input value={newStore.contactName} onChange={(event) => setNewStore((current) => ({ ...current, contactName: event.target.value }))} placeholder="Нұрлан Ә."/></label><label>Телефон<input required value={newStore.phone} onChange={(event) => setNewStore((current) => ({ ...current, phone: event.target.value }))} placeholder="+7 700 000 00 00"/></label></div></>}<label>Ескерту<textarea value={checkoutNote} onChange={(event) => setCheckoutNote(event.target.value)} placeholder="Жеткізу бойынша қосымша ақпарат"/></label><div className="checkout-total"><span>Тапсырыс сомасы</span><strong>{money.format(cartTotal)}</strong></div><button className="modal-primary" disabled={checkoutLoading}>{checkoutLoading ? "Жіберілуде…" : "Тапсырысты қоймаға жіберу →"}</button></form>}</section></div>}
    {usingDemo && <div className="marketplace-demo-badge">Демо каталог</div>}
  </main>;
}

