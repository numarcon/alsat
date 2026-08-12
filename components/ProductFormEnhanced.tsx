"use client";

import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";

type ProductFormProduct = { name: string; sku: string; stock: number; price?: number; purchasePrice?: number; salePrice?: number; wholesalePrice?: number; commission: number; imageUrl?: string; workspace: boolean; agents: boolean; marketplace: boolean };

export default function ProductFormEnhanced({ onSubmit, onCancel, initialProduct, status = "" }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>; onCancel: () => void; initialProduct?: ProductFormProduct; status?: string }) {
  const [preview, setPreview] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    setSubmitting(true);
    const result = onSubmit(event);
    if (result instanceof Promise) void result.finally(() => setSubmitting(false));
    else setSubmitting(false);
  }

  return <section className="form-page"><div className="page-actions"><div><button className="back" type="button" onClick={onCancel}>← Тауарлар</button><h2>{initialProduct ? "Тауарды өзгерту" : "Жаңа тауар"}</h2><p>Тауардың суретін, өзіндік құнын және барлық сату бағаларын бір жерде енгізіңіз.</p></div></div><form className="product-form" onSubmit={handleSubmit}>
    <section className="card form-card"><h3>Негізгі ақпарат</h3><label>Тауар атауы<input required name="name" defaultValue={initialProduct?.name ?? ""} placeholder="Мысалы, Лампа KRAUSZ A60 10W" /></label><div className="two"><label>Артикул<input required name="sku" defaultValue={initialProduct?.sku ?? ""} placeholder="A6010W" /></label><label>Қоймадағы саны<input required type="number" min="0" name="stock" defaultValue={initialProduct?.stock ?? 0} placeholder="0" /></label></div><label>Категория<input name="category" placeholder="Шамдар, кабель, автоматика" /></label></section>
    <section className="card form-card"><h3>Баға саясаты</h3><p className="form-card-hint">Үш баға бөлек сақталады. Marketplace-та әдепкіде сату бағасы көрсетіледі.</p><div className="price-grid"><label>Кіру бағасы, ₸<input required type="number" min="0" step="0.01" name="purchasePrice" defaultValue={initialProduct?.purchasePrice ?? 0} placeholder="0" /></label><label>Сату бағасы, ₸<input required type="number" min="0" step="0.01" name="salePrice" defaultValue={initialProduct?.salePrice ?? initialProduct?.price ?? 0} placeholder="0" /></label><label>Көтерме бағасы, ₸<input required type="number" min="0" step="0.01" name="wholesalePrice" defaultValue={initialProduct?.wholesalePrice ?? 0} placeholder="0" /></label></div><div className="two"><label>СӨ комиссиясы, %<input required type="number" min="0" max="100" step="0.01" name="commission" defaultValue={initialProduct?.commission ?? 0} placeholder="5" /></label><label>Marketplace минимумы, дана<input type="number" min="1" name="minOrder" defaultValue="1" /></label></div></section>
    <section className="card form-card product-media-card"><h3>Тауар суреті</h3><p className="form-card-hint">JPG, PNG немесе WebP. Сурет Marketplace карточкасында көрсетіледі.</p><label className="product-image-upload">{preview ? <img src={preview} alt="Тауар алдын ала көрінісі" /> : initialProduct?.imageUrl ? <img src={initialProduct.imageUrl} alt="Ағымдағы тауар суреті" /> : <><span>↑</span><strong>Суретті жүктеу</strong><small>Файлды таңдаңыз</small></>}<input type="file" name="image" accept="image/jpeg,image/png,image/webp" onChange={chooseImage} /></label></section>
    <section className="card form-card channels"><div><h3>Көріну және жариялау</h3><p>Әр арнаны жеке қосыңыз.</p></div><label className="channel"><input type="checkbox" name="workspace" defaultChecked={initialProduct?.workspace ?? true}/><span><strong>Workspace-та белсенді</strong><small>Компанияның ішкі каталогында көрінеді.</small></span></label><label className="channel"><input type="checkbox" name="agents" defaultChecked={initialProduct?.agents ?? true}/><span><strong>Сауда өкілдеріне көрсету</strong><small>СӨ каталогынан тапсырыс жинауға болады.</small></span></label><label className="channel"><input type="checkbox" name="marketplace" defaultChecked={initialProduct?.marketplace ?? false}/><span><strong>Marketplace-те жариялау</strong><small>Ашық Marketplace каталогына шығарылады.</small></span></label></section>
    {status && <div className={status.startsWith("Сақтау қатесі") ? "product-form-status error" : "product-form-status"}>{status}</div>}<div className="form-actions"><button type="button" onClick={onCancel} disabled={submitting}>Болдырмау</button><button className="primary" type="submit" disabled={submitting}>{submitting ? "Сақталуда…" : initialProduct ? "Өзгерістерді сақтау →" : "Тауарды сақтау →"}</button></div>
  </form></section>;
}
