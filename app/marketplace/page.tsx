"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import "./marketplace.css";

type CatalogProduct = {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  category: string;
  description: string;
  imageUrl: string;
  minOrder: number;
};

const cartStorageKey = "alsat-marketplace-cart-v1";
const money = new Intl.NumberFormat("kk-KZ", { style: "currency", currency: "KZT", maximumFractionDigits: 0 });
const categories = ["Барлығы", "Шамдар", "Прожекторлар", "Панельдер", "Розеткалар", "Автоматика"];
const demoProducts: CatalogProduct[] = [
  { id: "demo-a60", name: "KRAUSZ Шам A60 12W E27 6500K", sku: "KLZ-A60-12W-6500", price: 650, stock: 1250, category: "Шамдар", description: "Күнделікті саудаға арналған үнемді LED шам.", imageUrl: "", minOrder: 1 },
  { id: "demo-projector", name: "KRAUSZ Прожектор 100W 6500K IP65", sku: "KLZ-FL-100W-6500", price: 8500, stock: 320, category: "Прожекторлар", description: "Сыртқы және өндірістік жарықтандыруға арналған прожектор.", imageUrl: "", minOrder: 2 },
  { id: "demo-panel", name: "KRAUSZ Панель LED 36W 595x595", sku: "KLZ-P-36W-595", price: 4200, stock: 760, category: "Панельдер", description: "Кеңсе мен сауда нүктелеріне арналған төбелік панель.", imageUrl: "", minOrder: 5 },
  { id: "demo-socket", name: "KRAUSZ Розетка 2P+E 16A", sku: "KLZ-SKT-2PE-16A", price: 890, stock: 890, category: "Розеткалар", description: "Сенімді механизм және классикалық ақ корпус.", imageUrl: "", minOrder: 10 },
  { id: "demo-breaker", name: "Автомат ажыратқыш C16", sku: "KLZ-C16-1P", price: 2450, stock: 120, category: "Автоматика", description: "Үй және коммерциялық желілерге арналған автомат.", imageUrl: "", minOrder: 5 },
  { id: "demo-linear", name: "KRAUSZ Сызықтық шам 36W", sku: "KLZ-LN-36W", price: 5200, stock: 160, category: "Шамдар", description: "Ұзын сөрелер мен қойма аймақтарына ыңғайлы шам.", imageUrl: "", minOrder: 2 },
];

function normalizeProduct(row: Record<string, unknown>): CatalogProduct {
  return {
    id: String(row.id),
    name: String(row.marketplace_title || row.name || "Тауар"),
    sku: String(row.sku || "SKU көрсетілмеген"),
    price: Number(row.price || 0),
    stock: Math.max(0, Number(row.stock || 0)),
    category: String(row.marketplace_category || "Электр тауарлары"),
    description: String(row.marketplace_description || "Alsat Marketplace каталогындағы тауар."),
    imageUrl: typeof row.marketplace_image_url === "string" ? row.marketplace_image_url : "",
    minOrder: Math.max(1, Number(row.marketplace_min_order || 1)),
  };
}

export default function MarketplacePage() {
  const [products, setProducts] = useState<CatalogProduct[]>(demoProducts);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Барлығы");
  const [selected, setSelected] = useState<CatalogProduct | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(Boolean(supabase));
  const [usingDemo, setUsingDemo] = useState(!supabase);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(cartStorageKey) || "{}");
      if (saved && typeof saved === "object") setCart(saved);
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
        .select("id,name,sku,price,stock,marketplace_title,marketplace_description,marketplace_category,marketplace_image_url,marketplace_min_order")
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
        setProducts([]);
        setUsingDemo(false);
      }
      setLoading(false);
    }
    void loadCatalog();
    return () => { active = false; };
  }, []);

  const visibleProducts = useMemo(() => products.filter((product) => {
    const matchesQuery = `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (category === "Барлығы" || product.category === category);
  }), [category, products, query]);
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

  return <main className="marketplace-shell">
    <header className="marketplace-header">
      <Link className="marketplace-logo" href="/"><span>A</span><div><strong>ALSAT</strong><small>MARKETPLACE</small></div></Link>
      <nav><a href="#catalog">Каталог</a><a href="#benefits">Артықшылықтар</a><Link href="/promo">Alsat туралы</Link></nav>
      <div className="marketplace-header-actions"><Link className="marketplace-login" href="/workspace-login">Workspace-ке кіру</Link><button className="cart-button" onClick={() => setCartOpen(true)}>Себет <b>{cartCount}</b></button></div>
    </header>

    <section className="marketplace-hero">
      <div><span className="marketplace-kicker">ALSAT B2B MARKETPLACE</span><h1>Электр тауарларын бір жерден сатып алыңыз.</h1><p>Тексерілген жеткізушілер, нақты қалдық және Alsat-тың жылдам қойма-жеткізу процесі.</p><div className="marketplace-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Тауар, SKU немесе категория іздеу"/><kbd>⌘ K</kbd></div></div>
      <div className="marketplace-hero-card"><span>Бүгінгі ұсыныс</span><strong>Көтерме бағалар</strong><small>Дүкеніңізге керек тауарды тиімді бағамен алыңыз.</small><a href="#catalog">Каталогты ашу →</a></div>
    </section>

    <section className="marketplace-benefits" id="benefits"><div><span>01</span><strong>Нақты қалдық</strong><small>Қоймадағы қолжетімді санды бірден көресіз.</small></div><div><span>02</span><strong>Жылдам тапсырыс</strong><small>Себеттен тапсырысқа бірнеше қадам.</small></div><div><span>03</span><strong>Бақыланатын жеткізу</strong><small>QR және карта арқылы барлық кезең көрінеді.</small></div></section>

    <section className="marketplace-catalog" id="catalog">
      <div className="marketplace-section-head"><div><span className="marketplace-kicker">КАТАЛОГ</span><h2>Сұраныстағы тауарлар</h2></div><span className="catalog-count">{visibleProducts.length} тауар</span></div>
      <div className="marketplace-chips">{categories.map((item) => <button className={category === item ? "active" : ""} key={item} onClick={() => setCategory(item)}>{item}</button>)}</div>
      {loading && <div className="marketplace-loading">Каталог жүктелуде…</div>}
      {!loading && !visibleProducts.length && <div className="marketplace-empty"><strong>Тауар табылмады</strong><span>Іздеу сөзін немесе категорияны өзгертіп көріңіз.</span></div>}
      <div className="marketplace-grid">{visibleProducts.map((product) => <article className="marketplace-product-card" key={product.id}>
        <button className="product-visual" onClick={() => setSelected(product)} aria-label={`${product.name} карточкасын ашу`}>{product.imageUrl ? <img src={product.imageUrl} alt=""/> : <span>{product.category === "Шамдар" ? "◌" : product.category === "Розеткалар" ? "◉" : "▣"}</span>}</button>
        <div className="product-card-copy"><span className="product-category">{product.category}</span><h3>{product.name}</h3><small>SKU: {product.sku}</small><div className="product-card-bottom"><div><strong>{money.format(product.price)}</strong><span>Қалдық: {product.stock} дана</span></div><button onClick={() => addToCart(product)} aria-label={`${product.name} себетке қосу`}>+</button></div></div>
      </article>)}</div>
    </section>

    <footer className="marketplace-footer"><div><strong>ALSAT</strong><span>Бизнеске арналған электр тауарларының marketplace-і.</span></div><Link href="/workspace-login">Серіктес болу →</Link></footer>
    {notice && <div className="marketplace-toast">{notice}<button onClick={() => setNotice("")}>×</button></div>}

    {selected && <div className="marketplace-overlay" onClick={() => setSelected(null)}><section className="marketplace-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setSelected(null)}>×</button><div className="modal-product-visual">{selected.imageUrl ? <img src={selected.imageUrl} alt=""/> : <span>▣</span>}</div><span className="product-category">{selected.category}</span><h2>{selected.name}</h2><p>{selected.description}</p><div className="modal-meta"><span>SKU <b>{selected.sku}</b></span><span>Қалдық <b>{selected.stock} дана</b></span><span>Минимум <b>{selected.minOrder} дана</b></span></div><strong className="modal-price">{money.format(selected.price)}</strong><button className="modal-primary" onClick={() => { addToCart(selected); setSelected(null); setCartOpen(true); }}>Себетке қосу →</button></section></div>}
    {cartOpen && <div className="marketplace-overlay" onClick={() => setCartOpen(false)}><aside className="marketplace-cart" onClick={(event) => event.stopPropagation()}><div className="cart-head"><div><span className="marketplace-kicker">ALSAT MARKETPLACE</span><h2>Себет</h2></div><button className="modal-close" onClick={() => setCartOpen(false)}>×</button></div>{cartLines.length ? <><div className="cart-lines">{cartLines.map(({ product, quantity }) => <div className="cart-line" key={product.id}><div className="cart-line-visual">▣</div><div className="cart-line-copy"><strong>{product.name}</strong><small>{money.format(product.price)}</small><div className="quantity-control"><button onClick={() => changeQuantity(product, -1)}>−</button><b>{quantity}</b><button onClick={() => changeQuantity(product, 1)}>+</button></div></div><strong>{money.format(product.price * quantity)}</strong></div>)}</div><div className="cart-summary"><span>Барлығы <b>{cartCount} дана</b></span><strong>{money.format(cartTotal)}</strong></div><button className="modal-primary" onClick={() => setNotice("Checkout келесі қадамда қосылады: дүкенді таңдау және тапсырысты қоймаға жіберу.")}>Тапсырысты рәсімдеу →</button><small className="cart-hint">Тапсырыс жасалғанда ол бірден Alsat қоймасының жұмыс тізбегіне түседі.</small></> : <div className="cart-empty"><span>🛒</span><strong>Себет бос</strong><small>Каталогтан тауар қосыңыз.</small><button className="modal-primary" onClick={() => setCartOpen(false)}>Каталогқа оралу</button></div>}</aside></div>}
    {usingDemo && <div className="marketplace-demo-badge">Демо каталог</div>}
  </main>;
}
