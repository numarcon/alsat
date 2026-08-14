import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { type CatalogProduct, normalizeProduct } from "./marketplace-products";

export const MARKETPLACE_CART_KEY = "alsat-marketplace-cart-v2";
export const MARKETPLACE_FAVORITES_KEY = "alsat-marketplace-favorites-v1";

export type CartMap = Record<string, number>;
export type BuyerProfile = {
  buyerCompanyId?: string;
  businessName: string;
  bin: string;
  contactName: string;
  phone: string;
  email: string;
};
export type DeliveryAddress = {
  id?: string;
  label: string;
  city: string;
  address: string;
  contactName: string;
  phone: string;
  save: boolean;
};
export type MarketplaceCheckoutResult = {
  checkoutGroupId: string;
  orders: Array<{ orderId: string; sellerCompanyId: string; total: number }>;
  total: number;
};
export type BuyerOrder = {
  id: string;
  checkoutGroupId: string | null;
  companyId: string;
  status: string;
  warehouseStatus: string;
  paymentStatus: string;
  paymentMethod: string;
  total: number;
  createdAt: string;
  itemCount: number;
  sellerName: string;
  delivery: Record<string, unknown>;
  items: Array<{ id: string; productId: string; name: string; sku: string; quantity: number; unitPrice: number; lineTotal: number }>;
};

export const marketplaceCatalogSelect = "id,company_id,seller_name,name,sku,price,stock,category,subcategory,brand,manufacturer,model,barcode,description,bullet_points,search_terms,country_of_origin,unit,currency,vat_rate,max_order,weight_kg,length_cm,width_cm,height_cm,package_quantity,shipping_class,warranty_months,condition,certification,has_variants,variant_options,attributes,image_urls,marketplace_title,marketplace_description,marketplace_category,marketplace_subcategory,marketplace_image_url,image_url,marketplace_min_order,marketplace_updated_at,created_at";

export function readCart(): CartMap {
  if (typeof window === "undefined") return {};
  for (const key of [MARKETPLACE_CART_KEY, "alsat-marketplace-cart-v1"]) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "{}");
      if (!parsed || typeof parsed !== "object") continue;
      const safe = Object.fromEntries(Object.entries(parsed)
        .filter(([id, quantity]) => typeof id === "string" && Number.isFinite(Number(quantity)) && Number(quantity) > 0)
        .map(([id, quantity]) => [id, Math.floor(Number(quantity))]));
      if (Object.keys(safe).length || key === MARKETPLACE_CART_KEY) return safe;
    } catch { /* Try the previous cart version or return an empty cart. */ }
  }
  return {};
}

export function writeCart(cart: CartMap) {
  if (typeof window === "undefined") return;
  localStorage.setItem(MARKETPLACE_CART_KEY, JSON.stringify(cart));
  localStorage.removeItem("alsat-marketplace-cart-v1");
  window.dispatchEvent(new CustomEvent("alsat:cart-updated", { detail: cart }));
}

export function addCartItem(cart: CartMap, product: CatalogProduct, amount = product.minOrder): CartMap {
  const current = Number(cart[product.id] || 0);
  const step = Math.max(1, product.minOrder);
  const requested = Math.max(step, current + Math.max(step, amount));
  const maximum = Math.min(product.stock, product.maxOrder || product.stock);
  return { ...cart, [product.id]: Math.max(step, Math.min(maximum, requested)) };
}

export async function loadMarketplaceCatalog(): Promise<{ products: CatalogProduct[]; migrationReady: boolean; error?: string }> {
  if (!supabase) return { products: [], migrationReady: false, error: "supabase-unconfigured" };
  const viewResult = await supabase
    .from("marketplace_catalog")
    .select(marketplaceCatalogSelect)
    .gt("stock", 0)
    .order("created_at", { ascending: false });
  if (!viewResult.error) {
    return { products: (viewResult.data ?? []).map((row) => normalizeProduct(row as Record<string, unknown>)), migrationReady: true };
  }

  const legacyResult = await supabase
    .from("products")
    .select("id,company_id,name,sku,price,stock,category,subcategory,brand,description,bullet_points,unit,image_urls,marketplace_title,marketplace_description,marketplace_category,marketplace_subcategory,marketplace_image_url,image_url,marketplace_min_order")
    .eq("workspace_active", true)
    .eq("marketplace_published", true)
    .gt("stock", 0)
    .order("created_at", { ascending: false });
  if (legacyResult.error) return { products: [], migrationReady: false, error: legacyResult.error.message };
  return { products: (legacyResult.data ?? []).map((row) => normalizeProduct(row as Record<string, unknown>)), migrationReady: false };
}

export async function getMarketplaceUser(): Promise<User | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export async function loadBuyerProfile(user: User): Promise<{ profile: BuyerProfile; addresses: DeliveryAddress[]; migrationReady: boolean }> {
  const fallback: BuyerProfile = {
    businessName: typeof user.user_metadata?.business_name === "string" ? user.user_metadata.business_name : "",
    bin: "",
    contactName: typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "",
    phone: typeof user.user_metadata?.phone === "string" ? user.user_metadata.phone : "",
    email: user.email || "",
  };
  if (!supabase) return { profile: fallback, addresses: [], migrationReady: false };
  const [profileResult, addressResult] = await Promise.all([
    supabase.from("marketplace_profiles").select("buyer_company_id,business_name,bin,contact_name,phone,email").eq("user_id", user.id).maybeSingle(),
    supabase.from("marketplace_addresses").select("id,label,city,address,contact_name,phone,is_default").eq("user_id", user.id).order("is_default", { ascending: false }).order("created_at", { ascending: false }),
  ]);
  if (profileResult.error || addressResult.error) return { profile: fallback, addresses: [], migrationReady: false };
  const row = profileResult.data;
  const profile: BuyerProfile = row ? {
    buyerCompanyId: row.buyer_company_id || undefined,
    businessName: row.business_name || "",
    bin: row.bin || "",
    contactName: row.contact_name || "",
    phone: row.phone || "",
    email: row.email || user.email || "",
  } : fallback;
  const addresses = (addressResult.data ?? []).map((address) => ({
    id: address.id,
    label: address.label,
    city: address.city,
    address: address.address,
    contactName: address.contact_name,
    phone: address.phone,
    save: true,
  }));
  return { profile, addresses, migrationReady: true };
}

export async function placeMarketplaceCheckout(input: {
  profile: BuyerProfile;
  address: DeliveryAddress;
  lines: Array<{ product: CatalogProduct; quantity: number }>;
  note: string;
  paymentMethod: "invoice" | "card" | "cashless";
}): Promise<MarketplaceCheckoutResult> {
  if (!supabase) throw new Error("Supabase қосылмаған.");
  if (!input.lines.length) throw new Error("Себет бос.");
  const { data, error } = await supabase.rpc("place_marketplace_order", {
    p_profile: {
      buyer_company_id: input.profile.buyerCompanyId || null,
      business_name: input.profile.businessName,
      bin: input.profile.bin || null,
      contact_name: input.profile.contactName,
      phone: input.profile.phone,
      email: input.profile.email || null,
    },
    p_address: {
      label: input.address.label,
      city: input.address.city,
      address: input.address.address,
      contact_name: input.address.contactName || input.profile.contactName,
      phone: input.address.phone || input.profile.phone,
      save: input.address.save,
    },
    p_items: input.lines.map(({ product, quantity }) => ({ product_id: product.id, quantity })),
    p_note: input.note.trim() || null,
    p_payment_method: input.paymentMethod,
  });
  if (error) {
    if (/place_marketplace_order|schema cache|function/i.test(error.message)) {
      throw new Error("Marketplace commerce migration әлі Supabase-ке қосылмаған.");
    }
    throw new Error(error.message);
  }
  const result = data as { checkout_group_id?: string; orders?: Array<{ order_id: string; seller_company_id: string; total: number }>; total?: number };
  if (!result.checkout_group_id || !result.orders?.length) throw new Error("Тапсырыс нәтижесі толық емес.");
  return {
    checkoutGroupId: result.checkout_group_id,
    orders: result.orders.map((order) => ({ orderId: order.order_id, sellerCompanyId: order.seller_company_id, total: Number(order.total || 0) })),
    total: Number(result.total || 0),
  };
}

export async function loadBuyerOrders(): Promise<BuyerOrder[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("get_marketplace_orders");
  if (error || !Array.isArray(data)) return [];
  return data.map((raw) => {
    const order = raw as Record<string, unknown>;
    const rawItems = Array.isArray(order.items) ? order.items : [];
    const items = rawItems.map((rawItem) => {
      const item = rawItem as Record<string, unknown>;
      return { id: String(item.id), productId: String(item.product_id), name: String(item.name || "Тауар"), sku: String(item.sku || ""), quantity: Number(item.quantity || 0), unitPrice: Number(item.unit_price || 0), lineTotal: Number(item.line_total || 0) };
    });
    return {
      id: String(order.id),
      checkoutGroupId: typeof order.checkout_group_id === "string" ? order.checkout_group_id : null,
      companyId: String(order.company_id),
      status: String(order.status || "new"),
      warehouseStatus: String(order.warehouse_status || "new"),
      paymentStatus: String(order.payment_status || "unpaid"),
      paymentMethod: String(order.payment_method || "invoice"),
      total: Number(order.total || 0),
      createdAt: String(order.created_at || ""),
      itemCount: items.length,
      sellerName: String(order.seller_name || "Жеткізуші"),
      delivery: order.delivery && typeof order.delivery === "object" ? order.delivery as Record<string, unknown> : {},
      items,
    };
  });
}

export async function cancelBuyerOrder(orderId: string) {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("cancel_marketplace_order", { p_order_id: orderId });
  return !error && data === true;
}

export function readFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(MARKETPLACE_FAVORITES_KEY) || "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch { return []; }
}

export function writeFavorites(productIds: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(MARKETPLACE_FAVORITES_KEY, JSON.stringify([...new Set(productIds)]));
  window.dispatchEvent(new CustomEvent("alsat:favorites-updated", { detail: productIds }));
}

export async function loadFavoriteIds(): Promise<string[]> {
  const local = readFavorites();
  const user = await getMarketplaceUser();
  if (!supabase || !user) return local;
  const { data, error } = await supabase.from("marketplace_favorites").select("product_id").eq("user_id", user.id);
  if (error) return local;
  const remote = (data ?? []).map((row) => row.product_id);
  const merged = [...new Set([...local.filter((id) => id.startsWith("demo-")), ...remote])];
  writeFavorites(merged);
  return merged;
}

export async function setFavorite(productId: string, active: boolean) {
  const next = active ? [...new Set([...readFavorites(), productId])] : readFavorites().filter((id) => id !== productId);
  writeFavorites(next);
  const user = await getMarketplaceUser();
  if (!supabase || !user || productId.startsWith("demo-")) return;
  if (active) await supabase.from("marketplace_favorites").upsert({ user_id: user.id, product_id: productId });
  else await supabase.from("marketplace_favorites").delete().eq("user_id", user.id).eq("product_id", productId);
}

export async function saveBuyerProfile(user: User, profile: BuyerProfile) {
  if (!supabase) throw new Error("Supabase қосылмаған.");
  const { error } = await supabase.from("marketplace_profiles").upsert({
    user_id: user.id,
    buyer_company_id: profile.buyerCompanyId || null,
    business_name: profile.businessName,
    bin: profile.bin || null,
    contact_name: profile.contactName,
    phone: profile.phone,
    email: profile.email || user.email || null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}
