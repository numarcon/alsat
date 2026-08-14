"use client";

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import { defaultProductCategory, defaultProductSubcategory, getProductSubcategories, productCategoryGroups } from "../lib/product-categories";
import type { ProductCatalogItem } from "../lib/product-types";

type AttributeRow = { name: string; value: string };

const formSteps = [
  ["product-identity", "1", "Идентификация"],
  ["product-content", "2", "Контент"],
  ["product-media", "3", "Суреттер"],
  ["product-offer", "4", "Баға және ұсыныс"],
  ["product-inventory", "5", "Қалдық және логистика"],
  ["product-variants", "6", "Варианттар"],
  ["product-channels", "7", "Жариялау"],
] as const;

export default function ProductFormEnhanced({
  onSubmit,
  onCancel,
  initialProduct,
  status = "",
}: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onCancel: () => void;
  initialProduct?: ProductCatalogItem;
  status?: string;
}) {
  const initialCategory = initialProduct?.category || defaultProductCategory;
  const initialSubcategory = initialProduct?.subcategory || getProductSubcategories(initialCategory)[0] || defaultProductSubcategory;
  const [category, setCategory] = useState(initialCategory);
  const [subcategory, setSubcategory] = useState(initialSubcategory);
  const [hasVariants, setHasVariants] = useState(initialProduct?.hasVariants ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [localPreviews, setLocalPreviews] = useState<string[]>([]);
  const [attributes, setAttributes] = useState<AttributeRow[]>(() => {
    const rows = Object.entries(initialProduct?.attributes ?? {}).map(([name, value]) => ({ name, value }));
    return rows.length ? rows : [{ name: "", value: "" }];
  });

  const subcategories = useMemo(() => getProductSubcategories(category), [category]);
  const existingImages = initialProduct?.imageUrls?.length
    ? initialProduct.imageUrls
    : initialProduct?.imageUrl
      ? [initialProduct.imageUrl]
      : [];
  const visibleImages = [...existingImages, ...localPreviews].slice(0, 8);

  useEffect(() => () => {
    localPreviews.forEach((url) => URL.revokeObjectURL(url));
  }, [localPreviews]);

  function changeCategory(event: ChangeEvent<HTMLSelectElement>) {
    const nextCategory = event.target.value;
    const nextSubcategories = getProductSubcategories(nextCategory);
    setCategory(nextCategory);
    setSubcategory(nextSubcategories[0] || "Өзге");
  }

  function chooseImages(event: ChangeEvent<HTMLInputElement>) {
    localPreviews.forEach((url) => URL.revokeObjectURL(url));
    const files = Array.from(event.target.files ?? []).slice(0, Math.max(0, 8 - existingImages.length));
    setLocalPreviews(files.map((file) => URL.createObjectURL(file)));
  }

  function jumpTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function updateAttribute(index: number, field: keyof AttributeRow, value: string) {
    setAttributes((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  }

  function addAttribute() {
    setAttributes((current) => [...current, { name: "", value: "" }]);
  }

  function removeAttribute(index: number) {
    setAttributes((current) => current.length === 1 ? [{ name: "", value: "" }] : current.filter((_, rowIndex) => rowIndex !== index));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    setSubmitting(true);
    const result = onSubmit(event);
    if (result instanceof Promise) void result.finally(() => setSubmitting(false));
    else setSubmitting(false);
  }

  return <section className="form-page universal-product-page">
    <div className="page-actions product-form-heading">
      <div><button className="back" type="button" onClick={onCancel}>← Тауарлар</button><h2>{initialProduct ? "Тауарды өзгерту" : "Жаңа тауар енгізу"}</h2><p>Amazon Seller тәрізді толық карточка: контент, ұсыныс, қойма, логистика және жариялау.</p></div>
      <span className="listing-quality"><b>7 бөлім</b><small>Толық карточка</small></span>
    </div>

    <form className="product-form universal-product-form" onSubmit={handleSubmit}>
      <aside className="product-form-steps" aria-label="Тауар формасының бөлімдері">
        <strong>Тауар карточкасы</strong>
        {formSteps.map(([id, number, label]) => <button type="button" key={id} onClick={() => jumpTo(id)}><i>{number}</i><span>{label}</span></button>)}
        <small>* Міндетті өрістер</small>
      </aside>

      <div className="product-form-sections">
        <section className="card form-card" id="product-identity">
          <header><span>1</span><div><h3>Тауар идентификациясы</h3><p>Marketplace каталогындағы орны мен бірегей деректері.</p></div></header>
          <div className="two">
            <label>Негізгі категория *<select required name="category" value={category} onChange={changeCategory}>{productCategoryGroups.map((item) => <option value={item.name} key={item.name}>{item.name}</option>)}</select></label>
            <label>Подкатегория *<select required name="subcategory" value={subcategory} onChange={(event) => setSubcategory(event.target.value)}>{subcategories.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
          </div>
          <label>Тауар атауы *<input required name="name" defaultValue={initialProduct?.name ?? ""} maxLength={200} placeholder="Мысалы, Samsung Galaxy S25 256 GB көк" /></label>
          <div className="three">
            <label>Бренд *<input required name="brand" defaultValue={initialProduct?.brand ?? ""} placeholder="Samsung" /></label>
            <label>Өндіруші<input name="manufacturer" defaultValue={initialProduct?.manufacturer ?? ""} placeholder="Samsung Electronics" /></label>
            <label>Модель<input name="model" defaultValue={initialProduct?.model ?? ""} placeholder="SM-S931B" /></label>
          </div>
          <div className="three">
            <label>Seller SKU *<input required name="sku" defaultValue={initialProduct?.sku ?? ""} placeholder="SAM-S25-256-BLU" /></label>
            <label>Баркод түрі<select name="barcodeType" defaultValue={initialProduct?.barcodeType ?? "EAN-13"}><option>EAN-13</option><option>UPC</option><option>GTIN</option><option>ISBN</option><option>QR</option><option>Баркод жоқ</option></select></label>
            <label>Баркод<input name="barcode" defaultValue={initialProduct?.barcode ?? ""} inputMode="numeric" placeholder="4870123456789" /></label>
          </div>
        </section>

        <section className="card form-card" id="product-content">
          <header><span>2</span><div><h3>Сипаттама және іздеу</h3><p>Сатып алушы шешім қабылдауы үшін толық контент енгізіңіз.</p></div></header>
          <label>Толық сипаттама *<textarea required name="description" defaultValue={initialProduct?.description ?? ""} rows={6} maxLength={4000} placeholder="Материал, қолдану мақсаты, комплектация және маңызды ерекшеліктер…" /></label>
          <fieldset className="bullet-fieldset"><legend>Негізгі артықшылықтар</legend>{Array.from({ length: 5 }).map((_, index) => <label key={index}><span>{index + 1}</span><input name="bulletPoint" defaultValue={initialProduct?.bulletPoints?.[index] ?? ""} placeholder={`${index + 1}-артықшылық`} /></label>)}</fieldset>
          <div className="two">
            <label>Іздеу сөздері<input name="searchTerms" defaultValue={initialProduct?.searchTerms ?? ""} placeholder="үтірмен бөліңіз: телефон, смартфон, android" /></label>
            <label>Шығарылған ел<input name="countryOfOrigin" defaultValue={initialProduct?.countryOfOrigin ?? ""} placeholder="Қазақстан" /></label>
          </div>
          <label>Marketplace-тағы қысқа атау<input name="marketplaceTitle" defaultValue={initialProduct?.marketplaceTitle ?? ""} maxLength={160} placeholder="Бос қалса негізгі атау қолданылады" /></label>
          <label>Marketplace қысқа сипаттамасы<textarea name="marketplaceDescription" defaultValue={initialProduct?.marketplaceDescription ?? ""} rows={3} maxLength={1000} placeholder="Каталог карточкасында көрінетін қысқа мәтін" /></label>
        </section>

        <section className="card form-card" id="product-media">
          <header><span>3</span><div><h3>Суреттер</h3><p>Бірінші сурет негізгі болады. 8 суретке дейін жүктеуге болады.</p></div></header>
          <label className="multi-image-upload"><span>＋</span><strong>Суреттерді таңдаңыз</strong><small>JPG, PNG, WebP · әр файл 5 MB дейін</small><input type="file" name="images" accept="image/jpeg,image/png,image/webp" multiple onChange={chooseImages} /></label>
          {visibleImages.length > 0 && <div className="product-image-grid">{visibleImages.map((url, index) => <figure key={`${url}-${index}`}><img src={url} alt={`Тауар суреті ${index + 1}`} />{index === 0 && <figcaption>Негізгі</figcaption>}</figure>)}</div>}
        </section>

        <section className="card form-card" id="product-offer">
          <header><span>4</span><div><h3>Баға және сату ұсынысы</h3><p>Кіру, бөлшек және көтерме бағаны бөлек басқарыңыз.</p></div></header>
          <div className="price-grid">
            <label>Кіру бағасы *<input required type="number" min="0" step="0.01" name="purchasePrice" defaultValue={initialProduct?.purchasePrice ?? 0} /></label>
            <label>Сату бағасы *<input required type="number" min="0" step="0.01" name="salePrice" defaultValue={initialProduct?.salePrice ?? initialProduct?.price ?? 0} /></label>
            <label>Көтерме бағасы *<input required type="number" min="0" step="0.01" name="wholesalePrice" defaultValue={initialProduct?.wholesalePrice ?? 0} /></label>
          </div>
          <div className="three">
            <label>Валюта<select name="currency" defaultValue={initialProduct?.currency ?? "KZT"}><option>KZT</option><option>USD</option><option>EUR</option><option>CNY</option></select></label>
            <label>ҚҚС, %<input type="number" min="0" max="100" step="0.01" name="vatRate" defaultValue={initialProduct?.vatRate ?? 12} /></label>
            <label>СӨ комиссиясы, %<input type="number" min="0" max="100" step="0.01" name="commission" defaultValue={initialProduct?.commission ?? 0} /></label>
          </div>
          <div className="two">
            <label>Минималды тапсырыс<input type="number" min="1" name="minOrder" defaultValue={initialProduct?.minOrder ?? 1} /></label>
            <label>Бір тапсырыстағы максимум<input type="number" min="1" name="maxOrder" defaultValue={initialProduct?.maxOrder ?? ""} placeholder="Шектеусіз" /></label>
          </div>
        </section>

        <section className="card form-card" id="product-inventory">
          <header><span>5</span><div><h3>Қалдық және логистика</h3><p>Қойма есебі мен жеткізу құнын есептеуге қажетті деректер.</p></div></header>
          <div className="three">
            <label>Қоймадағы саны *<input required type="number" min="0" name="stock" defaultValue={initialProduct?.stock ?? 0} /></label>
            <label>Өлшем бірлігі<select name="unit" defaultValue={initialProduct?.unit ?? "дана"}><option>дана</option><option>қаптама</option><option>комплект</option><option>кг</option><option>г</option><option>л</option><option>мл</option><option>м</option><option>м²</option><option>м³</option><option>жұп</option><option>орама</option></select></label>
            <label>Қайта тапсырыс шегі<input type="number" min="0" name="reorderPoint" defaultValue={initialProduct?.reorderPoint ?? 0} /></label>
          </div>
          <label>Қоймадағы орналасуы<input name="warehouseLocation" defaultValue={initialProduct?.warehouseLocation ?? ""} placeholder="A-01-02-03" /></label>
          <div className="four">
            <label>Салмақ, кг<input type="number" min="0" step="0.001" name="weightKg" defaultValue={initialProduct?.weightKg ?? ""} /></label>
            <label>Ұзындығы, см<input type="number" min="0" step="0.01" name="lengthCm" defaultValue={initialProduct?.lengthCm ?? ""} /></label>
            <label>Ені, см<input type="number" min="0" step="0.01" name="widthCm" defaultValue={initialProduct?.widthCm ?? ""} /></label>
            <label>Биіктігі, см<input type="number" min="0" step="0.01" name="heightCm" defaultValue={initialProduct?.heightCm ?? ""} /></label>
          </div>
          <div className="three">
            <label>Қаптамадағы саны<input type="number" min="1" name="packageQuantity" defaultValue={initialProduct?.packageQuantity ?? 1} /></label>
            <label>Жеткізу класы<select name="shippingClass" defaultValue={initialProduct?.shippingClass ?? "standard"}><option value="standard">Стандарт</option><option value="oversize">Ірі габарит</option><option value="fragile">Сынғыш</option><option value="cold">Салқын тізбек</option><option value="digital">Цифрлық</option></select></label>
            <label>Кепілдік, ай<input type="number" min="0" name="warrantyMonths" defaultValue={initialProduct?.warrantyMonths ?? 0} /></label>
          </div>
        </section>

        <section className="card form-card" id="product-variants">
          <header><span>6</span><div><h3>Варианттар және атрибуттар</h3><p>Түс, өлшем, көлем сияқты нұсқаларды және категориялық сипаттарды көрсетіңіз.</p></div></header>
          <label className="channel standalone-channel"><input type="checkbox" name="hasVariants" checked={hasVariants} onChange={(event) => setHasVariants(event.target.checked)} /><span><strong>Бұл тауардың варианттары бар</strong><small>Мысалы: түсі — ақ/қара, өлшемі — S/M/L.</small></span></label>
          {hasVariants && <div className="variant-grid">{[0, 1, 2].map((index) => <div className="two" key={index}><label>Вариант атауы<input name="variantName" defaultValue={initialProduct?.variantOptions?.[index]?.name ?? ""} placeholder={index === 0 ? "Түс" : index === 1 ? "Өлшем" : "Материал"} /></label><label>Мәндері<input name="variantValues" defaultValue={initialProduct?.variantOptions?.[index]?.values.join(", ") ?? ""} placeholder="Ақ, Қара, Көк" /></label></div>)}</div>}
          <fieldset className="attribute-fieldset"><legend>Қосымша сипаттар</legend>{attributes.map((row, index) => <div className="attribute-row" key={index}><input name="attributeName" value={row.name} onChange={(event) => updateAttribute(index, "name", event.target.value)} placeholder="Материал" /><input name="attributeValue" value={row.value} onChange={(event) => updateAttribute(index, "value", event.target.value)} placeholder="Алюминий" /><button type="button" onClick={() => removeAttribute(index)} aria-label="Атрибутты өшіру">×</button></div>)}<button className="add-attribute" type="button" onClick={addAttribute}>＋ Атрибут қосу</button></fieldset>
        </section>

        <section className="card form-card channels" id="product-channels">
          <header><span>7</span><div><h3>Күйі, қауіпсіздік және жариялау</h3><p>Тауардың жағдайын және қай арнада көрінетінін таңдаңыз.</p></div></header>
          <div className="three">
            <label>Тауар жағдайы<select name="condition" defaultValue={initialProduct?.condition ?? "new"}><option value="new">Жаңа</option><option value="refurbished">Қалпына келтірілген</option><option value="used">Қолданылған</option></select></label>
            <label>Сертификат / декларация<input name="certification" defaultValue={initialProduct?.certification ?? ""} placeholder="EAC, KZ сертификат №" /></label>
            <label className="compact-check"><input type="checkbox" name="dangerousGoods" defaultChecked={initialProduct?.dangerousGoods ?? false} /><span>Қауіпті жүк</span></label>
          </div>
          <label className="channel"><input type="checkbox" name="workspace" defaultChecked={initialProduct?.workspace ?? true} /><span><strong>Workspace-та белсенді</strong><small>Компанияның ішкі каталогында көрінеді.</small></span></label>
          <label className="channel"><input type="checkbox" name="agents" defaultChecked={initialProduct?.agents ?? true} /><span><strong>Сауда өкілдеріне көрсету</strong><small>СӨ каталогынан тапсырыс жинауға болады.</small></span></label>
          <label className="channel marketplace-channel"><input type="checkbox" name="marketplace" defaultChecked={initialProduct?.marketplace ?? false} /><span><strong>Marketplace-те жариялау</strong><small>Ашық каталогқа категория және подкатегория бойынша шығарылады.</small></span></label>
        </section>

        {status && <div className={status.startsWith("Сақтау қатесі") ? "product-form-status error" : "product-form-status"}>{status}</div>}
        <div className="form-actions universal-form-actions"><button type="button" onClick={onCancel} disabled={submitting}>Болдырмау</button><button className="primary" type="submit" disabled={submitting}>{submitting ? "Сақталуда…" : initialProduct ? "Өзгерістерді сақтау →" : "Тауарды сақтау және жариялау →"}</button></div>
      </div>
    </form>
  </section>;
}
