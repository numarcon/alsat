"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { getWorkspaceIdentity } from "../../lib/workspace-auth";
import "./marketplace.css";

type CatalogProduct = {
  id: string;
  companyId?: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  category: string;
  subcategory: string;
  brand: string;
  description: string;
  imageUrl: string;
  imageUrls: string[];
  minOrder: number;
  unit: string;
  bulletPoints: string[];
};
type CheckoutStore = { id: string; name: string; address: string; contactName: string; phone: string };

const cartStorageKey = "alsat-marketplace-cart-v1";
const money = {
  format(value: number) {
    const rounded = Math.round(Number(value) || 0);
    const sign = rounded < 0 ? "−" : "";
    const digits = Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return `${sign}${digits} ₸`;
  },
};
const demoProducts: CatalogProduct[] = [
  { id: "demo-phone", name: "Samsung Galaxy A56 5G 256 GB", sku: "SAM-A56-256", price: 239990, stock: 45, category: "Электроника және техника", subcategory: "Смартфондар және аксессуарлар", brand: "Samsung", description: "Күнделікті бизнес пен байланысқа арналған 5G смартфон.", imageUrl: "", imageUrls: [], minOrder: 1, unit: "дана", bulletPoints: ["256 GB жад", "5G байланысы"] },
  { id: "demo-lamp", name: "KRAUSZ Шам A60 12W E27 6500K", sku: "KLZ-A60-12W-6500", price: 650, stock: 1250, category: "Құрылыс және жөндеу", subcategory: "Электр тауарлары", brand: "KRAUSZ", description: "Күнделікті саудаға арналған үнемді LED шам.", imageUrl: "", imageUrls: [], minOrder: 10, unit: "дана", bulletPoints: ["12 W", "6500 K"] },
  { id: "demo-coffee", name: "Arabica кофе дәні 1 кг", sku: "COF-ARA-1KG", price: 7950, stock: 220, category: "Азық-түлік және сусындар", subcategory: "Бакалея", brand: "Alsat Select", description: "HoReCa және кеңселерге арналған қуырылған арабика дәні.", imageUrl: "", imageUrls: [], minOrder: 4, unit: "қаптама", bulletPoints: ["100% Arabica", "1 кг"] },
  { id: "demo-chair", name: "Эргономикалық кеңсе орындығы", sku: "CHR-ERG-BLK", price: 68900, stock: 32, category: "Үй, жиһаз және бақша", subcategory: "Жиһаз", brand: "OfficePro", description: "Бел тірегі мен реттелетін механизмдері бар кеңсе орындығы.", imageUrl: "", imageUrls: [], minOrder: 1, unit: "дана", bulletPoints: ["Бел тірегі", "120 кг дейін"] },
  { id: "demo-glove", name: "Қорғаныс қолғаптары, 12 жұп", sku: "PPE-GLV-12", price: 5400, stock: 310, category: "Өнеркәсіп және бизнес", subcategory: "Қауіпсіздік және қорғаныс", brand: "SafeWork", description: "Қойма және өндіріс жұмысына арналған қорғаныс қолғаптары.", imageUrl: "", imageUrls: [], minOrder: 2, unit: "қаптама", bulletPoints: ["12 жұп", "Сырғанамайтын жабын"] },
  { id: "demo-shirt", name: "Ерлерге арналған классикалық жейде", sku: "SHR-CL-WHT", price: 12900, stock: 85, category: "Киім, аяқ киім және аксессуарлар", subcategory: "Ерлер киімі", brand: "Qazaq Basic", description: "Кеңсе мен күнделікті киюге арналған мақта жейде.", imageUrl: "", imageUrls: [], minOrder: 3, unit: "дана", bulletPoints: ["100% мақта", "S–XXL"] },
];

function normalizeProduct(row: Record<string, unknown>): CatalogProduct {
  return {
    id: String(row.id),
    companyId: typeof row.company_id === "string" ? row.company_id : undefined,
    name: String(row.marketplace_title || row.name || "Тауар"),
    sku: String(row.sku || "SKU көрсетілмеген"),
    price: Number(row.price || 0),
    stock: Math.max(0, Number(row.stock || 0)),
    category: String(row.category || row.marketplace_category || "Басқа тауарлар"),
    subcategory: String(row.subcategory || row.marketplace_subcategory || "Өзге"),
    brand: String(row.brand || ""),
    description: String(row.marketplace_description || row.description || "Alsat Marketplace каталогындағы тауар."),
    imageUrl: typeof row.marketplace_image_url === "string" ? row.marketplace_image_url : typeof row.image_url === "string" ? row.image_url : "",
    imageUrls: Array.isArray(row.image_urls) ? row.image_urls.filter((item): item is string => typeof item === "string") : [],
    minOrder: Math.max(1, Number(row.marketplace_min_order || 1)),
    unit: String(row.unit || "дана"),
    bulletPoints: Array.isArray(row.bullet_points) ? row.bullet_points.filter((item): item is string => typeof item === "string") : [],
  };
}

export default function MarketplacePage() {
  const [products, setProducts] = useState<CatalogProduct[]>(demoProducts);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Барлығы");
  const [subcategory, setSubcategory] = useState("Барлығы");
  const [selected, setSelected] = useState<CatalogProduct | null>(null);
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
        setNotice("Marketplace-те жарияланған нақты тауар әзірге жоқ. Қазір демо каталог көрсетіліп тұр.");
      }
      setLoading(false);
    }
    void loadCatalog();
    return () => { active = false; };
  }, []);

  const categories = useMemo(() => ["Барлығы", ...Array.from(new Set(products.map((product) => product.category))).sort()], [products]);
  const subcategories = useMemo(() => ["Барлығы", ...Array.from(new Set(products.filter((product) => category === "Барлығы" || product.category === category).map((product) => product.subcategory))).sort()], [category, products]);
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
    <header className="marketplace-header">
      <Link className="marketplace-logo" href="/"><span>A</span><div><strong>ALSAT</strong><small>MARKETPLACE</small></div></Link>
      <nav><a href="#catalog">Каталог</a><a href="#benefits">Артықшылықтар</a><Link href="/promo">Alsat туралы</Link></nav>
      <div className="marketplace-header-actions"><Link className="marketplace-login" href="/workspace-login">Workspace-ке кіру</Link><button className="cart-button" onClick={() => setCartOpen(true)}>Себет <b>{cartCount}</b></button></div>
    </header>

    <section className="marketplace-hero">
      <div><span className="marketplace-kicker">ALSAT B2B MARKETPLACE</span><h1>Бизнеске керек барлық тауарды көтерме бағамен алыңыз.</h1><p>Барлық категориядағы тексерілген жеткізушілер, нақты қалдық және бақыланатын қойма-жеткізу процесі.</p><div className="marketplace-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Тауар, бренд, SKU немесе категория іздеу"/><kbd>⌘ K</kbd></div></div>
      <div className="marketplace-hero-card"><span>Бүгінгі ұсыныс</span><strong>Көтерме бағалар</strong><small>Дүкеніңізге керек тауарды тиімді бағамен алыңыз.</small><a href="#catalog">Каталогты ашу →</a></div>
    </section>

    <section className="marketplace-benefits" id="benefits"><div><span>01</span><strong>Нақты қалдық</strong><small>Қоймадағы қолжетімді санды бірден көресіз.</small></div><div><span>02</span><strong>Жылдам тапсырыс</strong><small>Себеттен тапсырысқа бірнеше қадам.</small></div><div><span>03</span><strong>Бақыланатын жеткізу</strong><small>QR және карта арқылы барлық кезең көрінеді.</small></div></section>

    <section className="marketplace-catalog" id="catalog">
      <div className="marketplace-section-head"><div><span className="marketplace-kicker">КАТАЛОГ</span><h2>Сұраныстағы тауарлар</h2></div><span className="catalog-count">{visibleProducts.length} тауар</span></div>
      <div className="marketplace-chips">{categories.map((item) => <button className={category === item ? "active" : ""} key={item} onClick={() => { setCategory(item); setSubcategory("Барлығы"); }}>{item}</button>)}</div>
      <div className="marketplace-subcategory-filter"><label>Подкатегория<select value={subcategory} onChange={(event) => setSubcategory(event.target.value)}>{subcategories.map((item) => <option value={item} key={item}>{item}</option>)}</select></label><span>{category === "Барлығы" ? "Барлық категория" : category}</span></div>
      {loading && <div className="marketplace-loading">Каталог жүктелуде…</div>}
      {!loading && !visibleProducts.length && <div className="marketplace-empty"><strong>Тауар табылмады</strong><span>Іздеу сөзін немесе категорияны өзгертіп көріңіз.</span></div>}
      <div className="marketplace-grid">{visibleProducts.map((product) => <article className="marketplace-product-card" key={product.id}>
        <button className="product-visual" onClick={() => setSelected(product)} aria-label={`${product.name} карточкасын ашу`}>{product.imageUrl ? <img src={product.imageUrl} alt=""/> : <span>▣</span>}</button>
        <div className="product-card-copy"><span className="product-category">{product.category} · {product.subcategory}</span><h3>{product.name}</h3><small>{product.brand ? `${product.brand} · ` : ""}SKU: {product.sku}</small><div className="product-card-bottom"><div><strong>{money.format(product.price)}</strong><span>Қалдық: {product.stock} {product.unit}</span></div><button onClick={() => addToCart(product)} aria-label={`${product.name} себетке қосу`}>+</button></div></div>
      </article>)}</div>
    </section>

    <footer className="marketplace-footer"><div><strong>ALSAT</strong><span>Барлық тауар категориясына арналған B2B marketplace.</span></div><Link href="/workspace-signup">Серіктес болу →</Link></footer>
    {notice && <div className="marketplace-toast">{notice}<button onClick={() => setNotice("")}>×</button></div>}

    {selected && <div className="marketplace-overlay" onClick={() => setSelected(null)}><section className="marketplace-modal" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setSelected(null)}>×</button><div className="modal-product-visual">{selected.imageUrl ? <img src={selected.imageUrl} alt=""/> : <span>▣</span>}</div><span className="product-category">{selected.category} · {selected.subcategory}</span><h2>{selected.name}</h2>{selected.brand && <strong className="modal-brand">{selected.brand}</strong>}<p>{selected.description}</p>{selected.bulletPoints.length > 0 && <ul className="modal-bullets">{selected.bulletPoints.map((item) => <li key={item}>{item}</li>)}</ul>}<div className="modal-meta"><span>SKU <b>{selected.sku}</b></span><span>Қалдық <b>{selected.stock} {selected.unit}</b></span><span>Минимум <b>{selected.minOrder} {selected.unit}</b></span></div><strong className="modal-price">{money.format(selected.price)}</strong><button className="modal-primary" onClick={() => { addToCart(selected); setSelected(null); setCartOpen(true); }}>Себетке қосу →</button></section></div>}
    {cartOpen && <div className="marketplace-overlay" onClick={() => setCartOpen(false)}><aside className="marketplace-cart" onClick={(event) => event.stopPropagation()}><div className="cart-head"><div><span className="marketplace-kicker">ALSAT MARKETPLACE</span><h2>Себет</h2></div><button className="modal-close" onClick={() => setCartOpen(false)}>×</button></div>{cartLines.length ? <><div className="cart-lines">{cartLines.map(({ product, quantity }) => <div className="cart-line" key={product.id}><div className="cart-line-visual">▣</div><div className="cart-line-copy"><strong>{product.name}</strong><small>{money.format(product.price)}</small><div className="quantity-control"><button onClick={() => changeQuantity(product, -1)}>−</button><b>{quantity}</b><button onClick={() => changeQuantity(product, 1)}>+</button></div></div><strong>{money.format(product.price * quantity)}</strong></div>)}</div><div className="cart-summary"><span>Барлығы <b>{cartCount} дана</b></span><strong>{money.format(cartTotal)}</strong></div><button className="modal-primary" onClick={() => void openCheckout()} disabled={checkoutLoading}>{checkoutLoading ? "Тексерілуде…" : "Тапсырысты рәсімдеу →"}</button><small className="cart-hint">Тапсырыс жасалғанда ол бірден Alsat қоймасының жұмыс тізбегіне түседі.</small></> : <div className="cart-empty"><span>🛒</span><strong>Себет бос</strong><small>Каталогтан тауар қосыңыз.</small><button className="modal-primary" onClick={() => setCartOpen(false)}>Каталогқа оралу</button></div>}</aside></div>}
    {checkoutOpen && <div className="marketplace-overlay" onClick={() => setCheckoutOpen(false)}><section className="checkout-modal" onClick={(event) => event.stopPropagation()}><div className="cart-head"><div><span className="marketplace-kicker">ALSAT MARKETPLACE</span><h2>{checkoutSuccess ? "Тапсырыс қабылданды" : "Тапсырысты рәсімдеу"}</h2></div><button className="modal-close" onClick={() => setCheckoutOpen(false)}>×</button></div>{checkoutSuccess ? <div className="checkout-success"><span>✓</span><strong>№{checkoutSuccess}</strong><p>Тапсырыс қоймаға жіберілді. Қоймашы қабылдағаннан кейін QR стикер мен накладной дайындалады.</p><button className="modal-primary" onClick={() => { setCheckoutOpen(false); setCheckoutSuccess(""); }}>Marketplace-ке оралу</button></div> : checkoutError && !sellerCompanyId ? <div className="checkout-auth-error"><strong>Workspace-ке кіру қажет</strong><p>{checkoutError}</p><Link className="modal-primary" href="/workspace-login">Workspace-ке кіру →</Link></div> : <form className="checkout-form" onSubmit={submitCheckout}>{checkoutError && <div className="checkout-error">{checkoutError}</div>}{checkoutStores.length > 0 && <label>Дүкенді таңдаңыз<select value={selectedStoreId} onChange={(event) => setSelectedStoreId(event.target.value)}><option value="">+ Жаңа дүкен қосу</option>{checkoutStores.map((store) => <option value={store.id} key={store.id}>{store.name} · {store.address}</option>)}</select></label>}{!selectedStoreId && <><label>Дүкен атауы<input required value={newStore.name} onChange={(event) => setNewStore((current) => ({ ...current, name: event.target.value }))} placeholder="Строймаг"/></label><label>Мекенжай<input required value={newStore.address} onChange={(event) => setNewStore((current) => ({ ...current, address: event.target.value }))} placeholder="Алматы қ., Райымбек 348"/></label><div className="checkout-two"><label>Байланыс тұлғасы<input value={newStore.contactName} onChange={(event) => setNewStore((current) => ({ ...current, contactName: event.target.value }))} placeholder="Нұрлан Ә."/></label><label>Телефон<input required value={newStore.phone} onChange={(event) => setNewStore((current) => ({ ...current, phone: event.target.value }))} placeholder="+7 700 000 00 00"/></label></div></>}<label>Ескерту<textarea value={checkoutNote} onChange={(event) => setCheckoutNote(event.target.value)} placeholder="Жеткізу бойынша қосымша ақпарат"/></label><div className="checkout-total"><span>Тапсырыс сомасы</span><strong>{money.format(cartTotal)}</strong></div><button className="modal-primary" disabled={checkoutLoading}>{checkoutLoading ? "Жіберілуде…" : "Тапсырысты қоймаға жіберу →"}</button></form>}</section></div>}
    {usingDemo && <div className="marketplace-demo-badge">Демо каталог</div>}
  </main>;
}

