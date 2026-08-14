"use client";

import type { ProductCatalogItem } from "../lib/product-types";

const money = (value: number) => `${Math.round(Number(value) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} ₸`;

export default function ProductListEnhanced({ products, onAdd, onToggle, onEdit, onDelete }: { products: ProductCatalogItem[]; onAdd: () => void; onToggle: (id: string | number, field: "workspace" | "agents" | "marketplace") => void; onEdit: (product: ProductCatalogItem) => void; onDelete: (product: ProductCatalogItem) => void }) {
  return <>
    <div className="page-actions"><p>Барлық тауарды, бағaны және Marketplace жариялануын басқарасыз.</p><button type="button" className="primary" onClick={onAdd}>+ Тауар қосу</button></div>
    <section className="card product-card"><div className="table-head"><span>Тауар</span><span>Бағалар</span><span>Қойма</span><span>Көрінуі</span><span /></div>
      {products.length ? products.map((product) => <article className="product-row enhanced-product-row" key={product.id}>
        <div className="product-name"><span className="product-thumb">{product.imageUrl ? <img src={product.imageUrl} alt="" /> : "▦"}</span><div><strong>{product.name}</strong><small>{product.brand ? `${product.brand} · ` : ""}{product.sku} · {product.category || "Категория жоқ"} / {product.subcategory || "Подкатегория жоқ"}</small></div></div>
        <div className="product-price-stack"><b>Сату: {money(product.salePrice ?? product.price)}</b><small>Кіру: {money(product.purchasePrice ?? 0)}</small><small>Көтерме: {money(product.wholesalePrice ?? 0)}</small></div>
        <span>{product.stock} {product.unit || "дана"}<small className="stock-hint">Мин. {product.minOrder || 1}</small></span>
        <div className="visibility"><button type="button" className="edit-product-button" onClick={() => onEdit(product)}>Өзгерту</button><button type="button" className="delete-product-button" onClick={() => onDelete(product)}>Өшіру</button><Toggle label="Workspace" value={product.workspace} onChange={() => onToggle(product.id, "workspace")} /><Toggle label="СӨ" value={product.agents} onChange={() => onToggle(product.id, "agents")} /><Toggle label="Market" value={product.marketplace} onChange={() => onToggle(product.id, "marketplace")} /></div>
      </article>) : <div className="empty">Тауар жоқ. Бірінші тауарды қосыңыз.</div>}
    </section>
  </>;
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: () => void }) { return <button type="button" onClick={onChange} className={value ? "toggle yes" : "toggle"}><i /> {label}</button>; }
