"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { type CatalogProduct, demoProducts, money } from "../../lib/marketplace-products";
import { addCartItem, type BuyerProfile, type DeliveryAddress, getMarketplaceUser, loadBuyerProfile, loadFavoriteIds, loadMarketplaceCatalog, placeMarketplaceCheckout, readCart, setFavorite, writeCart } from "../../lib/marketplace-commerce";
import "./marketplace.css";

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
  const [favorites, setFavorites] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Барлығы");
  const [subcategory, setSubcategory] = useState("Барлығы");
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutSuccess, setCheckoutSuccess] = useState("");
  const [checkoutOrderCount, setCheckoutOrderCount] = useState(0);
  const [checkoutAuthenticated, setCheckoutAuthenticated] = useState(false);
  const [checkoutProfile, setCheckoutProfile] = useState<BuyerProfile>({ businessName: "", bin: "", contactName: "", phone: "", email: "" });
  const [checkoutAddress, setCheckoutAddress] = useState<DeliveryAddress>({ label: "Негізгі мекенжай", city: "Алматы", address: "", contactName: "", phone: "", save: true });
  const [savedAddresses, setSavedAddresses] = useState<DeliveryAddress[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"invoice" | "card" | "cashless">("invoice");
  const [checkoutNote, setCheckoutNote] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(Boolean(supabase));
  const [usingDemo, setUsingDemo] = useState(!supabase);

  useEffect(() => {
    setCart(readCart());
    void loadFavoriteIds().then(setFavorites);
    if (new URLSearchParams(window.location.search).get("cart") === "open") setCartOpen(true);
  }, []);

  useEffect(() => {
    writeCart(cart);
  }, [cart]);

  useEffect(() => {
    let active = true;
    async function loadCatalog() {
      if (!supabase) { setLoading(false); return; }
      const result = await loadMarketplaceCatalog();
      if (!active) return;
      if (result.products.length) {
        setProducts(result.products);
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
    setCart((current) => addCartItem(current, product, amount));
    setNotice(`${product.name} себетке қосылды`);
  }

  async function toggleFavorite(product: CatalogProduct) {
    const active = !favorites.includes(product.id);
    setFavorites((current) => active ? [...new Set([...current, product.id])] : current.filter((id) => id !== product.id));
    await setFavorite(product.id, active);
    setNotice(active ? `${product.name} таңдаулыларға қосылды` : `${product.name} таңдаулылардан алынды`);
  }

  function changeQuantity(product: CatalogProduct, delta: number) {
    setCart((current) => {
      const step = Math.max(1, product.minOrder);
      const maximum = Math.min(product.stock, product.maxOrder || product.stock);
      const next = Math.max(0, Math.min(maximum, (current[product.id] || 0) + delta * step));
      const copy = { ...current };
      if (next === 0) delete copy[product.id]; else copy[product.id] = next;
      return copy;
    });
  }

  async function openCheckout() {
    setCheckoutError("");
    setCheckoutSuccess("");
    setCheckoutAuthenticated(false);
    if (!cartLines.length) return;
    if (cartLines.some((line) => line.product.id.startsWith("demo-"))) {
      setNotice("Нақты тапсырыс үшін алдымен Supabase migration-ын қосып, жарияланған тауарды таңдаңыз.");
      return;
    }
    if (!supabase) {
      setNotice("Тапсырыс беру үшін Marketplace аккаунты қажет.");
      return;
    }
    setCheckoutLoading(true);
    const user = await getMarketplaceUser();
    if (!user) {
      setCheckoutError("Тапсырысты рәсімдеу үшін Marketplace аккаунтына кіріңіз.");
      setCheckoutOpen(true);
      setCheckoutLoading(false);
      return;
    }
    const buyer = await loadBuyerProfile(user);
    setCheckoutProfile(buyer.profile);
    setSavedAddresses(buyer.addresses);
    const defaultAddress = buyer.addresses[0];
    setCheckoutAddress(defaultAddress || { label: "Негізгі мекенжай", city: "Алматы", address: "", contactName: buyer.profile.contactName, phone: buyer.profile.phone, save: true });
    setCheckoutAuthenticated(true);
    setCheckoutOpen(true);
    setCartOpen(false);
    setCheckoutLoading(false);
  }

  async function submitCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCheckoutError("");
    if (!checkoutAuthenticated) { setCheckoutError("Marketplace аккаунтына қайта кіріңіз."); return; }
    setCheckoutLoading(true);
    try {
      if (!checkoutProfile.businessName.trim() || !checkoutProfile.contactName.trim() || !checkoutProfile.phone.trim()) throw new Error("Компания атауы, байланыс тұлғасы және телефон міндетті.");
      if (!checkoutAddress.city.trim() || !checkoutAddress.address.trim()) throw new Error("Қала мен жеткізу мекенжайы міндетті.");
      const result = await placeMarketplaceCheckout({ profile: checkoutProfile, address: checkoutAddress, lines: cartLines, note: checkoutNote, paymentMethod });
      setCart({});
      setCheckoutOrderCount(result.orders.length);
      setCheckoutSuccess(result.checkoutGroupId.slice(0, 8).toUpperCase());
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
        <Link className="catalog-menu-button" href="/marketplace/catalog"><span>☰</span>Каталог</Link>
        <label className="marketplace-search"><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if(event.key === "Enter") window.location.href=`/marketplace/catalog?q=${encodeURIComponent(query)}`; }} placeholder="Тауарларды іздеу"/><span>⌕</span></label>
        <div className="marketplace-header-actions"><button className="language-button">KZ⌄</button><Link className="header-icon" href="/marketplace/account?tab=favorites" aria-label="Таңдаулылар">♡</Link><button className="header-icon header-cart" onClick={() => setCartOpen(true)} aria-label="Себет">♧{cartCount > 0 && <b>{cartCount}</b>}</button><Link className="marketplace-login" href="/marketplace/account">Кіру / Тіркелу</Link></div>
      </header>

      <div className="mobile-search-row"><label className="marketplace-search"><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if(event.key === "Enter") window.location.href=`/marketplace/catalog?q=${encodeURIComponent(query)}`; }} placeholder="Тауарларды іздеу"/><span>⌕</span></label></div>

      <section className="marketplace-hero">
        <div className="hero-copy"><h1>Бизнесіңе арналған<br/>бәрі бір жерде</h1><p>Алсат маркетплейсі – бизнесті дамытуға арналған сенімді B2B платформа</p><div className="hero-actions desktop-hero-actions"><Link className="primary-cta" href="/marketplace/catalog">Каталогты қарау</Link><Link className="secondary-cta" href="/workspace-signup">Жеткізуші болу</Link></div></div>
        <div className="hero-visual"><img src="/marketplace/hero-container-v1.png" alt="Жасыл жүк контейнері және тауар қораптары"/><div className="container-brand"><span className="alsat-mark white"/><b>ALSAT<small>MARKETPLACE</small></b></div></div>
        <div className="hero-actions mobile-hero-actions"><Link className="primary-cta" href="/marketplace/catalog">Каталогты қарау</Link><Link className="secondary-cta" href="/workspace-signup">Жеткізуші болу</Link></div>
      </section>

      <section className="trust-strip" id="benefits">{trustBenefits.map((item) => <article key={item.title}><i>{item.icon}</i><div><strong>{item.title}</strong><span>{item.text}</span></div><b>›</b></article>)}</section>

      <section className="marketplace-section categories-section" id="popular-categories">
        <div className="marketplace-section-head"><h2>Популярлы категориялар</h2><Link className="section-link-button" href="/marketplace/catalog">Барлық категориялар</Link></div>
        <div className="popular-category-grid">{popularCategories.map((item, index) => <button key={item.title} className={category === item.category ? "category-card active" : "category-card"} onClick={() => { setCategory(item.category); setSubcategory("Барлығы"); document.getElementById("offers")?.scrollIntoView({ behavior: "smooth" }); }}><span className={`category-art category-art-${index}`}/><i>{item.icon}</i><strong>{item.title}</strong></button>)}</div>
      </section>

      <section className="why-section marketplace-section">
        <h2>Неге Алсат маркетплейсі?</h2>
        <div className="why-grid">{platformBenefits.map((item) => <article key={item.title}><i>{item.icon}</i><div><strong>{item.title}</strong><span>{item.text}</span></div></article>)}</div>
      </section>

      <section className="supplier-banner"><div><h2>Жеткізуші болыңыз<br/>және бизнесіңізді өсіріңіз</h2><p>Алсат маркетплейсінде өз тауарларыңызды ұсыныңыз және жаңа клиенттерге қол жеткізіңіз</p><Link href="/workspace-signup">Толығырақ</Link></div></section>

      <section className="marketplace-section offers-section" id="offers">
        <div className="marketplace-section-head"><div><h2>Танымал ұсыныстар</h2>{category !== "Барлығы" && <span>{category}</span>}</div><Link className="section-link-button" href="/marketplace/catalog">Барлығын көру</Link></div>
        {loading && <div className="marketplace-loading">Каталог жүктелуде…</div>}
        {!loading && !visibleProducts.length && <div className="marketplace-empty"><strong>Тауар табылмады</strong><span>Іздеу сөзін немесе категорияны өзгертіп көріңіз.</span><button onClick={() => { setQuery(""); setCategory("Барлығы"); }}>Барлығын көрсету</button></div>}
        <div className="showcase-grid">{visibleProducts.slice(0, 5).map((product, index) => <article className="showcase-card" key={product.id}><button className={favorites.includes(product.id) ? "favorite-button active" : "favorite-button"} onClick={() => void toggleFavorite(product)} aria-label="Таңдаулыларға қосу">{favorites.includes(product.id) ? "♥" : "♡"}</button><Link className={product.imageUrl ? "showcase-visual has-image" : `showcase-visual showcase-art-${index % 5}`} href={`/marketplace/product/${encodeURIComponent(product.id)}`} aria-label={`${product.name} парақшасын ашу`}>{product.imageUrl && <img src={product.imageUrl} alt=""/>}</Link><div className="showcase-copy"><small>{product.brand || product.category}</small><h3><Link className="showcase-title-link" href={`/marketplace/product/${encodeURIComponent(product.id)}`}>{product.name}</Link></h3><span>{product.minOrder > 1 ? `Мин. ${product.minOrder} ${product.unit}` : product.subcategory}</span><strong>{money.format(product.price)}</strong><button onClick={() => addToCart(product)}>Себетке қосу</button></div></article>)}</div>
        <div className="slider-dots"><i className="active"/><i/><i/></div>
      </section>

      <section className="brand-section marketplace-section"><div className="marketplace-section-head"><h2>Сенімді брендтер</h2><div><button aria-label="Алдыңғы бренд">‹</button><button aria-label="Келесі бренд">›</button></div></div><div className="brand-rail">{brandNames.map((brand) => <strong key={brand}>{brand}</strong>)}</div><div className="slider-dots"><i className="active"/><i/><i/></div></section>

      <footer className="marketplace-footer">
        <div className="footer-grid"><div className="footer-brand"><Link className="marketplace-logo light" href="/"><span className="alsat-mark white"/><div><strong>ALSAT</strong><small>MARKETPLACE</small></div></Link><p>Алсат маркетплейсі – бизнеске арналған сенімді B2B платформа</p><div className="socials"><span>f</span><span>◎</span><span>in</span></div></div><div><strong>Компания</strong><Link href="/promo">Біз туралы</Link><Link href="/workspace-signup">Жеткізушілерге</Link><Link href="/legal/terms">Платформа ережелері</Link><Link href="/legal/offer">Жария оферта</Link></div><div><strong>Көмек</strong><Link href="/legal/payment">Төлем және қауіпсіздік</Link><Link href="/legal/delivery">Жеткізу шарттары</Link><Link href="/legal/refund">Қайтару және бас тарту</Link><Link href="/legal/contacts">Байланыс</Link></div><div><strong>Жеке кабинет</strong><Link href="/marketplace/account?tab=orders">Тапсырыстарым</Link><Link href="/marketplace/account?tab=favorites">Таңдаулылар</Link><Link href="/marketplace/account">Компания профилі</Link><Link href="/workspace-login">Workspace</Link></div><div className="footer-contacts"><strong>Байланыс</strong><a href="tel:+77003003009">+7 (700) 300-30-09</a><a href="mailto:info@alsat.kz">info@alsat.kz</a><span>Алматы қ., Айналмалы көшесі, 69А</span><span>Дс–Жм: 09:00–18:00</span></div></div>
        <div className="legal-requisites"><strong>Жүйе иесі: «Krausz &amp; Deisler» ЖШС</strong><span>БСН 090740009232</span><span>Қазақстан Республикасы, Алматы қ., Айналмалы көшесі, 69А</span><span>Тел.: +7 (700) 300-30-09</span><span>Email: info@alsat.kz</span></div>
        <div className="payment-readiness"><div><b>Freedom Pay</b><span>Интернет-эквайрингке дайын</span></div><span>Төлемдер теңгемен жүргізіледі. Карта деректері Alsat серверлерінде сақталмайды; төлем қосылғаннан кейін Freedom Pay қорғалған бетінде өңделеді.</span></div>
        <div className="footer-bottom"><span>© 2026 Alsat Marketplace. Барлық құқықтар қорғалған.</span><div><Link href="/legal/offer">Пайдаланушы келісімі</Link><Link href="/legal/privacy">Құпиялық саясаты</Link><Link href="/legal/cookies">Cookie саясаты</Link></div></div>
      </footer>
    </div>
    <nav className="mobile-marketplace-nav"><a href="#" className="active"><i>⌂</i><span>Басты бет</span></a><Link href="/marketplace/catalog"><i>▦</i><span>Каталог</span></Link><button onClick={() => setCartOpen(true)}><i>♧</i><span>Себет</span>{cartCount > 0 && <b>{cartCount}</b>}</button><Link href="/marketplace/account?tab=favorites"><i>♡</i><span>Таңдаулар</span></Link><Link href="/marketplace/account"><i>♙</i><span>Профиль</span></Link></nav>
    {notice && <div className="marketplace-toast">{notice}<button onClick={() => setNotice("")}>×</button></div>}

    {cartOpen && <div className="marketplace-overlay" onClick={() => setCartOpen(false)}><aside className="marketplace-cart" onClick={(event) => event.stopPropagation()}><div className="cart-head"><div><span className="marketplace-kicker">ALSAT MARKETPLACE</span><h2>Себет</h2></div><button className="modal-close" onClick={() => setCartOpen(false)}>×</button></div>{cartLines.length ? <><div className="cart-lines">{cartLines.map(({ product, quantity }) => <div className="cart-line" key={product.id}><div className="cart-line-visual">▣</div><div className="cart-line-copy"><strong>{product.name}</strong><small>{money.format(product.price)}</small><div className="quantity-control"><button onClick={() => changeQuantity(product, -1)}>−</button><b>{quantity}</b><button onClick={() => changeQuantity(product, 1)}>+</button></div></div><strong>{money.format(product.price * quantity)}</strong></div>)}</div><div className="cart-summary"><span>Барлығы <b>{cartCount} дана</b></span><strong>{money.format(cartTotal)}</strong></div><button className="modal-primary" onClick={() => void openCheckout()} disabled={checkoutLoading}>{checkoutLoading ? "Тексерілуде…" : "Тапсырысты рәсімдеу →"}</button><small className="cart-hint">Тапсырыс жасалғанда ол бірден Alsat қоймасының жұмыс тізбегіне түседі.</small></> : <div className="cart-empty"><span>🛒</span><strong>Себет бос</strong><small>Каталогтан тауар қосыңыз.</small><button className="modal-primary" onClick={() => setCartOpen(false)}>Каталогқа оралу</button></div>}</aside></div>}
    {checkoutOpen && <div className="marketplace-overlay" onClick={() => setCheckoutOpen(false)}><section className="checkout-modal marketplace-checkout" onClick={(event) => event.stopPropagation()}>
      <div className="cart-head"><div><span className="marketplace-kicker">ALSAT B2B CHECKOUT</span><h2>{checkoutSuccess ? "Тапсырыс қабылданды" : "Тапсырысты рәсімдеу"}</h2></div><button className="modal-close" onClick={() => setCheckoutOpen(false)}>×</button></div>
      {checkoutSuccess ? <div className="checkout-success"><span>✓</span><strong>Топ №{checkoutSuccess}</strong><p>{checkoutOrderCount > 1 ? `Себет ${checkoutOrderCount} жеткізушіге жеке тапсырыс болып бөлінді.` : "Тапсырыс жеткізуші Workspace-іне жіберілді."} Қойма қабылдағаннан кейін QR стикер мен накладной дайындалады.</p><Link className="modal-primary" href="/marketplace/account?tab=orders">Тапсырыстарымды көру →</Link></div>
      : !checkoutAuthenticated ? <div className="checkout-auth-error"><strong>Marketplace аккаунты қажет</strong><p>{checkoutError || "Компания реквизиттерін сақтау және тапсырысты бақылау үшін кіріңіз."}</p><Link className="modal-primary" href="/marketplace/account?next=checkout">Кіру / Тіркелу →</Link></div>
      : <form className="checkout-form" onSubmit={submitCheckout}>
        {checkoutError && <div className="checkout-error">{checkoutError}</div>}
        <div className="checkout-section-title"><b>1</b><div><strong>Сатып алушы компания</strong><span>Шот пен жеткізу құжаттарына арналған реквизиттер</span></div></div>
        <label>Компания немесе дүкен атауы<input required value={checkoutProfile.businessName} onChange={(event) => setCheckoutProfile((current) => ({ ...current, businessName: event.target.value }))} placeholder="Строймаг ЖШС"/></label>
        <div className="checkout-two"><label>БСН<input value={checkoutProfile.bin} onChange={(event) => setCheckoutProfile((current) => ({ ...current, bin: event.target.value.replace(/\D/g, "").slice(0, 12) }))} inputMode="numeric" placeholder="12 сан"/></label><label>Email<input type="email" value={checkoutProfile.email} onChange={(event) => setCheckoutProfile((current) => ({ ...current, email: event.target.value }))} placeholder="office@company.kz"/></label></div>
        <div className="checkout-two"><label>Байланыс тұлғасы<input required value={checkoutProfile.contactName} onChange={(event) => { const contactName=event.target.value; setCheckoutProfile((current) => ({ ...current, contactName })); setCheckoutAddress((current) => ({ ...current, contactName: current.contactName || contactName })); }} placeholder="Нұрлан Ә."/></label><label>Телефон<input required value={checkoutProfile.phone} onChange={(event) => { const phone=event.target.value; setCheckoutProfile((current) => ({ ...current, phone })); setCheckoutAddress((current) => ({ ...current, phone: current.phone || phone })); }} placeholder="+7 700 000 00 00"/></label></div>
        <div className="checkout-section-title"><b>2</b><div><strong>Жеткізу мекенжайы</strong><span>Қойма мен экспедитор осы деректі пайдаланады</span></div></div>
        {savedAddresses.length > 0 && <label>Сақталған мекенжай<select value={checkoutAddress.id || ""} onChange={(event) => { const selected=savedAddresses.find((item) => item.id===event.target.value); if(selected) setCheckoutAddress(selected); }}><option value="">Жаңа мекенжай</option>{savedAddresses.map((address) => <option value={address.id} key={address.id}>{address.label} · {address.city}, {address.address}</option>)}</select></label>}
        <div className="checkout-two"><label>Мекенжай атауы<input value={checkoutAddress.label} onChange={(event) => setCheckoutAddress((current) => ({ ...current, id: undefined, label: event.target.value }))} placeholder="Негізгі дүкен"/></label><label>Қала<input required value={checkoutAddress.city} onChange={(event) => setCheckoutAddress((current) => ({ ...current, id: undefined, city: event.target.value }))} placeholder="Алматы"/></label></div>
        <label>Толық мекенжай<input required value={checkoutAddress.address} onChange={(event) => setCheckoutAddress((current) => ({ ...current, id: undefined, address: event.target.value }))} placeholder="Айналмалы көшесі, 69А"/></label>
        <div className="checkout-section-title"><b>3</b><div><strong>Төлем тәсілі</strong><span>Онлайн төлем Freedom Pay қосылғаннан кейін белсенді болады</span></div></div>
        <div className="checkout-payment-options"><button type="button" className={paymentMethod === "invoice" ? "active" : ""} onClick={() => setPaymentMethod("invoice")}><b>▤</b><span>Банк шоты<small>Заңды тұлғаларға</small></span></button><button type="button" className={paymentMethod === "cashless" ? "active" : ""} onClick={() => setPaymentMethod("cashless")}><b>↔</b><span>Қолма-қолсыз<small>Менеджер растайды</small></span></button><button type="button" disabled title="Freedom Pay merchant іске қосылғаннан кейін" className={paymentMethod === "card" ? "active" : ""}><b>▣</b><span>Картамен<small>Жақында</small></span></button></div>
        <label>Ескерту<textarea value={checkoutNote} onChange={(event) => setCheckoutNote(event.target.value)} placeholder="Жеткізу уақыты, кіреберіс немесе басқа ақпарат"/></label>
        <div className="checkout-total"><span>{cartLines.length} тауар позициясы · {new Set(cartLines.map((line) => line.product.companyId)).size || 1} жеткізуші</span><strong>{money.format(cartTotal)}</strong></div>
        <label className="checkout-consent"><input type="checkbox" required/> <span><Link href="/legal/offer" target="_blank">Жария офертамен</Link> және деректерді өңдеу шарттарымен келісемін</span></label>
        <button className="modal-primary" disabled={checkoutLoading}>{checkoutLoading ? "Қауіпсіз тексерілуде…" : "Тапсырысты растау →"}</button>
      </form>}
    </section></div>}
    {usingDemo && <div className="marketplace-demo-badge">Демо каталог</div>}
  </main>;
}

