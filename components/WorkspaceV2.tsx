"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { getWorkspaceIdentity, roleLabel, rolePath, WorkspaceRole } from "../lib/workspace-auth";
import { rememberCompany } from "../lib/company-bootstrap";
import ProductFormEnhanced from "./ProductFormEnhanced";
import ProductListEnhanced from "./ProductListEnhanced";
import CompanyAgents from "./CompanyAgents";
import CompanyOrders from "./CompanyOrders";
import CompanyCommissions from "./CompanyCommissions";
import type { ProductCatalogItem, ProductVariantOption } from "../lib/product-types";

type Screen = "dashboard" | "products" | "customers" | "orders" | "agents" | "commissions" | "modules" | "product-form";
type Product = ProductCatalogItem;
type Customer = { id: string; name: string; address: string | null; contact_name: string | null; phone: string | null };
type Metrics = { products: number; orders: number; customers: number; agents: number; stock: number; revenue: number; commissions: number };
type RecentOrder = { id: string; total: number; status: string; customer: string };

const nav: Array<{ id: Screen; label: string; icon: IconName }> = [
  { id: "dashboard", label: "Басты бет", icon: "home" },
  { id: "products", label: "Тауарлар", icon: "box" },
  { id: "customers", label: "Клиенттер", icon: "store" },
  { id: "orders", label: "Тапсырыстар", icon: "orders" },
  { id: "agents", label: "Сауда өкілдері", icon: "agent" },
  { id: "commissions", label: "Комиссиялар", icon: "wallet" },
  { id: "modules", label: "Қосымша модульдер", icon: "grid" },
];

const statusLabels: Record<string, string> = {
  draft: "Жоба", submitted: "Жіберілді", confirmed: "Бекітілді", picking: "Жиналуда",
  out_for_delivery: "Жеткізілуде", delivered: "Жеткізілді", cancelled: "Бас тартылды",
};

function formatNumber(value: number) {
  const rounded = Math.round(Number(value) || 0);
  const sign = rounded < 0 ? "−" : "";
  return `${sign}${Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`;
}

function formatMoney(value: number) { return `${formatNumber(value)} ₸`; }

function optionalNumber(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text === "" ? null : Number(text);
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function variantArray(value: unknown): ProductVariantOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const option = item as Record<string, unknown>;
    const name = typeof option.name === "string" ? option.name : "";
    const values = stringArray(option.values);
    return name && values.length ? [{ name, values }] : [];
  });
}

function attributeRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

export default function WorkspaceV2() {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("Alsat Workspace");
  const [role, setRole] = useState<WorkspaceRole>("owner");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({ products: 0, orders: 0, customers: 0, agents: 0, stock: 0, revenue: 0, commissions: 0 });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productStatus, setProductStatus] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  const loadProducts = useCallback(async (targetCompanyId: string) => {
    if (!supabase) return;
    const { data, error: productError } = await supabase
      .from("products")
      .select("id,name,sku,price,purchase_price,sale_price,wholesale_price,image_url,image_urls,stock,commission_rate,workspace_active,sales_agent_visible,marketplace_published,category,subcategory,brand,manufacturer,model,barcode,barcode_type,description,bullet_points,search_terms,country_of_origin,unit,currency,vat_rate,marketplace_min_order,max_order,reorder_point,warehouse_location,weight_kg,length_cm,width_cm,height_cm,package_quantity,shipping_class,warranty_months,condition,certification,dangerous_goods,has_variants,variant_options,attributes,marketplace_title,marketplace_description")
      .eq("company_id", targetCompanyId)
      .order("created_at", { ascending: false });
    if (productError) { setError(productError.message); return; }
    setProducts((data ?? []).map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku ?? "",
      price: Number(product.sale_price || product.price || 0),
      purchasePrice: Number(product.purchase_price || 0),
      salePrice: Number(product.sale_price || product.price || 0),
      wholesalePrice: Number(product.wholesale_price || 0),
      imageUrl: product.image_url ?? "",
      imageUrls: stringArray(product.image_urls),
      stock: Number(product.stock || 0),
      commission: Number(product.commission_rate || 0),
      workspace: Boolean(product.workspace_active),
      agents: Boolean(product.sales_agent_visible),
      marketplace: Boolean(product.marketplace_published),
      category: product.category ?? "Басқа тауарлар",
      subcategory: product.subcategory ?? "Өзге",
      brand: product.brand ?? "",
      manufacturer: product.manufacturer ?? "",
      model: product.model ?? "",
      barcode: product.barcode ?? "",
      barcodeType: product.barcode_type ?? "EAN-13",
      description: product.description ?? "",
      bulletPoints: stringArray(product.bullet_points),
      searchTerms: product.search_terms ?? "",
      countryOfOrigin: product.country_of_origin ?? "",
      unit: product.unit ?? "дана",
      currency: product.currency ?? "KZT",
      vatRate: Number(product.vat_rate || 0),
      minOrder: Number(product.marketplace_min_order || 1),
      maxOrder: product.max_order == null ? undefined : Number(product.max_order),
      reorderPoint: Number(product.reorder_point || 0),
      warehouseLocation: product.warehouse_location ?? "",
      weightKg: product.weight_kg == null ? undefined : Number(product.weight_kg),
      lengthCm: product.length_cm == null ? undefined : Number(product.length_cm),
      widthCm: product.width_cm == null ? undefined : Number(product.width_cm),
      heightCm: product.height_cm == null ? undefined : Number(product.height_cm),
      packageQuantity: Number(product.package_quantity || 1),
      shippingClass: product.shipping_class ?? "standard",
      warrantyMonths: Number(product.warranty_months || 0),
      condition: product.condition ?? "new",
      certification: product.certification ?? "",
      dangerousGoods: Boolean(product.dangerous_goods),
      hasVariants: Boolean(product.has_variants),
      variantOptions: variantArray(product.variant_options),
      attributes: attributeRecord(product.attributes),
      marketplaceTitle: product.marketplace_title ?? "",
      marketplaceDescription: product.marketplace_description ?? "",
    })));
  }, []);

  const loadMetrics = useCallback(async (targetCompanyId: string) => {
    if (!supabase) return;
    const [productResult, orderResult, customerResult, agentResult, commissionResult] = await Promise.all([
      supabase.from("products").select("id,stock").eq("company_id", targetCompanyId),
      supabase.from("orders").select("id,total,status,customer_id,created_at").eq("company_id", targetCompanyId).order("created_at", { ascending: false }),
      supabase.from("customers").select("id,name").eq("company_id", targetCompanyId),
      supabase.from("company_sales_agents").select("sales_agent_id", { count: "exact", head: true }).eq("company_id", targetCompanyId).eq("status", "approved"),
      supabase.from("commissions").select("amount").eq("company_id", targetCompanyId),
    ]);
    const firstError = productResult.error || orderResult.error || customerResult.error || agentResult.error || commissionResult.error;
    if (firstError) { setError(firstError.message); return; }
    const customerMap = new Map((customerResult.data ?? []).map((customer) => [customer.id, customer.name]));
    const orders = orderResult.data ?? [];
    setMetrics({
      products: productResult.data?.length ?? 0,
      stock: (productResult.data ?? []).reduce((sum, product) => sum + Number(product.stock || 0), 0),
      orders: orders.length,
      customers: customerResult.data?.length ?? 0,
      agents: agentResult.count ?? 0,
      revenue: orders.reduce((sum, order) => sum + Number(order.total || 0), 0),
      commissions: (commissionResult.data ?? []).reduce((sum, commission) => sum + Number(commission.amount || 0), 0),
    });
    setRecentOrders(orders.slice(0, 4).map((order) => ({
      id: order.id,
      total: Number(order.total || 0),
      status: order.status,
      customer: order.customer_id ? customerMap.get(order.customer_id) ?? "Клиент" : "Клиент",
    })));
  }, []);

  useEffect(() => {
    let active = true;
    async function restore() {
      const isLocalPreview = window.location.hostname === "localhost"
        && new URLSearchParams(window.location.search).get("ui") === "preview";
      if (isLocalPreview) {
        setCompanyId("00000000-0000-0000-0000-000000000000");
        setCompanyName("Krausz Electric");
        setRole("owner");
        setProducts([
          { id: 1, name: "KRAUSZ Шам A60 12W E27 6500K", sku: "KLZ-A60-12W-6500", price: 650, salePrice: 650, purchasePrice: 450, wholesalePrice: 590, stock: 1250, commission: 5, workspace: true, agents: true, marketplace: true },
          { id: 2, name: "KRAUSZ Прожектор 100W 6500K IP65", sku: "KLZ-FL-100W-6500", price: 8500, salePrice: 8500, purchasePrice: 6900, wholesalePrice: 7900, stock: 48, commission: 5, workspace: true, agents: true, marketplace: false },
          { id: 3, name: "KRAUSZ Панель LED 36W 595×595", sku: "KLZ-PL-36W-6500", price: 4200, salePrice: 4200, purchasePrice: 3350, wholesalePrice: 3900, stock: 76, commission: 4, workspace: true, agents: false, marketplace: true },
        ]);
        setMetrics({ products: 36, orders: 128, customers: 84, agents: 12, stock: 3456, revenue: 18_450_000, commissions: 922_500 });
        setRecentOrders([
          { id: "10045", total: 245000, status: "confirmed", customer: "Строймаг" },
          { id: "10044", total: 185000, status: "submitted", customer: "ЭлектроДом" },
          { id: "10043", total: 315000, status: "out_for_delivery", customer: "Техносвет" },
          { id: "10042", total: 70000, status: "delivered", customer: "Светлый дом" },
        ]);
        setLoading(false);
        return;
      }
      if (!supabase) { if (active) { setError("Supabase қосылмаған."); setLoading(false); } return; }
      const identity = await getWorkspaceIdentity();
      if (!active) return;
      if (!identity.user) { window.location.replace("/workspace-login"); return; }
      const remembered = localStorage.getItem("alsat-company-id");
      const membership = identity.memberships.find((item) => item.company_id === remembered && ["owner", "admin", "manager"].includes(item.role))
        ?? identity.memberships.find((item) => ["owner", "admin", "manager"].includes(item.role));
      if (!membership) {
        const operationalRole = identity.memberships[0];
        if (operationalRole) window.location.replace(rolePath(operationalRole.role));
        else setError("Бұл аккаунтқа компания рөлі тіркелмеген.");
        setLoading(false);
        return;
      }
      const { data: company, error: companyError } = await supabase.from("companies").select("name").eq("id", membership.company_id).single();
      if (!active) return;
      if (companyError) { setError(companyError.message); setLoading(false); return; }
      const name = company?.name || "Компания Workspace";
      rememberCompany(membership.company_id, name);
      setCompanyId(membership.company_id);
      setCompanyName(name);
      setRole(membership.role);
      await Promise.all([loadProducts(membership.company_id), loadMetrics(membership.company_id)]);
      if (active) setLoading(false);
    }
    void restore();
    return () => { active = false; };
  }, [loadMetrics, loadProducts]);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    if (supabase) await supabase.auth.signOut({ scope: "local" });
    Object.keys(localStorage).filter((key) => key.startsWith("alsat-")).forEach((key) => localStorage.removeItem(key));
    window.location.replace("/workspace-login");
  }

  function openProductForm(product: Product | null = null) {
    setEditingProduct(product);
    setProductStatus("");
    setScreen("product-form");
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !companyId) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const purchasePrice = Number(values.get("purchasePrice") || 0);
    const salePrice = Number(values.get("salePrice") || 0);
    const wholesalePrice = Number(values.get("wholesalePrice") || 0);
    const imageFiles = values.getAll("images").filter((item): item is File => item instanceof File && item.size > 0);
    let imageUrls = editingProduct?.imageUrls?.length
      ? [...editingProduct.imageUrls]
      : editingProduct?.imageUrl
        ? [editingProduct.imageUrl]
        : [];
    setProductStatus("Сақталуда…");
    try {
      for (const imageFile of imageFiles.slice(0, Math.max(0, 8 - imageUrls.length))) {
        const extension = imageFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${companyId}/${crypto.randomUUID()}.${extension}`;
        const upload = await supabase.storage.from("product-images").upload(path, imageFile, { cacheControl: "3600", upsert: false, contentType: imageFile.type });
        if (upload.error) throw upload.error;
        imageUrls.push(supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl);
      }
      imageUrls = imageUrls.slice(0, 8);
      const imageUrl = imageUrls[0] || "";
      const name = String(values.get("name") || "").trim();
      const category = String(values.get("category") || "Басқа тауарлар");
      const subcategory = String(values.get("subcategory") || "Өзге");
      const description = String(values.get("description") || "").trim();
      const bulletPoints = values.getAll("bulletPoint").map(String).map((item) => item.trim()).filter(Boolean);
      const variantNames = values.getAll("variantName").map(String);
      const variantValues = values.getAll("variantValues").map(String);
      const variantOptions = variantNames.flatMap((variantName, index) => {
        const variantNameClean = variantName.trim();
        const optionValues = (variantValues[index] || "").split(",").map((item) => item.trim()).filter(Boolean);
        return variantNameClean && optionValues.length ? [{ name: variantNameClean, values: optionValues }] : [];
      });
      const attributeNames = values.getAll("attributeName").map(String);
      const attributeValues = values.getAll("attributeValue").map(String);
      const attributes = Object.fromEntries(attributeNames.flatMap((attributeName, index) => {
        const cleanName = attributeName.trim();
        const cleanValue = (attributeValues[index] || "").trim();
        return cleanName && cleanValue ? [[cleanName, cleanValue]] : [];
      }));
      const marketplacePublished = values.get("marketplace") === "on";
      const payload = {
        company_id: companyId,
        name,
        sku: String(values.get("sku") || "").trim(),
        price: salePrice,
        purchase_price: purchasePrice,
        sale_price: salePrice,
        wholesale_price: wholesalePrice,
        stock: Number(values.get("stock") || 0),
        commission_rate: Number(values.get("commission") || 0),
        workspace_active: values.get("workspace") === "on",
        sales_agent_visible: values.get("agents") === "on",
        marketplace_published: marketplacePublished,
        category,
        subcategory,
        brand: String(values.get("brand") || "").trim() || null,
        manufacturer: String(values.get("manufacturer") || "").trim() || null,
        model: String(values.get("model") || "").trim() || null,
        barcode: String(values.get("barcode") || "").trim() || null,
        barcode_type: String(values.get("barcodeType") || "EAN-13"),
        description,
        bullet_points: bulletPoints,
        search_terms: String(values.get("searchTerms") || "").trim() || null,
        country_of_origin: String(values.get("countryOfOrigin") || "").trim() || null,
        unit: String(values.get("unit") || "дана"),
        currency: String(values.get("currency") || "KZT"),
        vat_rate: Number(values.get("vatRate") || 0),
        marketplace_min_order: Number(values.get("minOrder") || 1),
        max_order: optionalNumber(values.get("maxOrder")),
        reorder_point: Number(values.get("reorderPoint") || 0),
        warehouse_location: String(values.get("warehouseLocation") || "").trim() || null,
        weight_kg: optionalNumber(values.get("weightKg")),
        length_cm: optionalNumber(values.get("lengthCm")),
        width_cm: optionalNumber(values.get("widthCm")),
        height_cm: optionalNumber(values.get("heightCm")),
        package_quantity: Number(values.get("packageQuantity") || 1),
        shipping_class: String(values.get("shippingClass") || "standard"),
        warranty_months: Number(values.get("warrantyMonths") || 0),
        condition: String(values.get("condition") || "new"),
        certification: String(values.get("certification") || "").trim() || null,
        dangerous_goods: values.get("dangerousGoods") === "on",
        has_variants: values.get("hasVariants") === "on",
        variant_options: variantOptions,
        attributes,
        marketplace_title: String(values.get("marketplaceTitle") || "").trim() || name,
        marketplace_description: String(values.get("marketplaceDescription") || "").trim() || description,
        marketplace_category: category,
        marketplace_subcategory: subcategory,
        marketplace_updated_at: marketplacePublished ? new Date().toISOString() : null,
        image_url: imageUrl || null,
        image_urls: imageUrls,
        marketplace_image_url: imageUrl || null,
      };
      const result = editingProduct
        ? await supabase.from("products").update(payload).eq("id", editingProduct.id).eq("company_id", companyId)
        : await supabase.from("products").insert(payload);
      if (result.error) throw result.error;
      form.reset();
      await Promise.all([loadProducts(companyId), loadMetrics(companyId)]);
      setNotice(editingProduct ? "Тауар өзгерістері сақталды." : "Жаңа тауар сақталды.");
      setScreen("products");
    } catch (saveError) {
      setProductStatus(`Сақтау қатесі: ${saveError instanceof Error ? saveError.message : "Supabase қатесі"}`);
    }
  }

  async function toggleProduct(id: string | number, field: "workspace" | "agents" | "marketplace") {
    if (!supabase || !companyId) return;
    const product = products.find((item) => item.id === id);
    if (!product) return;
    const value = !product[field];
    const column = field === "workspace" ? "workspace_active" : field === "agents" ? "sales_agent_visible" : "marketplace_published";
    setProducts((current) => current.map((item) => item.id === id ? { ...item, [field]: value } : item));
    const { error: updateError } = await supabase.from("products").update({ [column]: value }).eq("id", id).eq("company_id", companyId);
    if (updateError) { setNotice(updateError.message); await loadProducts(companyId); }
  }

  async function deleteProduct(product: Product) {
    if (!supabase || !companyId || !window.confirm(`«${product.name}» тауарын өшіру керек пе?`)) return;
    const { error: deleteError } = await supabase.from("products").delete().eq("id", product.id).eq("company_id", companyId);
    if (deleteError) setNotice(deleteError.message);
    else { await Promise.all([loadProducts(companyId), loadMetrics(companyId)]); setNotice("Тауар өшірілді."); }
  }

  const activeProducts = useMemo(() => products.filter((product) => product.workspace), [products]);

  if (loading) return <main className="ws2-loading"><WorkspaceLogo /><span className="ws2-loader" /><p>Workspace жүктелуде…</p></main>;
  if (error || !companyId) return <main className="ws2-error-page"><WorkspaceLogo /><h1>Workspace ашылмады</h1><p>{error || "Компания табылмады."}</p><Link className="ws2-primary-link" href="/workspace-login">Кіру бетіне оралу</Link></main>;

  const currentLabel = screen === "product-form" ? (editingProduct ? "Тауарды өзгерту" : "Жаңа тауар") : nav.find((item) => item.id === screen)?.label;

  return <div className="ws2">
    <aside className="ws2-sidebar">
      <WorkspaceLogo />
      <p className="ws2-sidebar-caption">Компания кабинеті</p>
      <nav className="ws2-nav">{nav.map((item) => <button key={item.id} className={screen === item.id || (screen === "product-form" && item.id === "products") ? "active" : ""} onClick={() => setScreen(item.id)}><WorkspaceIcon name={item.icon} /><span>{item.label}</span></button>)}</nav>
      <div className="ws2-sidebar-links"><span>Операциялық модульдер</span><Link href="/">Marketplace ↗</Link><Link href="/warehouse">Қойма QR ↗</Link><Link href="/dispatcher">Экспедитор және маршрут ↗</Link><Link href="/admin">Alsat Admin ↗</Link></div>
      <div className="ws2-sidebar-user"><span>{companyName[0] || "A"}</span><div><strong>{companyName}</strong><small>{roleLabel(role)}</small></div></div>
      <button className="ws2-logout" onClick={() => void logout()} disabled={loggingOut}><WorkspaceIcon name="logout" />{loggingOut ? "Шығып жатыр…" : "Шығу"}</button>
    </aside>

    <section className="ws2-content">
      <header className="ws2-topbar"><button className="ws2-menu" onClick={() => setScreen("modules")} aria-label="Мәзір"><WorkspaceIcon name="menu" /></button><WorkspaceLogo compact /><div><small>ALSAT WORKSPACE</small><strong>{currentLabel}</strong></div><button className="ws2-bell" onClick={() => setNotice("Барлық дерек синхрондалды.")} aria-label="Хабарламалар"><WorkspaceIcon name="bell" /><i /></button></header>
      <main className="ws2-main">
        {notice && <div className="ws2-notice"><span>✓</span>{notice}<button onClick={() => setNotice("")}>×</button></div>}
        {screen === "dashboard" && <WorkspaceDashboard companyName={companyName} metrics={metrics} orders={recentOrders} onNavigate={setScreen} />}
        {screen === "products" && <ProductListEnhanced products={products} onAdd={() => openProductForm()} onEdit={(product) => openProductForm(product)} onToggle={(id, field) => void toggleProduct(id, field)} onDelete={(product) => void deleteProduct(product)} />}
        {screen === "product-form" && <ProductFormEnhanced initialProduct={editingProduct ?? undefined} status={productStatus} onSubmit={saveProduct} onCancel={() => setScreen("products")} />}
        {screen === "customers" && <WorkspaceCustomers companyId={companyId} onChanged={() => void loadMetrics(companyId)} />}
        {screen === "orders" && <CompanyOrders companyId={companyId} />}
        {screen === "agents" && <CompanyAgents companyId={companyId} productCount={activeProducts.filter((product) => product.agents).length} productName={activeProducts[0]?.name} />}
        {screen === "commissions" && <CompanyCommissions companyId={companyId} />}
        {screen === "modules" && <WorkspaceModules />}
      </main>
    </section>

    <nav className="ws2-bottom-nav">{nav.slice(0, 5).map((item) => <button key={item.id} className={screen === item.id ? "active" : ""} onClick={() => setScreen(item.id)}><WorkspaceIcon name={item.icon} /><span>{item.label}</span></button>)}</nav>
  </div>;
}

function WorkspaceDashboard({ companyName, metrics, orders, onNavigate }: { companyName: string; metrics: Metrics; orders: RecentOrder[]; onNavigate: (screen: Screen) => void }) {
  return <>
    <header className="ws2-page-header"><div><p>Қайырлы күн!</p><h1>{companyName}</h1><span>Компанияңыздың сатуы мен операциялары бір жерде.</span></div><button onClick={() => onNavigate("product-form")}><WorkspaceIcon name="plus" />Тауар қосу</button></header>
    <section className="ws2-hero"><div><span>Жалпы тапсырыстар сомасы</span><strong>{formatMoney(metrics.revenue)}</strong><small>{metrics.orders} тапсырыс · {metrics.customers} клиент</small></div><div className="ws2-hero-stats"><article><span>Қоймадағы қалдық</span><b>{formatNumber(metrics.stock)}</b></article><article><span>Белсенді СӨ</span><b>{metrics.agents}</b></article><article><span>Комиссия</span><b>{formatMoney(metrics.commissions)}</b></article></div></section>
    <h2 className="ws2-section-title">Бүгінгі көрсеткіштер</h2>
    <div className="ws2-stats"><MetricCard icon="box" label="Тауарлар" value={metrics.products} detail="Каталог" /><MetricCard icon="orders" label="Тапсырыстар" value={metrics.orders} detail="Барлығы" /><MetricCard icon="store" label="Клиенттер" value={metrics.customers} detail="Белсенді база" /><MetricCard icon="agent" label="Сауда өкілдері" value={metrics.agents} detail="Бекітілген" /></div>
    <h2 className="ws2-section-title">Жылдам әрекеттер</h2>
    <div className="ws2-quick"><button onClick={() => onNavigate("orders")}><span><WorkspaceIcon name="plus" /></span>Тапсырыс қосу</button><button onClick={() => onNavigate("products")}><span><WorkspaceIcon name="box" /></span>Тауарлар</button><button onClick={() => onNavigate("customers")}><span><WorkspaceIcon name="store" /></span>Клиент қосу</button><button onClick={() => onNavigate("modules")}><span><WorkspaceIcon name="grid" /></span>Барлық модуль</button></div>
    <div className="ws2-dashboard-grid"><section className="ws2-panel"><div className="ws2-panel-title"><div><h2>Соңғы тапсырыстар</h2><p>Нақты дерекқордан</p></div><button onClick={() => onNavigate("orders")}>Барлығын көру</button></div>{orders.length ? orders.map((order) => <div className="ws2-order" key={order.id}><span><WorkspaceIcon name="orders" /></span><div><strong>{order.customer}</strong><small>№{order.id.slice(0, 8).toUpperCase()}</small></div><div><b>{formatMoney(order.total)}</b><em>{statusLabels[order.status] || order.status}</em></div></div>) : <div className="ws2-empty"><WorkspaceIcon name="orders" /><p>Тапсырыс әлі жоқ</p></div>}</section><section className="ws2-launch"><span>ARCHITECTURE V1</span><h2>Барлық арна бір жүйеде</h2><p>Workspace, СӨ, Marketplace, қойма және экспедитор бір компания шекарасында жұмыс істейді.</p><button onClick={() => onNavigate("modules")}>Модульдерді ашу →</button></section></div>
  </>;
}

function MetricCard({ icon, label, value, detail }: { icon: IconName; label: string; value: number; detail: string }) {
  return <article><span><WorkspaceIcon name={icon} /></span><p>{label}</p><strong>{formatNumber(value)}</strong><small>{detail}</small></article>;
}

function WorkspaceCustomers({ companyId, onChanged }: { companyId: string; onChanged: () => void }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from("customers").select("id,name,address,contact_name,phone").eq("company_id", companyId).order("created_at", { ascending: false });
    if (error) setMessage(error.message); else setCustomers((data ?? []) as Customer[]);
  }, [companyId]);
  useEffect(() => { void load(); }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    const { error } = await supabase.from("customers").insert({ company_id: companyId, name: String(values.get("name")), address: String(values.get("address") || ""), contact_name: String(values.get("contact_name") || ""), phone: String(values.get("phone") || "") });
    if (error) setMessage(error.message); else { form.reset(); setMessage("Клиент сақталды."); await load(); onChanged(); }
    setBusy(false);
  }
  async function save(customer: Customer) {
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.from("customers").update({ name: customer.name, address: customer.address, contact_name: customer.contact_name, phone: customer.phone }).eq("id", customer.id).eq("company_id", companyId);
    setMessage(error ? error.message : "Клиент дерегі жаңартылды.");
    if (!error) await load();
    setBusy(false);
  }
  function patch(id: string, values: Partial<Customer>) { setCustomers((current) => current.map((customer) => customer.id === id ? { ...customer, ...values } : customer)); }

  return <><div className="ws2-module-head"><div><p>КЛИЕНТТЕР БАЗАСЫ</p><h1>Клиенттер</h1><span>{customers.length} дүкен және сауда нүктесі</span></div></div>{message && <div className="ws2-notice"><span>✓</span>{message}<button onClick={() => setMessage("")}>×</button></div>}<details className="ws2-create"><summary><WorkspaceIcon name="plus" />Жаңа клиент қосу</summary><form onSubmit={(event) => void create(event)}><div><label>Дүкен атауы<input name="name" required placeholder="Мысалы, Строймар" /></label><label>Байланыс тұлғасы<input name="contact_name" placeholder="Аты-жөні" /></label><label>Мекенжай<input name="address" placeholder="Қала, көше, ғимарат" /></label><label>Телефон<input name="phone" placeholder="+7 700 000 00 00" /></label></div><button disabled={busy}>Клиентті сақтау</button></form></details><div className="ws2-customer-grid">{customers.map((customer) => <article key={customer.id}><header><span><WorkspaceIcon name="store" /></span><div><strong>{customer.name}</strong><small>{customer.address || "Мекенжай көрсетілмеген"}</small></div><em>Белсенді</em></header><div className="ws2-customer-fields"><label>Атауы<input value={customer.name} onChange={(event) => patch(customer.id, { name: event.target.value })} /></label><label>Телефон<input value={customer.phone || ""} onChange={(event) => patch(customer.id, { phone: event.target.value })} /></label><label>Мекенжай<input value={customer.address || ""} onChange={(event) => patch(customer.id, { address: event.target.value })} /></label><label>Байланыс тұлғасы<input value={customer.contact_name || ""} onChange={(event) => patch(customer.id, { contact_name: event.target.value })} /></label></div><button disabled={busy} onClick={() => void save(customer)}>Сақтау</button></article>)}</div>{!customers.length && <div className="ws2-empty ws2-empty-large"><WorkspaceIcon name="store" /><h3>Клиенттер әлі жоқ</h3><p>Алғашқы дүкенді немесе сауда нүктесін қосыңыз.</p></div>}</>;
}

function WorkspaceModules() {
  const modules: Array<{ href: string; icon: IconName; title: string; text: string; tone: string }> = [
    { href: "/", icon: "market", title: "Alsat Marketplace", text: "Жарияланған тауарлар мен B2B тапсырыстар", tone: "green" },
    { href: "/warehouse", icon: "warehouse", title: "Қойма және QR", text: "Жинау, стикер, QR арқылы тапсыру", tone: "blue" },
    { href: "/dispatcher", icon: "truck", title: "Экспедитор", text: "Маршрут, жанармай, чат және жеткізу", tone: "amber" },
    { href: "/admin", icon: "shield", title: "Alsat Admin", text: "Платформа, компаниялар және жүйе күйі", tone: "dark" },
    { href: "/agent", icon: "agent", title: "СӨ мобильді кабинет", text: "Клиент, каталог, тапсырыс және комиссия", tone: "violet" },
  ];
  return <><div className="ws2-module-head"><div><p>ALSAT ECOSYSTEM</p><h1>Қосымша модульдер</h1><span>Architecture v1 шекарасында жұмыс істейтін барлық арна</span></div></div><div className="ws2-module-grid">{modules.map((module) => <Link href={module.href} className={`ws2-module-card ${module.tone}`} key={module.href}><span><WorkspaceIcon name={module.icon} /></span><div><h2>{module.title}</h2><p>{module.text}</p></div><b>Ашу →</b></Link>)}</div></>;
}

function WorkspaceLogo({ compact = false }: { compact?: boolean }) {
  return <div className={compact ? "ws2-logo compact" : "ws2-logo"}><span>A</span>{!compact && <div><b>ALSAT</b><small>WORKSPACE</small></div>}</div>;
}

type IconName = "home" | "box" | "store" | "orders" | "agent" | "wallet" | "grid" | "logout" | "menu" | "bell" | "plus" | "market" | "warehouse" | "truck" | "shield";
const iconPaths: Record<IconName, React.ReactNode> = {
  home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>,
  box: <><path d="m4 7 8-4 8 4-8 4-8-4Z" /><path d="M4 7v10l8 4 8-4V7M12 11v10" /></>,
  store: <><path d="M4 9h16l-2-5H6L4 9Z" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
  orders: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 3v4h6V3M8 12h8M8 16h6" /></>,
  agent: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-5 3.4-8 8-8s8 3 8 8" /></>,
  wallet: <><path d="M3 6h16v14H3zM3 8h16M15 13h6v4h-6a2 2 0 0 1 0-4Z" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  logout: <><path d="M10 5H4v14h6M14 8l4 4-4 4M18 12H8" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  market: <><path d="M3 9h18M5 9v11h14V9M7 4h10l2 5H5l2-5Z" /><path d="M9 20v-6h6v6" /></>,
  warehouse: <><path d="M3 21V8l9-5 9 5v13M7 21v-9h10v9M7 16h10" /></>,
  truck: <><path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z" /><circle cx="7" cy="19" r="2" /><circle cx="18" cy="19" r="2" /></>,
  shield: <><path d="M12 3 4 6v5c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6l-8-3Z" /><path d="m9 12 2 2 4-5" /></>,
};
function WorkspaceIcon({ name }: { name: IconName }) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name]}</svg>; }
