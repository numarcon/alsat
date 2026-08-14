"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { type CatalogProduct, demoProductArtIndex, demoProducts, money, normalizeProduct } from "../../../../lib/marketplace-products";
import { addCartItem, marketplaceCatalogSelect, readCart, readFavorites, setFavorite, writeCart } from "../../../../lib/marketplace-commerce";
import "./product-page.css";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default function MarketplaceProductPage() {
  const params = useParams<{ id: string }>();
  const productId = decodeURIComponent(Array.isArray(params.id) ? params.id[0] : params.id || "");
  const demoProduct = useMemo(() => demoProducts.find((item) => item.id === productId) ?? null, [productId]);
  const [product, setProduct] = useState<CatalogProduct | null>(demoProduct);
  const [loading, setLoading] = useState(!demoProduct);
  const [notFound, setNotFound] = useState(false);
  const [quantity, setQuantity] = useState(demoProduct?.minOrder ?? 1);
  const [added, setAdded] = useState(false);
  const [favorite, setFavoriteState] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    setFavoriteState(readFavorites().includes(productId));
  }, [productId]);

  useEffect(() => {
    let active = true;
    if (demoProduct) {
      setProduct(demoProduct);
      setQuantity(demoProduct.minOrder);
      setLoading(false);
      setNotFound(false);
      return () => { active = false; };
    }

    async function loadProduct() {
      if (!supabaseUrl || !supabaseKey || !productId) {
        if (active) { setLoading(false); setNotFound(true); }
        return;
      }
      const endpoint = new URL(`${supabaseUrl}/rest/v1/marketplace_catalog`);
      endpoint.searchParams.set("select", marketplaceCatalogSelect);
      endpoint.searchParams.set("id", `eq.${productId}`);
      endpoint.searchParams.set("stock", "gt.0");
      let response = await fetch(endpoint, { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } });
      let rows = response.ok ? await response.json() as Record<string, unknown>[] : [];
      if (!response.ok) {
        const legacy = new URL(`${supabaseUrl}/rest/v1/products`);
        legacy.searchParams.set("select", "id,company_id,name,sku,price,stock,category,subcategory,brand,description,bullet_points,unit,image_urls,marketplace_title,marketplace_description,marketplace_category,marketplace_subcategory,marketplace_image_url,image_url,marketplace_min_order");
        legacy.searchParams.set("id", `eq.${productId}`);
        legacy.searchParams.set("workspace_active", "eq.true");
        legacy.searchParams.set("marketplace_published", "eq.true");
        legacy.searchParams.set("stock", "gt.0");
        response = await fetch(legacy, { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } });
        rows = response.ok ? await response.json() as Record<string, unknown>[] : [];
      }
      if (!active) return;
      if (rows[0]) {
        const nextProduct = normalizeProduct(rows[0]);
        setProduct(nextProduct);
        setQuantity(nextProduct.minOrder);
      } else {
        setNotFound(true);
      }
      setLoading(false);
    }

    void loadProduct();
    return () => { active = false; };
  }, [demoProduct, productId]);

  const gallery = product ? [product.imageUrl, ...product.imageUrls].filter((url, index, list) => Boolean(url) && list.indexOf(url) === index) : [];
  const artIndex = product ? demoProductArtIndex(product.id) : 0;
  const related = product ? demoProducts.filter((item) => item.id !== product.id).slice(0, 4) : [];

  function addToCart() {
    if (!product) return;
    writeCart(addCartItem(readCart(), product, quantity));
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2600);
  }

  async function toggleFavorite() {
    if (!product) return;
    const next = !favorite;
    setFavoriteState(next);
    await setFavorite(product.id, next);
  }

  if (loading) return <main className="product-page-state"><span className="product-loader"/><strong>Тауар жүктелуде…</strong></main>;

  if (notFound || !product) return <main className="product-page-state"><span className="not-found-icon">⌕</span><h1>Тауар табылмады</h1><p>Тауар өшірілген, жарияланбаған немесе сілтеме дұрыс емес.</p><Link href="/marketplace">Marketplace-ке оралу</Link></main>;

  return <main className="product-detail-shell">
    <header className="product-header">
      <Link className="product-logo" href="/marketplace"><span>▲</span><div><strong>ALSAT</strong><small>MARKETPLACE</small></div></Link>
      <Link className="product-catalog-link" href="/marketplace#popular-categories">☰ <span>Каталог</span></Link>
      <Link className="product-search-link" href="/marketplace">Тауарларды іздеу <b>⌕</b></Link>
      <nav><Link href="/marketplace/account?tab=favorites">♡</Link><Link href="/marketplace">🛒</Link><Link className="product-login" href="/marketplace/account">Кіру / Тіркелу</Link></nav>
    </header>

    <div className="product-detail-page">
      <nav className="product-breadcrumb" aria-label="Навигация"><Link href="/marketplace">Басты бет</Link><span>›</span><Link href="/marketplace#popular-categories">{product.category}</Link><span>›</span><span>{product.subcategory}</span></nav>

      <section className="product-main-grid">
        <div className="product-gallery">
          {gallery.length > 1 && <div className="product-thumbnails">{gallery.map((image, index) => <button className={index === activeImage ? "active" : ""} key={image} onClick={() => setActiveImage(index)}><img src={image} alt=""/></button>)}</div>}
          <div className={gallery.length ? "product-main-image has-photo" : `product-main-image product-sprite-${artIndex}`}>
            {gallery.length > 0 && <img src={gallery[activeImage] || gallery[0]} alt={product.name}/>}<button className={favorite ? "active" : ""} onClick={() => void toggleFavorite()} aria-label="Таңдаулыларға қосу">{favorite ? "♥" : "♡"}</button>
          </div>
        </div>

        <div className="product-information">
          <span className="product-detail-brand">{product.brand || "ALSAT VERIFIED"}</span>
          <h1>{product.name}</h1>
          <div className="product-rating"><span>★★★★★</span><b>5.0</b><a href="#description">Сипаттама</a><small>SKU: {product.sku}</small></div>
          <p className="product-lead">{product.description}</p>
          {product.bulletPoints.length > 0 && <ul>{product.bulletPoints.map((item) => <li key={item}>{item}</li>)}</ul>}
          <div className="product-company"><span>✓</span><div><small>Тексерілген жеткізуші</small><strong>{product.sellerName}</strong></div><b>›</b></div>
        </div>

        <aside className="product-buy-box">
          <small>Бірлік бағасы</small><strong className="product-detail-price">{money.format(product.price)}</strong>
          <span className="vat-note">Баға ҚҚС шарттарына сай көрсетіледі</span>
          <div className="stock-status"><i/>Қоймада бар: <b>{product.stock} {product.unit}</b></div>
          <label>Саны <small>Минимум: {product.minOrder} {product.unit}</small></label>
          <div className="product-quantity"><button onClick={() => setQuantity((value) => Math.max(product.minOrder, value - product.minOrder))}>−</button><input aria-label="Тауар саны" type="number" min={product.minOrder} max={product.stock} step={product.minOrder} value={quantity} onChange={(event) => setQuantity(Math.max(product.minOrder, Math.min(product.stock, Number(event.target.value) || product.minOrder)))}/><button onClick={() => setQuantity((value) => Math.min(product.stock, value + product.minOrder))}>+</button></div>
          <div className="product-total"><span>Жалпы сома</span><strong>{money.format(product.price * quantity)}</strong></div>
          <button className="add-product-button" onClick={addToCart}>{added ? "✓ Себетке қосылды" : "Себетке қосу"}</button>
          <Link className="buy-product-button" href="/marketplace?cart=open" onClick={addToCart}>Сатып алуға өту</Link>
          <div className="buy-assurances"><span>▣ <b>Қауіпсіз төлем</b><small>Freedom Pay арқылы</small></span><span>▱ <b>Бақыланатын жеткізу</b><small>Қойма QR және маршрут</small></span><span>↺ <b>Қайтару шарттары</b><small>Офертаға сәйкес</small></span></div>
        </aside>
      </section>

      <section className="product-description-section" id="description">
        <div className="description-copy"><span>ТАУАР ТУРАЛЫ</span><h2>Сипаттамасы</h2><p>{product.description}</p><p>Тапсырыс Alsat Workspace жүйесіне түседі. Жеткізуші растағаннан кейін тауар қойма арқылы QR бақылауымен экспедиторға беріледі.</p></div>
        <div className="specification-card"><h2>Негізгі сипаттамалар</h2><dl><div><dt>Бренд</dt><dd>{product.brand || "Көрсетілмеген"}</dd></div>{product.manufacturer && <div><dt>Өндіруші</dt><dd>{product.manufacturer}</dd></div>}{product.model && <div><dt>Модель</dt><dd>{product.model}</dd></div>}<div><dt>Артикул / SKU</dt><dd>{product.sku}</dd></div>{product.barcode && <div><dt>Штрихкод</dt><dd>{product.barcode}</dd></div>}<div><dt>Категория</dt><dd>{product.category}</dd></div><div><dt>Подкатегория</dt><dd>{product.subcategory}</dd></div><div><dt>Өлшем бірлігі</dt><dd>{product.unit}</dd></div><div><dt>Минималды тапсырыс</dt><dd>{product.minOrder} {product.unit}</dd></div>{product.countryOfOrigin && <div><dt>Өндірілген ел</dt><dd>{product.countryOfOrigin}</dd></div>}{product.weightKg != null && <div><dt>Салмағы</dt><dd>{product.weightKg} кг</dd></div>}{product.warrantyMonths > 0 && <div><dt>Кепілдік</dt><dd>{product.warrantyMonths} ай</dd></div>}{Object.entries(product.attributes).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl></div>
      </section>

      <section className="product-service-strip"><article><i>▱</i><div><strong>Жеткізу</strong><span>Мерзімі тапсырыс расталғанда көрсетіледі</span></div></article><article><i>▣</i><div><strong>Төлем</strong><span>Шотпен немесе Freedom Pay қосылғаннан кейін картамен</span></div></article><article><i>⌾</i><div><strong>Сапа кепілдігі</strong><span>Тексерілген жеткізуші және бақыланатын логистика</span></div></article></section>

      {related.length > 0 && <section className="related-products"><div><h2>Ұқсас ұсыныстар</h2><Link href="/marketplace#offers">Барлығын көру</Link></div><div className="related-product-grid">{related.map((item) => <Link href={`/marketplace/product/${item.id}`} key={item.id}><span className={`related-art product-sprite-${demoProductArtIndex(item.id)}`}/><small>{item.brand}</small><strong>{item.name}</strong><b>{money.format(item.price)}</b></Link>)}</div></section>}
    </div>

    <footer className="product-footer"><div><Link className="product-logo light" href="/marketplace"><span>▲</span><div><strong>ALSAT</strong><small>MARKETPLACE</small></div></Link><p>Бизнеске арналған сенімді B2B платформа</p></div><div><strong>Сатып алушыға</strong><Link href="/legal/payment">Төлем және қауіпсіздік</Link><Link href="/legal/delivery">Жеткізу шарттары</Link><Link href="/legal/refund">Қайтару шарттары</Link></div><div><strong>Құқықтық ақпарат</strong><Link href="/legal/offer">Жария оферта</Link><Link href="/legal/privacy">Құпиялық саясаты</Link><Link href="/legal/terms">Пайдалану ережелері</Link></div><div><strong>«Krausz &amp; Deisler» ЖШС</strong><span>БСН 090740009232</span><a href="tel:+77003003009">+7 (700) 300-30-09</a><span>Алматы қ., Айналмалы көшесі, 69А</span></div></footer>

    {added && <div className="product-added-toast">✓ Тауар себетке қосылды <Link href="/marketplace?cart=open">Себетке өту</Link></div>}
  </main>;
}
