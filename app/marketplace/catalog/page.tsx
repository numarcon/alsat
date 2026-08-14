"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { demoProducts, money, type CatalogProduct } from "../../../lib/marketplace-products";
import { addCartItem, loadFavoriteIds, loadMarketplaceCatalog, readCart, setFavorite, writeCart } from "../../../lib/marketplace-commerce";
import "./catalog.css";

type SortMode = "popular" | "price-asc" | "price-desc" | "name";

export default function MarketplaceCatalogPage() {
  const [products, setProducts] = useState<CatalogProduct[]>(demoProducts);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Барлығы");
  const [subcategory, setSubcategory] = useState("Барлығы");
  const [brand, setBrand] = useState("Барлығы");
  const [sort, setSort] = useState<SortMode>("popular");
  const [onlyStock, setOnlyStock] = useState(true);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [cartCount, setCartCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setQuery(params.get("q") || "");
    setCategory(params.get("category") || "Барлығы");
    const cart = readCart();
    setCartCount(Object.values(cart).reduce((sum, quantity) => sum + quantity, 0));
    void Promise.all([loadMarketplaceCatalog(), loadFavoriteIds()]).then(([result, ids]) => {
      if (result.products.length) setProducts(result.products);
      setFavorites(ids);
      setLoading(false);
    });
  }, []);

  const categories = useMemo(() => ["Барлығы", ...new Set(products.map((product) => product.category))], [products]);
  const subcategories = useMemo(() => ["Барлығы", ...new Set(products.filter((product) => category === "Барлығы" || product.category === category).map((product) => product.subcategory))], [category, products]);
  const brands = useMemo(() => ["Барлығы", ...new Set(products.map((product) => product.brand).filter(Boolean))], [products]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("kk");
    const result = products.filter((product) => {
      const searchable = `${product.name} ${product.sku} ${product.brand} ${product.manufacturer} ${product.model} ${product.category} ${product.subcategory} ${product.searchTerms}`.toLocaleLowerCase("kk");
      return (!normalized || searchable.includes(normalized))
        && (category === "Барлығы" || product.category === category)
        && (subcategory === "Барлығы" || product.subcategory === subcategory)
        && (brand === "Барлығы" || product.brand === brand)
        && (!onlyStock || product.stock > 0);
    });
    if (sort === "price-asc") result.sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") result.sort((a, b) => b.price - a.price);
    else if (sort === "name") result.sort((a, b) => a.name.localeCompare(b.name, "kk"));
    else result.sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0) || b.stock - a.stock);
    return result;
  }, [brand, category, onlyStock, products, query, sort, subcategory]);
  const pageSize = 24;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [brand, category, onlyStock, query, sort, subcategory]);

  function applyCategory(value: string) {
    setCategory(value); setSubcategory("Барлығы");
    window.history.replaceState(null, "", value === "Барлығы" ? "/marketplace/catalog" : `/marketplace/catalog?category=${encodeURIComponent(value)}`);
  }

  function add(product: CatalogProduct) {
    const cart = addCartItem(readCart(), product);
    writeCart(cart);
    setCartCount(Object.values(cart).reduce((sum, quantity) => sum + quantity, 0));
    setNotice(`${product.name} себетке қосылды`);
  }

  async function toggleFavorite(product: CatalogProduct) {
    const active = !favorites.includes(product.id);
    setFavorites((current) => active ? [...new Set([...current, product.id])] : current.filter((id) => id !== product.id));
    await setFavorite(product.id, active);
  }

  return <main className="catalog-shell">
    <header className="catalog-header"><Link className="catalog-logo" href="/marketplace"><i>▲</i><span><b>ALSAT</b><small>MARKETPLACE</small></span></Link><Link className="catalog-all" href="/marketplace/catalog">☰ <span>Каталог</span></Link><form className="catalog-search" onSubmit={(event) => event.preventDefault()}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Тауар, бренд, SKU немесе категория"/><button aria-label="Іздеу">⌕</button></form><nav><Link href="/marketplace/account?tab=favorites">♡</Link><Link className="catalog-cart-link" href="/marketplace?cart=open">♧{cartCount > 0 && <b>{cartCount}</b>}</Link><Link className="catalog-account" href="/marketplace/account">Кабинет</Link></nav></header>

    <section className="catalog-page"><nav className="catalog-breadcrumb"><Link href="/marketplace">Басты бет</Link><span>›</span><b>Каталог</b>{category !== "Барлығы" && <><span>›</span><b>{category}</b></>}</nav><div className="catalog-title-row"><div><span>ALSAT B2B CATALOG</span><h1>{category === "Барлығы" ? "Барлық тауарлар" : category}</h1><p>{loading ? "Каталог жүктелуде…" : `${filtered.length} ұсыныс табылды`}</p></div><button className="mobile-filter-button" onClick={() => setFiltersOpen(true)}>☷ Сүзгілер</button></div>

      <div className="catalog-layout"><aside className={filtersOpen ? "catalog-filters open" : "catalog-filters"}><div className="filter-mobile-head"><strong>Сүзгілер</strong><button onClick={() => setFiltersOpen(false)}>×</button></div><section><h2>Категориялар</h2><div className="category-filter-list">{categories.map((item) => <button className={category === item ? "active" : ""} key={item} onClick={() => applyCategory(item)}><span>{item}</span><b>{item === "Барлығы" ? products.length : products.filter((product) => product.category === item).length}</b></button>)}</div></section>{subcategories.length > 2 && <section><h2>Подкатегория</h2><select value={subcategory} onChange={(event) => setSubcategory(event.target.value)}>{subcategories.map((item) => <option key={item}>{item}</option>)}</select></section>}<section><h2>Бренд</h2><select value={brand} onChange={(event) => setBrand(event.target.value)}>{brands.map((item) => <option key={item}>{item}</option>)}</select></section><section><label className="stock-checkbox"><input type="checkbox" checked={onlyStock} onChange={(event) => setOnlyStock(event.target.checked)}/><span>Қоймада бар тауарлар</span></label></section><button className="reset-filters" onClick={() => { setCategory("Барлығы"); setSubcategory("Барлығы"); setBrand("Барлығы"); setOnlyStock(true); setQuery(""); }}>Сүзгілерді тазарту</button><button className="apply-mobile-filter" onClick={() => setFiltersOpen(false)}>Нәтижені көрсету</button></aside>{filtersOpen && <button className="filter-backdrop" onClick={() => setFiltersOpen(false)} aria-label="Сүзгілерді жабу"/>}

        <section className="catalog-results"><div className="catalog-toolbar"><div>{category !== "Барлығы" && <button onClick={() => applyCategory("Барлығы")}>{category} ×</button>}{subcategory !== "Барлығы" && <button onClick={() => setSubcategory("Барлығы")}>{subcategory} ×</button>}{brand !== "Барлығы" && <button onClick={() => setBrand("Барлығы")}>{brand} ×</button>}</div><label>Сұрыптау<select value={sort} onChange={(event) => setSort(event.target.value as SortMode)}><option value="popular">Танымалдығы бойынша</option><option value="price-asc">Бағасы: төменнен жоғары</option><option value="price-desc">Бағасы: жоғарыдан төмен</option><option value="name">Атауы бойынша</option></select></label></div>
          {loading ? <div className="catalog-empty"><span className="catalog-loader"/><strong>Каталог жүктелуде</strong></div> : visible.length ? <div className="catalog-product-grid">{visible.map((product) => <article key={product.id}><button className={favorites.includes(product.id) ? "catalog-favorite active" : "catalog-favorite"} onClick={() => void toggleFavorite(product)}>{favorites.includes(product.id) ? "♥" : "♡"}</button><Link className="catalog-product-image" href={`/marketplace/product/${encodeURIComponent(product.id)}`}>{product.imageUrl ? <img src={product.imageUrl} alt=""/> : <span>▣</span>}{product.minOrder > 1 && <b>Көтерме</b>}</Link><div className="catalog-product-copy"><small>{product.brand || product.sellerName}</small><Link href={`/marketplace/product/${encodeURIComponent(product.id)}`}><h2>{product.name}</h2></Link><span>{product.subcategory}</span><div className="catalog-stock"><i/>Қоймада {product.stock} {product.unit}</div><strong>{money.format(product.price)}</strong><small className="catalog-min">Мин. тапсырыс: {product.minOrder} {product.unit}</small><button onClick={() => add(product)}>Себетке қосу</button></div></article>)}</div> : <div className="catalog-empty"><span>⌕</span><strong>Тауар табылмады</strong><p>Іздеу сөзін немесе сүзгілерді өзгертіп көріңіз.</p><button onClick={() => { setQuery(""); setCategory("Барлығы"); setSubcategory("Барлығы"); setBrand("Барлығы"); }}>Барлық тауарды көрсету</button></div>}
          {pageCount > 1 && <nav className="catalog-pagination"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>←</button>{Array.from({ length: pageCount }, (_, index) => index + 1).slice(Math.max(0, page - 3), page + 2).map((value) => <button className={page === value ? "active" : ""} onClick={() => setPage(value)} key={value}>{value}</button>)}<button disabled={page === pageCount} onClick={() => setPage((value) => value + 1)}>→</button></nav>}
        </section></div>
    </section>
    <footer className="catalog-footer"><Link className="catalog-logo light" href="/marketplace"><i>▲</i><span><b>ALSAT</b><small>MARKETPLACE</small></span></Link><p>«Krausz &amp; Deisler» ЖШС · БСН 090740009232 · Алматы қ., Айналмалы көшесі, 69А</p><div><Link href="/legal/offer">Жария оферта</Link><Link href="/legal/privacy">Құпиялық</Link><a href="tel:+77003003009">+7 700 300 30 09</a></div></footer>
    <nav className="catalog-mobile-nav"><Link href="/marketplace">⌂<span>Басты бет</span></Link><Link className="active" href="/marketplace/catalog">▦<span>Каталог</span></Link><Link href="/marketplace?cart=open">♧<span>Себет</span>{cartCount > 0 && <b>{cartCount}</b>}</Link><Link href="/marketplace/account?tab=favorites">♡<span>Таңдаулар</span></Link><Link href="/marketplace/account">♙<span>Профиль</span></Link></nav>
    {notice && <div className="catalog-toast">{notice}<Link href="/marketplace?cart=open">Себетті ашу</Link><button onClick={() => setNotice("")}>×</button></div>}
  </main>;
}
