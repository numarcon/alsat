"use client";

import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";

export default function ProductFormEnhanced({ onSubmit, onCancel }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  const [preview, setPreview] = useState("");

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
  }

  return <section className="form-page"><div className="page-actions"><div><button className="back" type="button" onClick={onCancel}>← Тауарлар</button><h2>Жаңа тауар</h2><p>Тауардың суретін, өзіндік құнын және барлық сату бағаларын бір жерде енгізіңіз.</p></div></div><form className="product-form" onSubmit={onSubmit}>
    <section className="card form-card"><h3>Негізгі ақпарат</h3><label>Тауар атауы<input required name="name" placeholder="Мысалы, Лампа KRAUSZ A60 10W" /></label><div className="two"><label>Артикул<input required name="sku" placeholder="A6010W" /></label><label>Қоймадағы саны<input required type="number" min="0" name="stock" placeholder="0" /></label></div><label>Категория<input name="category" placeholder="Шамдар, кабель, автоматика" /></label></section>
    <section className="card form-card"><h3>Баға саясаты</h3><p className="form-card-hint">Үш баға бөлек сақталады. Marketplace-та әдепкіде сату бағасы көрсетіледі.</p><div className="price-grid"><label>Кіру бағасы, ₸<input required type="number" min="0" step="0.01" name="purchasePrice" placeholder="0" /></label><label>Сату бағасы, ₸<input required type="number" min="0" step="0.01" name="salePrice" placeholder="0" /></label><label>Көтерме бағасы, ₸<input required type="number" min="0" step="0.01" name="wholesalePrice" placeholder="0" /></label></div><div className="two"><label>СӨ комиссиясы, %<input required type="number" min="0" max="100" step="0.01" name="commission" placeholder="5" /></label><label>Marketplace минимумы, дана<input type="number" min="1" name="minOrder" defaultValue="1" /></label></div></section>
    <section className="card form-card product-media-card"><h3>Тауар суреті</h3><p className="form-card-hint">JPG, PNG немесе WebP. Сурет Marketplace карточкасында көрсетіледі.</p><label className="product-image-upload">{preview ? <img src={preview} alt="Тауар алдын ала көрінісі" /> : <><span>↑</span><strong>Суретті жүктеу</strong><small>Файлды таңдаңыз</small></>}<input type="file" name="image" accept="image/jpeg,image/png,image/webp" onChange={chooseImage} /></label></section>
    <section className="card form-card channels"><div><h3>Көріну және жариялау</h3><p>Әр арнаны жеке қосыңыз.</p></div><label className="channel"><input type="checkbox" name="workspace" defaultChecked/><span><strong>Workspace-та белсенді</strong><small>Компанияның ішкі каталогында көрінеді.</small></span></label><label className="channel"><input type="checkbox" name="agents" defaultChecked/><span><strong>Сауда өкілдеріне көрсету</strong><small>СӨ каталогынан тапсырыс жинауға болады.</small></span></label><label className="channel"><input type="checkbox" name="marketplace"/><span><strong>Marketplace-те жариялау</strong><small>Ашық Marketplace каталогына шығарылады.</small></span></label></section>
    <div className="form-actions"><button type="button" onClick={onCancel}>Болдырмау</button><button className="primary" type="submit">Тауарды сақтау →</button></div>
  </form></section>;
}
