"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";
import DriverNavigation from "../../components/DriverNavigation";
import MapErrorBoundary from "../../components/MapErrorBoundary";
import SignaturePad from "../../components/SignaturePad";
import { supabase } from "../../lib/supabase";
import { parsePickupQrValue } from "../../lib/warehouse-qr";
import { AlsatIcon, AlsatMark } from "../../components/AlsatIcon";

type Screen = "dashboard" | "orders" | "detail" | "proof" | "route" | "stops" | "scanner" | "receive" | "done" | "reports" | "notifications" | "vehicle" | "profile" | "fuel" | "documents" | "support" | "more";
type Stop = { name: string; address: string; time: string; distance: string; status: "Жолда" | "Күтуде" | "Жоспарда" | "Жеткізілді"; coordinates: [number, number] };
type PickupResult = { ok: boolean; code?: string; message: string };
type DeliveryPaymentMethod = "cash" | "transfer" | "credit";
type DeliveryProofPayload = { paymentMethod: DeliveryPaymentMethod; amount: number; recipientName: string; signatureDataUrl: string; photo: File | null; note: string };
type RouteOrder = { code: string; orderId?: string; companyId?: string; stop: Stop; contactName?: string; phone?: string; total?: number; items?: Array<{ name: string; quantity: number; price: number }> };
type RemoteRouteOrder = {
  id: string;
  company_id: string;
  total: number | string;
  warehouse_status: string | null;
  sticker_code: string | null;
  customers: { name: string; address: string | null; contact_name: string | null; phone: string | null; latitude: number | null; longitude: number | null } | Array<{ name: string; address: string | null; contact_name: string | null; phone: string | null; latitude: number | null; longitude: number | null }> | null;
  order_items?: Array<{ quantity: number; unit_price: number | string; products: { name: string } | Array<{ name: string }> | null }>;
};

const stops: Stop[] = [
  { name: "Строймаг", address: "Алматы қ., Райымбек 348", time: "10:30", distance: "2.4 км", status: "Жолда", coordinates: [76.8897, 43.2383] },
  { name: "ЭлектроДом", address: "Алматы қ., Төле би 215", time: "11:15", distance: "5.7 км", status: "Жолда", coordinates: [76.912, 43.256] },
  { name: "Техносвет", address: "Алматы қ., Абай 68", time: "12:00", distance: "3.2 км", status: "Күтуде", coordinates: [76.905, 43.225] },
  { name: "Светлый дом", address: "Алматы қ., Сайын 22", time: "13:00", distance: "4.1 км", status: "Жоспарда", coordinates: [76.87, 43.245] },
  { name: "1000 Мелочей", address: "Алматы қ., Жетысу 12", time: "14:00", distance: "6.8 км", status: "Жоспарда", coordinates: [76.93, 43.27] },
  { name: "ПромЭлектро", address: "Алматы қ., Бауыpжан 45", time: "15:00", distance: "7.9 км", status: "Жоспарда", coordinates: [76.85, 43.22] },
];
const money = (value: number) => `${value.toLocaleString("kk-KZ")} ₸`;
const warehouseCode = (index: number) => `ST-${100045 + index}`;
const defaultCoordinates: [number, number] = [76.8897, 43.2383];

function isValidCoordinates(value: unknown): value is [number, number] {
  return Array.isArray(value)
    && value.length === 2
    && typeof value[0] === "number"
    && typeof value[1] === "number"
    && Number.isFinite(value[0])
    && Number.isFinite(value[1])
    && value[0] >= -180
    && value[0] <= 180
    && value[1] >= -85
    && value[1] <= 85;
}

function sanitizeRouteOrder(value: unknown): RouteOrder | null {
  if (!value || typeof value !== "object") return null;
  const order = value as Partial<RouteOrder>;
  if (typeof order.code !== "string" || !order.stop || typeof order.stop.name !== "string") return null;
  const demoStop = stops.find((stop) => stop.name === order.stop?.name);
  return {
    ...order,
    code: order.code.toUpperCase(),
    stop: {
      name: order.stop.name,
      address: typeof order.stop.address === "string" ? order.stop.address : "Мекенжай көрсетілмеген",
      time: typeof order.stop.time === "string" ? order.stop.time : "18:00",
      distance: typeof order.stop.distance === "string" ? order.stop.distance : "Карта бойынша",
      status: order.stop.status || "Жоспарда",
      coordinates: isValidCoordinates(order.stop.coordinates) ? order.stop.coordinates : (demoStop?.coordinates ?? defaultCoordinates),
    },
  } as RouteOrder;
}

function demoRouteOrder(code: string): RouteOrder | undefined {
  const index = stops.findIndex((_, stopIndex) => code === warehouseCode(stopIndex));
  return index >= 0 ? { code, stop: stops[index] } : undefined;
}

function routeOrderFromRemote(row: RemoteRouteOrder, fallbackCode: string): RouteOrder {
  const store = Array.isArray(row.customers) ? row.customers[0] : row.customers;
  const demoStop = stops.find((stop) => stop.name === store?.name);
  const hasCoordinates = Number.isFinite(store?.latitude) && Number.isFinite(store?.longitude);
  return {
    code: (row.sticker_code || fallbackCode).toUpperCase(),
    orderId: row.id,
    companyId: row.company_id,
    stop: {
      name: store?.name || "Клиент тапсырысы",
      address: store?.address || "Мекенжай көрсетілмеген",
      time: "18:00",
      distance: "Карта бойынша",
      status: "Жоспарда",
      coordinates: hasCoordinates && isValidCoordinates([Number(store?.longitude), Number(store?.latitude)]) ? [Number(store?.longitude), Number(store?.latitude)] : (demoStop?.coordinates ?? defaultCoordinates),
    },
    contactName: store?.contact_name || undefined,
    phone: store?.phone || undefined,
    total: Number(row.total),
    items: row.order_items?.map((line, index) => {
      const product = Array.isArray(line.products) ? line.products[0] : line.products;
      return { name: product?.name || `Тауар ${index + 1}`, quantity: line.quantity, price: Number(line.unit_price) };
    }),
  };
}

function dataUrlToBlob(dataUrl: string) {
  const [header, encoded] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);base64/)?.[1] || "image/png";
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mime });
}

function safeFileExtension(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  return extension && /^[a-z0-9]{2,5}$/.test(extension) ? extension : (file.type === "image/png" ? "png" : "jpg");
}

export default function DispatcherApp() {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [logged, setLogged] = useState(false);
  const [selectedStop, setSelectedStop] = useState(stops[0]);
  const [selectedOrderCode, setSelectedOrderCode] = useState(warehouseCode(0));
  const [acceptedOrders, setAcceptedOrders] = useState<string[]>([]);
  const [routeOrders, setRouteOrders] = useState<RouteOrder[]>([]);
  const [deliveredOrders, setDeliveredOrders] = useState<string[]>([]);
  const [routeStarted, setRouteStarted] = useState(false);
  const [deliveryStateReady, setDeliveryStateReady] = useState(false);
  const [initialPickupCode, setInitialPickupCode] = useState("");
  const routeHydrationAttempted = useRef(new Set<string>());
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let active = true;
    const authorize = async (userId?: string) => {
      if (!userId) { if (active) setLogged(false); return; }
      const { data: membership } = await client.from("company_users").select("company_id").eq("user_id", userId).eq("role", "forwarder").eq("status", "active").limit(1).maybeSingle();
      if (!active) return;
      if (membership) localStorage.setItem("alsat-company-id", membership.company_id);
      setLogged(Boolean(membership));
    };
    client.auth.getSession().then(({ data }) => { void authorize(data.session?.user.id); });
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => { void authorize(session?.user.id); });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    try {
      const accepted = JSON.parse(localStorage.getItem("alsat-dispatcher-accepted") ?? "[]");
      const savedRoutes = JSON.parse(localStorage.getItem("alsat-dispatcher-route-orders") ?? "[]");
      const delivered = JSON.parse(localStorage.getItem("alsat-dispatcher-delivered") ?? "[]");
      if (Array.isArray(accepted)) setAcceptedOrders(accepted.filter((item): item is string => typeof item === "string"));
      if (Array.isArray(savedRoutes)) setRouteOrders(savedRoutes.map(sanitizeRouteOrder).filter((item): item is RouteOrder => Boolean(item)));
      if (Array.isArray(delivered)) setDeliveredOrders(delivered.filter((item): item is string => typeof item === "string"));
      setRouteStarted(localStorage.getItem("alsat-dispatcher-route-started") === "true");
    } catch {
      localStorage.removeItem("alsat-dispatcher-accepted");
      localStorage.removeItem("alsat-dispatcher-route-orders");
      localStorage.removeItem("alsat-dispatcher-delivered");
    } finally {
      setDeliveryStateReady(true);
    }
  }, []);
  useEffect(() => {
    const pickup = new URLSearchParams(window.location.search).get("pickup");
    if (pickup) {
      setInitialPickupCode(window.location.href);
      setScreen("receive");
    }
  }, []);
  useEffect(() => {
    if (!deliveryStateReady) return;
    localStorage.setItem("alsat-dispatcher-accepted", JSON.stringify(acceptedOrders));
    localStorage.setItem("alsat-dispatcher-route-orders", JSON.stringify(routeOrders));
    localStorage.setItem("alsat-dispatcher-delivered", JSON.stringify(deliveredOrders));
    localStorage.setItem("alsat-dispatcher-route-started", String(routeStarted));
  }, [acceptedOrders, deliveredOrders, deliveryStateReady, routeOrders, routeStarted]);
  useEffect(() => {
    if (!logged || !supabase || acceptedOrders.length === 0) return;
    const missingCodes = acceptedOrders.filter((code) => !routeOrders.some((order) => order.code === code) && !routeHydrationAttempted.current.has(code));
    if (missingCodes.length === 0) return;
    missingCodes.forEach((code) => routeHydrationAttempted.current.add(code));
    let active = true;
    supabase
      .from("orders")
      .select("id,company_id,total,warehouse_status,sticker_code,customers(name,address,contact_name,phone,latitude,longitude),order_items(quantity,unit_price,products(name))")
      .in("sticker_code", missingCodes)
      .then(({ data, error }) => {
        if (!active || error || !data) return;
        const restored = (data as unknown as RemoteRouteOrder[]).map((row) => routeOrderFromRemote(row, row.sticker_code || ""));
        if (restored.length === 0) return;
        setRouteOrders((current) => [...current, ...restored.filter((order) => !current.some((item) => item.code === order.code))]);
      });
    return () => { active = false; };
  }, [acceptedOrders, logged, routeOrders]);
  const rememberRouteOrder = (routeOrder: RouteOrder) => {
    setRouteOrders((current) => current.some((item) => item.code === routeOrder.code)
      ? current.map((item) => item.code === routeOrder.code ? routeOrder : item)
      : [...current, routeOrder]);
  };
  const acceptWarehouseOrder = async (rawCode: string): Promise<PickupResult> => {
    const parsed = parsePickupQrValue(rawCode);
    if (!parsed) return { ok: false, message: "QR коды танылмады. Стикерді қайта сканерлеңіз." };
    const code = parsed.stickerCode;

    if (supabase) {
      let query = supabase.from("orders").select("id,company_id,total,warehouse_status,sticker_code,customers(name,address,contact_name,phone,latitude,longitude),order_items(quantity,unit_price,products(name))").eq("sticker_code", code);
      if (parsed.orderId) query = query.eq("id", parsed.orderId);
      const { data: remoteOrder, error: findError } = await query.limit(1).maybeSingle();
      if (findError) return { ok: false, message: `Тапсырысты тексеру мүмкін болмады: ${findError.message}` };
      if (remoteOrder) {
        if (remoteOrder.warehouse_status !== "labeled" && remoteOrder.warehouse_status !== "shipped") {
          return { ok: false, message: "Қойма бұл тапсырысты әлі жинап, стикерін бекітпеген." };
        }
        if (remoteOrder.warehouse_status === "labeled") {
          const { error: updateError } = await supabase
            .from("orders")
            .update({ warehouse_status: "shipped", shipped_at: new Date().toISOString() })
            .eq("id", remoteOrder.id)
            .eq("warehouse_status", "labeled");
          if (updateError) return { ok: false, message: `Қабылдауды растау мүмкін болмады: ${updateError.message}` };
        }
        const routeOrder = routeOrderFromRemote(remoteOrder as unknown as RemoteRouteOrder, code);
        rememberRouteOrder(routeOrder);
        setAcceptedOrders((current) => current.includes(code) ? current : [...current, code]);
        setSelectedStop(routeOrder.stop);
        setSelectedOrderCode(code);
        window.history.replaceState({}, "", "/dispatcher");
        return { ok: true, code, message: remoteOrder.warehouse_status === "shipped" ? `${code} бұрын қабылданған` : `${code} · Экспедитор қабылдады` };
      }
    }

    try {
      const localOrders = JSON.parse(localStorage.getItem("alsat-warehouse-orders") ?? "[]") as Array<{ id: string; status: string; sticker?: string; store?: string; address?: string; total?: number; items?: Array<{ name: string; quantity: number; price: number }> }>;
      const localIndex = localOrders.findIndex((order) => order.sticker?.toUpperCase() === code || `ST-${order.id.replace(/\D/g, "")}` === code);
      const localOrder = localOrders[localIndex];
      if (localOrder) {
        if (localOrder.status !== "labeled" && localOrder.status !== "shipped") return { ok: false, message: "Қойма бұл тапсырысты әлі экспедиторға дайындамаған." };
        if (localOrder.status === "labeled") {
          localOrders[localIndex] = { ...localOrder, status: "shipped" };
          localStorage.setItem("alsat-warehouse-orders", JSON.stringify(localOrders));
        }
        const matchedDemo = stops.find((stop) => stop.name === localOrder.store) ?? demoRouteOrder(code)?.stop;
        const routeOrder: RouteOrder = {
          code,
          stop: matchedDemo ? { ...matchedDemo, address: localOrder.address || matchedDemo.address, status: "Жоспарда" } : { name: localOrder.store || "Клиент тапсырысы", address: localOrder.address || "Мекенжай көрсетілмеген", time: "18:00", distance: "Карта бойынша", status: "Жоспарда", coordinates: [76.8897, 43.2383] },
          total: localOrder.total,
          items: localOrder.items,
        };
        rememberRouteOrder(routeOrder);
        setAcceptedOrders((current) => current.includes(code) ? current : [...current, code]);
        setSelectedStop(routeOrder.stop);
        setSelectedOrderCode(code);
        window.history.replaceState({}, "", "/dispatcher");
        return { ok: true, code, message: `${code} · Экспедитор қабылдады` };
      }
    } catch { /* The Supabase result above remains authoritative when local cache is unavailable. */ }

    return { ok: false, message: "Бұл QR бойынша дайын тапсырыс табылмады." };
  };
  if (!logged) return <DispatcherLoginAlsat onLogin={() => { window.location.href = "/workspace-login"; }} />;
  const go = (next: Screen) => setScreen(next);
  const acceptedRouteOrders = acceptedOrders
    .map((code) => routeOrders.find((order) => order.code === code) ?? demoRouteOrder(code))
    .filter((order): order is RouteOrder => Boolean(order));
  const selectedRouteOrder = routeOrders.find((order) => order.code === selectedOrderCode) ?? demoRouteOrder(selectedOrderCode) ?? { code: selectedOrderCode, stop: selectedStop };
  const selectRouteOrder = (order: RouteOrder) => { setSelectedOrderCode(order.code); setSelectedStop(order.stop); go("detail"); };
  const completeDelivery = async (proof: DeliveryProofPayload) => {
    if (selectedRouteOrder.orderId && selectedRouteOrder.companyId && supabase) {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error("Экспедитор аккаунты анықталмады. Қайта кіріңіз.");
      const folder = `${selectedRouteOrder.companyId}/${selectedRouteOrder.orderId}/${Date.now()}`;
      const signaturePath = `${folder}-signature.png`;
      const photoPath = proof.photo ? `${folder}-photo.${safeFileExtension(proof.photo)}` : null;
      const uploaded: string[] = [];
      const { error: signatureError } = await supabase.storage.from("delivery-proofs").upload(signaturePath, dataUrlToBlob(proof.signatureDataUrl), { contentType: "image/png", upsert: false });
      if (signatureError) throw new Error(`Қолтаңбаны сақтау мүмкін болмады: ${signatureError.message}`);
      uploaded.push(signaturePath);
      if (proof.photo && photoPath) {
        const { error: photoError } = await supabase.storage.from("delivery-proofs").upload(photoPath, proof.photo, { contentType: proof.photo.type || "image/jpeg", upsert: false });
        if (photoError) {
          await supabase.storage.from("delivery-proofs").remove(uploaded);
          throw new Error(`Жеткізу фотосын сақтау мүмкін болмады: ${photoError.message}`);
        }
        uploaded.push(photoPath);
      }
      const { error } = await supabase.from("orders").update({
        status: "delivered",
        delivered_at: new Date().toISOString(),
        delivered_by: authData.user.id,
        delivery_payment_method: proof.paymentMethod,
        delivery_payment_amount: proof.amount,
        delivery_recipient_name: proof.recipientName,
        delivery_signature_path: signaturePath,
        delivery_photo_path: photoPath,
        delivery_note: proof.note || null,
      }).eq("id", selectedRouteOrder.orderId);
      if (error) {
        await supabase.storage.from("delivery-proofs").remove(uploaded);
        throw new Error(`Жеткізуді сақтау мүмкін болмады: ${error.message}`);
      }
    } else {
      localStorage.setItem(`alsat-delivery-proof-${selectedOrderCode}`, JSON.stringify({ ...proof, signatureDataUrl: "saved", photo: proof.photo?.name || null, deliveredAt: new Date().toISOString() }));
    }
    setDeliveredOrders((current) => current.includes(selectedOrderCode) ? current : [...current, selectedOrderCode]);
    go("done");
  };
  return <main className="qmart-role dispatcher-shell">
    <header className="role-header"><button onClick={() => go("more")}><AlsatIcon name="menu"/></button><div className="role-header-brand"><AlsatMark size={27}/><span><b>ALSAT</b><small>ЭКСПЕДИТОР</small></span></div><button onClick={() => go("notifications")}><AlsatIcon name="bell"/></button></header>
    {screen === "dashboard" && <DispatcherDashboard go={go} />}
    {screen === "orders" && <DispatcherOrders go={go} onSelect={(stop) => { setSelectedStop(stop); setSelectedOrderCode(warehouseCode(stops.indexOf(stop))); go("detail"); }} />}
    {screen === "detail" && <DispatcherDetail order={selectedRouteOrder} delivered={deliveredOrders.includes(selectedOrderCode)} backTo={routeStarted ? "route" : "orders"} go={go} onDeliver={() => go("proof")} />}
    {screen === "proof" && <DeliveryProof order={selectedRouteOrder} go={go} onConfirm={completeDelivery} />}
    {screen === "route" && <DispatcherRoute go={go} started={routeStarted} routeOrders={acceptedRouteOrders} deliveredOrders={deliveredOrders} onStart={() => setRouteStarted(true)} onSelect={selectRouteOrder} />}
    {screen === "stops" && <StopList go={go} routeOrders={acceptedRouteOrders} deliveredOrders={deliveredOrders} onSelect={selectRouteOrder} />}
    {screen === "scanner" && <BarcodeScanner go={go} />}
    {screen === "receive" && <DispatcherReceive go={go} acceptedOrders={acceptedOrders} routeOrders={acceptedRouteOrders} initialCode={initialPickupCode} onAccept={acceptWarehouseOrder} onStart={() => { setRouteStarted(true); go("route"); }} />}
    {screen === "done" && <DeliveryDone order={selectedRouteOrder} hasNext={acceptedOrders.some((code) => !deliveredOrders.includes(code))} go={go} />}
    {screen === "reports" && <DispatcherReports go={go} />}
    {screen === "notifications" && <Notifications go={go} />}
    {screen === "vehicle" && <Vehicle go={go} />}
    {screen === "profile" && <DispatcherProfile go={go} />}
    {screen === "fuel" && <Fuel go={go} />}
    {screen === "documents" && <Documents go={go} />}
    {screen === "support" && <Support go={go} />}
    {screen === "more" && <DispatcherMore go={go} />}
    <nav className="role-bottom"><button className={screen === "dashboard" ? "active" : ""} onClick={() => go("dashboard")}><AlsatIcon name="home"/><small>Басты</small></button><button className={screen === "orders" || screen === "detail" || screen === "proof" || screen === "done" || screen === "receive" ? "active" : ""} onClick={() => go("orders")}><AlsatIcon name="orders"/><small>Тапсырыс</small></button><button className={screen === "route" || screen === "stops" ? "active" : ""} onClick={() => go("route")}><AlsatIcon name="route"/><small>Маршрут</small></button><button className={screen === "notifications" ? "active" : ""} onClick={() => go("notifications")}><AlsatIcon name="chat"/><small>Хабарлама</small></button><button className={screen === "profile" || screen === "more" ? "active" : ""} onClick={() => go("profile")}><AlsatIcon name="user"/><small>Профиль</small></button></nav>
  </main>;
}

function DispatcherLoginAlsat({ onLogin }: { onLogin: () => void }) { return <main className="role-login dispatcher-login"><div className="role-login-brand"><span><AlsatMark size={31}/></span><b>ALSAT</b><small>ЭКСПЕДИТОР</small></div><div className="truck-illustration"><AlsatIcon name="truck" size={54}/></div><h1>Жеткізу процесін<br/>басқарыңыз!</h1><p>Тапсырыстарды жеткізіп, маршруттарды бақылаңыз, статусын жаңартыңыз.</p><div className="role-benefits"><span><AlsatIcon name="orders" size={17}/>Жеткізуге арналған барлық құралдар</span><span><AlsatIcon name="route" size={17}/>Маршрут және навигация</span><span><AlsatIcon name="chart" size={17}/>Статистика және есептер</span><span><AlsatIcon name="chat" size={17}/>Онлайн байланыс</span></div><label>Телефон нөмірі<input placeholder="+7 (___) ___-__-__" inputMode="tel"/></label><button className="role-primary" onClick={onLogin}>Кіру</button><button className="role-secondary" onClick={onLogin}><AlsatIcon name="phone" size={17}/> SMS арқылы кіру</button><small className="role-offline">● Offline режимі қолжетімді</small></main> }

function DispatcherLogin({ onLogin }: { onLogin: () => void }) { return <main className="role-login dispatcher-login"><div className="role-login-brand"><span>Q</span><b>QMART</b><small>ЭКСПЕДИТОР</small></div><div className="truck-illustration">🚚</div><h1>Жеткізу процесін<br/>басқарыңыз!</h1><p>Тапсырыстарды жеткізіп, маршруттарды бақылаңыз, статусын жаңартыңыз.</p><div className="role-benefits"><span>▣　Жеткізуге арналған барлық құралдар</span><span>⌖　Маршрут және навигация</span><span>▥　Статистика және есептер</span><span>♧　Онлайн байланыс</span></div><label>Телефон нөмірі<input placeholder="+7 (___) ___-__-__" inputMode="tel"/></label><button className="role-primary" onClick={onLogin}>Кіру</button><button className="role-secondary" onClick={onLogin}>▣　SMS арқылы кіру</button><small className="role-offline">◉　Offline режимі қолжетімді</small></main> }
function DispatcherDashboard({ go }: { go: (screen: Screen) => void }) { return <section className="role-screen"><div className="role-profile"><span className="role-avatar">НӘ</span><div><strong>Сәлеметсіз бе,<br/>Нұрлан!</strong><small>Экспедитор</small></div><button onClick={() => go("notifications")}>♧</button></div><section className="role-metrics"><small>Бүгінгі көрсеткіштер</small><p>12 мамыр, жексенбі</p><div><span>Жеткізуге арналған<strong>12</strong><em>тапсырыс</em></span><span>Жеткізілді<strong>8</strong><em>тапсырыс</em></span><span>Жолда<strong>3</strong><em>тапсырыс</em></span><span>Кешіктіру<strong>1</strong><em>тапсырыс</em></span></div></section><section className="dispatcher-intake-card"><div><small>Қоймаға келдіңіз бе?</small><strong>Тапсырыстарды қабылдап алыңыз</strong><span>Әр қаптамадағы QR кодты сканерлеңіз</span></div><button onClick={() => go("receive")}>QR сканерлеу　›</button></section><div className="role-section-title"><h3>Бүгінгі жоспар</h3><button onClick={() => go("route")}>Толығырақ ›</button></div><div className="plan-card"><div><b>12</b><small>тоқтау нүктесі</small></div><div><b>245 км</b><small>жалпы қашықтық</small></div><div><b>8 сағ 40 мин</b><small>жоспарланған уақыт</small></div><div><b>75%</b><small>орындалды</small></div><i><span style={{ width: "75%" }}/></i></div><div className="role-section-title"><h3>Соңғы тапсырыс</h3><button onClick={() => go("orders")}>Барлығын көру ›</button></div><button className="role-order-mini" onClick={() => go("detail")}><span>▣</span><div><strong>№100045 · Строймаг</strong><small>Алматы қ., Райымбек 348<br/>10:30 дейін жеткізу</small></div><em>Жолда</em></button></section> }
function DispatcherOrders({ go, onSelect }: { go: (screen: Screen) => void; onSelect: (stop: Stop) => void }) { const [filter,setFilter]=useState("all");const visible=filter==="all"?stops:stops.filter((stop)=>filter==="Жолда"?stop.status==="Жолда":filter==="Жоспар"?stop.status==="Жоспарда":stop.status==="Күтуде");return <section className="role-screen"><div className="role-heading"><h1>Тапсырыстар</h1><button onClick={()=>go("receive")} aria-label="Қоймада тапсырыстарды қабылдау">⌁</button></div><button className="receive-hint" onClick={()=>go("receive")}>Қоймадасыз ба? <strong>QR арқылы тапсырысты қабылдау ›</strong></button><div className="role-tabs"><button className={filter==="all"?"active":""} onClick={()=>setFilter("all")}>Барлығы 12</button><button className={filter==="Жолда"?"active":""} onClick={()=>setFilter("Жолда")}>Жолда 3</button><button className={filter==="Күтуде"?"active":""} onClick={()=>setFilter("Күтуде")}>Күтуде 3</button><button className={filter==="Жоспар"?"active":""} onClick={()=>setFilter("Жоспар")}>Жоспарда 8</button></div>{visible.map((stop)=><button className="role-list-row" key={stop.name} onClick={()=>onSelect(stop)}><span className="list-icon">♧</span><div><strong>№{100045+stops.indexOf(stop)} · {stop.name}</strong><small>{stop.address}<br/>{stop.time} дейін</small></div><div className="role-row-right"><em className={`status ${stop.status==="Жолда"?"green":stop.status==="Күтуде"?"yellow":"blue"}`}>{stop.status}</em></div></button>)}</section> }
function DispatcherDetail({ order, delivered, backTo, go, onDeliver }: { order: RouteOrder; delivered: boolean; backTo: Screen; go: (screen: Screen) => void; onDeliver: () => void }) {
  const items = order.items?.length ? order.items : [
    { name: "KRAUSZ Шам A60 12W E27", quantity: 10, price: 650 },
    { name: "KRAUSZ Проектор 100W", quantity: 2, price: 8500 },
    { name: "KRAUSZ Панель LED 36W", quantity: 5, price: 4200 },
  ];
  const total = order.total ?? items.reduce((sum, item) => sum + item.quantity * item.price, 0);
  return <section className="role-screen"><div className="role-heading"><button className="back" onClick={()=>go(backTo)}>‹</button><h1>Тапсырыс №{order.code.replace(/^ST-/, "")}</h1><button onClick={()=>window.print()} aria-label="Тапсырысты басып шығару">⌯</button></div><span className="status green">{delivered?"Жеткізілді":order.stop.status}</span><div className="detail-card"><small>Клиент</small><strong>{order.stop.name}</strong><small>Мекенжайы</small><b>{order.stop.address}</b><small>Байланыс тұлға</small><b>{order.contactName || "Клиент өкілі"}{order.phone ? ` · ${order.phone}` : ""}</b></div><div className="detail-card"><small>Жеткізу уақыты</small><b>Бүгін, {order.stop.time} дейін</b><small>Төлем түрі</small><b>Тапсырыс шарты бойынша</b></div><div className="role-section-title"><h3>Тауарлар ({items.length})</h3><button onClick={()=>window.print()}>Басып шығару</button></div><div className="detail-card product-lines">{items.map((item)=><span key={`${item.name}-${item.price}`}>◌　{item.name} <b>{item.quantity} × {money(item.price)}</b></span>)}<strong>Жалпы сома <b>{money(total)}</b></strong></div>{delivered?<button className="role-primary" onClick={()=>go(backTo)}>Маршрутқа қайту</button>:<button className="role-primary" onClick={onDeliver}>Жеткізілді деп белгілеу</button>}</section>;
}

function DeliveryProof({ order, go, onConfirm }: { order: RouteOrder; go: (screen: Screen) => void; onConfirm: (proof: DeliveryProofPayload) => Promise<void> }) {
  const [paymentMethod, setPaymentMethod] = useState<DeliveryPaymentMethod>("transfer");
  const [amount, setAmount] = useState(String(order.total ?? 0));
  const [recipientName, setRecipientName] = useState(order.contactName || "");
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [note, setNote] = useState("");
  const [goodsConfirmed, setGoodsConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!photo) { setPhotoPreview(""); return; }
    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const validAmount = Number(amount.replace(/\s/g, ""));
  const ready = goodsConfirmed && Boolean(signatureDataUrl) && Boolean(recipientName.trim()) && Number.isFinite(validAmount) && validAmount >= 0;

  const submit = async () => {
    if (!ready || saving) return;
    setSaving(true);
    setError("");
    try {
      await onConfirm({ paymentMethod, amount: validAmount, recipientName: recipientName.trim(), signatureDataUrl, photo, note: note.trim() });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Жеткізуді сақтау мүмкін болмады";
      setError(message.includes("delivery-proofs") || message.includes("column") ? "Жеткізу дәлелін сақтау бөлімі әлі қосылмаған. Delivery proof SQL файлын Supabase-та іске қосыңыз." : message);
      setSaving(false);
    }
  };

  return <section className="role-screen delivery-proof-screen">
    <div className="role-heading"><button className="back" onClick={() => go("detail")}>‹</button><h1>Жеткізуді растау</h1><span>№{order.code.replace(/^ST-/, "")}</span></div>
    <div className="proof-order-card"><span>✓</span><div><strong>{order.stop.name}</strong><small>{order.stop.address}</small></div><b>{money(order.total ?? 0)}</b></div>

    <div className="proof-section"><div className="proof-title"><span>1</span><div><strong>Тауарды тапсыру</strong><small>Клиент тауар санын және қаптамасын тексерді</small></div></div><label className="proof-confirm"><input type="checkbox" checked={goodsConfirmed} onChange={(event) => setGoodsConfirmed(event.target.checked)} /> Тауар толық және зақымсыз тапсырылды</label></div>

    <div className="proof-section"><div className="proof-title"><span>2</span><div><strong>Төлемді белгілеу</strong><small>Клиент қолданған төлем түрін таңдаңыз</small></div></div><div className="payment-methods"><button className={paymentMethod === "cash" ? "active" : ""} onClick={() => setPaymentMethod("cash")}>₸<small>Қолма-қол</small></button><button className={paymentMethod === "transfer" ? "active" : ""} onClick={() => setPaymentMethod("transfer")}>↗<small>Аударым</small></button><button className={paymentMethod === "credit" ? "active" : ""} onClick={() => setPaymentMethod("credit")}>◷<small>Қарызға</small></button></div><label className="proof-field">Расталған сома<div><input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9.]/g, ""))} /><b>₸</b></div></label></div>

    <div className="proof-section"><div className="proof-title"><span>3</span><div><strong>Клиент қолтаңбасы</strong><small>Тауарды алған тұлғаның аты-жөні мен қолы</small></div></div><label className="proof-field">Қабылдаған тұлға<input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} placeholder="Аты-жөні" /></label><SignaturePad value={signatureDataUrl} onChange={setSignatureDataUrl} /></div>

    <div className="proof-section"><div className="proof-title"><span>4</span><div><strong>Жеткізу фотосы</strong><small>Міндетті емес · қораптарды немесе дүкенді түсіріңіз</small></div></div><label className={`delivery-photo-input ${photoPreview ? "has-photo" : ""}`}>{photoPreview ? <img src={photoPreview} alt="Жеткізу фотосының алдын ала көрінісі" /> : <><span>▧</span><strong>Фото түсіру</strong><small>JPG, PNG немесе WEBP · 10 МБ дейін</small></>}<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => { const file = event.target.files?.[0] ?? null; if (file && file.size > 10 * 1024 * 1024) { setError("Фото көлемі 10 МБ-тан аспауы керек."); return; } setPhoto(file); setError(""); }} /></label>{photo && <button className="remove-photo" onClick={() => setPhoto(null)}>Фотосын өшіру</button>}<label className="proof-field">Ескерту<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Қажет болса, түсініктеме жазыңыз" /></label></div>

    {error && <div className="proof-error">!　{error}</div>}
    <button className="role-primary proof-submit" disabled={!ready || saving} onClick={() => { void submit(); }}>{saving ? "Сақталуда…" : "Жеткізуді аяқтау　✓"}</button>
    {!ready && <small className="proof-hint">Тауарды растаңыз, қабылдаушының атын жазып, қолтаңба алыңыз.</small>}
  </section>;
}

function DispatcherRoute({ go, onSelect, started, routeOrders, deliveredOrders, onStart }: { go: (screen: Screen) => void; onSelect: (order: RouteOrder) => void; started: boolean; routeOrders: RouteOrder[]; deliveredOrders: string[]; onStart: () => void }) {
  const remainingOrders = routeOrders.filter((order) => !deliveredOrders.includes(order.code));
  const completedCount = routeOrders.length - remainingOrders.length;
  const openStop = (stopId: string) => {
    const order = routeOrders.find((item) => item.code === stopId);
    if (order) onSelect(order);
  };
  const canStart = routeOrders.length > 0;
  return <section className="role-screen route-navigation-screen"><div className="role-heading"><h1>Бүгінгі маршрут</h1><button onClick={() => go("stops")}>☷</button></div><p className="role-muted">{canStart ? `${routeOrders.length} қабылданған тапсырыс · ${completedCount} жеткізілді` : "Алдымен қоймадағы тапсырыстарды қабылдаңыз"}</p>{!started ? <section className="delivery-start-card"><span className="delivery-start-icon">⌖</span><div><strong>Жеткізу бастауға дайынсыз ба?</strong><small>QR арқылы қабылданған дүкендер маршрутқа автоматты қосылды.</small></div><button disabled={!canStart} onClick={onStart}>Жеткізуді бастау　›</button></section> : <><div className="route-live-badge">●　GPS навигация белсенді <span>· {remainingOrders.length} нүкте қалды</span></div><MapErrorBoundary resetKey={remainingOrders.map((order) => `${order.code}:${order.stop.coordinates.join(",")}`).join("|")}><DriverNavigation stops={remainingOrders.map((order) => ({ id: order.code, name: order.stop.name, address: order.stop.address, time: order.stop.time, coordinates: order.stop.coordinates }))} onOpenStop={openStop}/></MapErrorBoundary><div className="role-section-title"><h3>Маршрут нүктелері</h3><span>{completedCount}/{routeOrders.length}</span></div><div className="route-stop-list">{routeOrders.map((order, index) => { const complete = deliveredOrders.includes(order.code); return <button className="role-list-row" key={order.code} onClick={() => onSelect(order)}><span className={`stop-number ${complete ? "complete" : ""}`}>{complete ? "✓" : index + 1}</span><div><strong>{order.stop.name}</strong><small>{order.stop.time} дейін · {order.stop.distance}</small></div><em className={`status ${complete ? "green" : order.stop.status === "Күтуде" ? "yellow" : "blue"}`}>{complete ? "Жеткізілді" : index === completedCount ? "Келесі" : "Жоспарда"}</em></button>; })}</div></>}</section>;
}

function DispatcherReceive({ go, acceptedOrders, routeOrders, initialCode, onAccept, onStart }: { go: (screen: Screen) => void; acceptedOrders: string[]; routeOrders: RouteOrder[]; initialCode: string; onAccept: (code: string) => Promise<PickupResult>; onStart: () => void }) {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [successful, setSuccessful] = useState(false);
  const [checking, setChecking] = useState(false);
  const autoHandled = useRef("");

  async function handleAccept(value = code) {
    if (checking || !value.trim()) return;
    setChecking(true);
    const result = await onAccept(value);
    setSuccessful(result.ok);
    setMessage(result.message);
    if (result.ok) setCode("");
    setChecking(false);
  }

  useEffect(() => {
    if (initialCode && autoHandled.current !== initialCode) {
      autoHandled.current = initialCode;
      void handleAccept(initialCode);
    }
  }, [initialCode]);

  return <section className="role-screen receive-screen">
    <div className="role-heading"><button className="back" onClick={() => go("dashboard")}>‹</button><h1>Қоймада қабылдау</h1><span>{acceptedOrders.length} дана</span></div>
    <div className="receive-steps"><span className="active">1　QR сканерлеу</span><span>2　Қабылдауды растау</span><span>3　Жеткізу</span></div>
    <div className="receive-intro"><strong>Қораптағы Alsat QR стикерін сканерлеңіз</strong><small>Тек қоймашы жинап, стикерін бекіткен тапсырыс қабылданады.</small></div>
    <QrCameraScanner busy={checking} onScan={(value) => { setCode(value); void handleAccept(value); }}/>
    <div className="manual-pickup-code"><span>немесе стикер кодын қолмен енгізіңіз</span><input className="role-input" value={code} onChange={(event) => setCode(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void handleAccept(); }} placeholder="ST-100045"/><button className="role-primary" disabled={checking || !code.trim()} onClick={() => { void handleAccept(); }}>{checking ? "Тексерілуде…" : "Тапсырысты қабылдау"}</button></div>
    {message && <small className={`receive-message ${successful ? "success" : "error"}`}>{successful ? "✓ " : "! "}{message}</small>}
    <div className="role-section-title"><h3>Қабылданған тапсырыстар</h3><span>{acceptedOrders.length} дана</span></div>
    {acceptedOrders.length === 0 ? <div className="receive-empty">Сканерленген тапсырыстар осы жерде көрінеді.</div> : <div className="accepted-orders">{acceptedOrders.map((acceptedCode) => { const routeOrder = routeOrders.find((order) => order.code === acceptedCode) ?? demoRouteOrder(acceptedCode); return <div className="accepted-order" key={acceptedCode}><span className="list-icon">✓</span><div><strong>№{acceptedCode.replace(/^(ALSAT-|ST-)/, "")} · {routeOrder?.stop.name ?? "Тапсырыс"}</strong><small>{routeOrder?.stop.address || "QR тексерілді"} · Экспедитор қабылдады</small></div><em>Маршрутта</em></div>; })}</div>}
    {acceptedOrders.length > 0 && <button className="role-primary start-delivery-button" onClick={onStart}>Жеткізуді бастау　→</button>}
  </section>;
}

function QrCameraScanner({ busy, onScan }: { busy: boolean; onScan: (value: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");

  const stop = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setActive(false);
  };

  useEffect(() => () => controlsRef.current?.stop(), []);

  async function start() {
    if (busy) return;
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Бұл құрылғыда камера қолжетімсіз. Кодты қолмен енгізіңіз.");
      return;
    }
    try {
      const reader = new BrowserQRCodeReader();
      const controls = await reader.decodeFromConstraints({ video: { facingMode: { ideal: "environment" } }, audio: false }, videoRef.current!, (result: { getText(): string } | undefined) => {
        if (!result) return;
        const value = result.getText();
        controlsRef.current?.stop();
        controlsRef.current = null;
        setActive(false);
        onScan(value);
      });
      controlsRef.current = controls;
      setActive(true);
    } catch (cameraError) {
      setActive(false);
      setError(cameraError instanceof Error && cameraError.name === "NotAllowedError" ? "Камераға рұқсат берілмеді. Браузерден камера рұқсатын қосыңыз." : "Камераны қосу мүмкін болмады. Кодты қолмен енгізуге болады.");
    }
  }

  return <div className={`scanner-box receive-scanner live-qr-scanner ${active ? "camera-active" : ""}`}>
    <video ref={videoRef} muted playsInline />
    {!active && <div className="scan-corners">⌁</div>}
    <p>{active ? "QR кодты жасыл рамкаға орналастырыңыз" : "Камерамен QR сканерлеу"}</p>
    <button type="button" className="camera-toggle" onClick={active ? stop : () => { void start(); }}>{active ? "Камераны тоқтату" : "Камераны қосу"}</button>
    {error && <small className="camera-error">{error}</small>}
  </div>;
}
function StopList({ go, routeOrders, deliveredOrders, onSelect }: { go: (screen: Screen) => void; routeOrders: RouteOrder[]; deliveredOrders: string[]; onSelect: (order: RouteOrder) => void }) { const [filter,setFilter]=useState("all");const visible=routeOrders.filter((order)=>filter==="all"||(filter==="plan"?!deliveredOrders.includes(order.code):deliveredOrders.includes(order.code)));return <section className="role-screen"><div className="role-heading"><button className="back" onClick={()=>go("route")}>‹</button><h1>Тоқтау нүктелері</h1><button onClick={()=>go("route")}>⌖</button></div><div className="role-tabs"><button className={filter==="all"?"active":""} onClick={()=>setFilter("all")}>Барлығы {routeOrders.length}</button><button className={filter==="plan"?"active":""} onClick={()=>setFilter("plan")}>Жоспар</button><button className={filter==="done"?"active":""} onClick={()=>setFilter("done")}>Аяқталды</button></div>{visible.length?visible.map((order,index)=>{const delivered=deliveredOrders.includes(order.code);return <button className="role-list-row" key={order.code} onClick={()=>onSelect(order)}><span className={`stop-number ${delivered?"complete":""}`}>{delivered?"✓":index+1}</span><div><strong>№{order.code.replace(/^ST-/, "")}　{order.stop.name}</strong><small>{order.stop.time} дейін · {order.stop.distance}</small></div><em className={`status ${delivered?"green":"blue"}`}>{delivered?"Жеткізілді":"Жоспарда"}</em></button>}):<div className="receive-empty">Бұл сүзгіде нүкте жоқ</div>}</section> }
function BarcodeScanner({ go }: { go: (screen: Screen) => void }) { const [code,setCode]=useState("");const [torch,setTorch]=useState(false);const [gallery,setGallery]=useState(false);return <section className="role-screen scanner-screen"><div className="role-heading"><button className="back" onClick={()=>go("orders")}>‹</button><h1>Штрихкодты сканерлеу</h1><button onClick={()=>go("orders")}>×</button></div><div className={`scanner-box ${torch?"torch-on":""}`}><div className="scan-corners">▣</div><p>{torch?"Фонарик қосылды":"Штрихкодты рамкаға орналастырыңыз"}</p></div><small className="role-muted center">немесе кодты қолмен енгізу</small><input className="role-input" value={code} onChange={(event)=>setCode(event.target.value)} placeholder="Штрихкод енгізу　⌕"/><div className="scanner-actions"><button className={torch?"active":""} onClick={()=>setTorch((value)=>!value)}>♨<small>Фонарик</small></button><button className={gallery?"active":""} onClick={()=>setGallery((value)=>!value)}>▧<small>Галерея</small></button></div>{gallery&&<div className="action-panel">Галереядан QR/штрихкод суретін таңдау режимі қосылды.</div>}<button className="role-primary" disabled={!code.trim()} onClick={()=>go("detail")}>Тексеру</button></section> }
function DeliveryDone({ order, hasNext, go }: { order: RouteOrder; hasNext: boolean; go: (screen: Screen) => void }) { return <section className="role-screen done-screen"><span className="big-check">✓</span><h1>Тапсырыс сәтті жеткізілді!</h1><p>№{order.code.replace(/^ST-/, "")} · {order.stop.name}<br/>{order.stop.address}</p><div className="signature-box">Клиент қолтаңбасы<div>✍</div></div><button className="role-primary" onClick={() => go("route")}>{hasNext ? "Растау және келесі нүктеге өту" : "Маршрутты аяқтау"}</button><button className="text-button" onClick={() => go("orders")}>Тапсырыстар тізіміне қайту</button></section> }
function DispatcherReports({ go }: { go: (screen: Screen) => void }) { const periods=["Бүгін","Бұл апта","Бұл ай"];const [period,setPeriod]=useState(0);return <section className="role-screen"><div className="role-heading"><h1>Есеп</h1><button onClick={()=>setPeriod((value)=>(value+1)%periods.length)}>{periods[period]}⌄</button></div><section className="report-hero role-report"><small>Көрсеткіштер · {periods[period]}</small><div><span>Жеткізілді<strong>{period===0?8:period===1?42:164}</strong></span><span>Кешіктіру<strong>{period===0?1:3}</strong></span><span>Қашықтық<strong>{period===0?"245 км":"1 240 км"}</strong></span><span>Уақыт<strong>{period===0?"8 сағ 40 мин":"42 сағ"}</strong></span></div></section><div className="role-section-title"><h3>Есептер</h3></div>{["Күнделікті есеп","Апталық есеп","Айлық есеп","Тапсырыстар бойынша есеп"].map((name)=><button className="setting-row role-setting" key={name} onClick={()=>go("documents")}>▣　{name}<b>›</b></button>)}</section> }
function Notifications({ go }: { go: (screen: Screen) => void }) { const [unreadOnly,setUnreadOnly]=useState(false);const [read,setRead]=useState<number[]>([]);const items=["Жаңа тапсырыс қосылды","Диспетчер","Клиент: ЭлектроДом","Жүйе хабарламасы"];return <section className="role-screen"><div className="role-heading"><h1>Хабарламалар</h1><button onClick={()=>go("more")}>•••</button></div><div className="role-tabs"><button className={!unreadOnly?"active":""} onClick={()=>setUnreadOnly(false)}>Барлығы</button><button className={unreadOnly?"active":""} onClick={()=>setUnreadOnly(true)}>Оқылмаған <i>{items.length-read.length}</i></button></div>{items.map((name,index)=>(!unreadOnly||!read.includes(index))&&<button className="notification-row" onClick={()=>setRead((current)=>[...current,index])} key={name}><span className={`notification-icon n${index}`}>♧</span><div><strong>{name}</strong><small>{index===0?"№100045 тапсырысы қосылды":index===1?"Ертеңгі маршрут дайын":"Клиент сізге хабарлама жіберді"}</small><em>12.05.2024 · 10:{30-index*4}</em></div>{!read.includes(index)&&<b>•</b>}</button>)}</section> }
function Vehicle({ go }: { go: (screen: Screen) => void }) { const [panel,setPanel]=useState("");const [plate,setPlate]=useState("777AAA02");return <section className="role-screen"><div className="role-heading"><button className="back" onClick={()=>go("more")}>‹</button><h1>Көлік туралы ақпарат</h1><button onClick={()=>setPanel("edit")}>✎</button></div><div className="vehicle-card"><small>Көлік</small><h2>GAZель Next</h2><p>{plate}</p><div className="van">🚚</div><Info label="Жүк көтергіштік" value="1.5 т"/><Info label="Көлемі" value="12 м³"/><Info label="Жанармай түрі" value="Дизель"/><Info label="Келесі ТО" value="15.06.2024"/></div>{panel==="edit"&&<div className="action-panel"><strong>Көлік деректерін өңдеу</strong><input className="role-input" value={plate} onChange={(event)=>setPlate(event.target.value)}/><button onClick={()=>setPanel("")}>Сақтау</button></div>}{panel&&panel!=="edit"&&<div className="action-panel"><strong>{panel}</strong><p>Полис және қызмет көрсету тарихы қолжетімді.</p><button onClick={()=>setPanel("")}>Жабу</button></div>}<button className="setting-row" onClick={()=>go("documents")}>▣　Құжаттар <b>›</b></button><button className="setting-row" onClick={()=>setPanel("Сақтандыру")}>◉　Сақтандыру <b>›</b></button><button className="setting-row" onClick={()=>setPanel("Жөндеу тарихы")}>⌖　Жөндеу тарихы <b>›</b></button></section> }
function Info({ label, value }: { label: string; value: string }) { return <div className="info-line"><span>{label}</span><b>{value}</b></div> }
function DispatcherProfile({ go }: { go: (screen: Screen) => void }) { const [setting,setSetting]=useState("");return <section className="role-screen"><div className="role-heading"><button onClick={()=>go("more")}>‹</button><h1>Профиль</h1><span/></div><div className="profile-card role-profile-card"><span className="role-avatar large">НӘ</span><h1>Нұрлан Әбілрахманов</h1><p>Экспедитор</p><strong>+7 777 123 45 67</strong><small>n.abdirakhmanov@alsat.kz</small></div>{["Жеке ақпарат","Көлік туралы","Параметрлер","Тіл · Қазақша","Қолдау қызметі","Қосымша туралы"].map((item,index)=><button className="setting-row role-setting" key={item} onClick={()=>index===1?go("vehicle"):index===4?go("support"):setSetting(item)}>{item}<b>›</b></button>)}{setting&&<div className="action-panel"><strong>{setting}</strong><p>Бөлім ашылды. Өзгерістер осы құрылғыда сақталады.</p><button onClick={()=>setSetting("")}>Дайын</button></div>}<button className="logout" onClick={()=>go("dashboard")}>⇥　Шығу</button></section> }
function Fuel({ go }: { go: (screen: Screen) => void }) { const [tab,setTab]=useState("fuel");const [records,setRecords]=useState(["12.05.2024, 08:20","11.05.2024, 08:15","10.05.2024, 10:00"]);return <section className="role-screen"><div className="role-heading"><button className="back" onClick={()=>go("more")}>‹</button><h1>Жанармай және шығындар</h1><span/></div><div className="role-tabs"><button className={tab==="fuel"?"active":""} onClick={()=>setTab("fuel")}>Жанармай</button><button className={tab==="expense"?"active":""} onClick={()=>setTab("expense")}>Шығындар</button></div><div className="fuel-summary"><Info label="Бүгін" value={tab==="fuel"?"20 л　120 км　50 400 ₸":"Жол ақысы　4 500 ₸"}/><Info label="Апта бойынша" value={tab==="fuel"?"480 л　201 600 ₸":"28 400 ₸"}/></div><button className="role-primary" onClick={()=>setRecords([new Date().toLocaleString("kk-KZ"),...records])}>＋ {tab==="fuel"?"Жанармай":"Шығын"} қосу</button><div className="role-section-title"><h3>Соңғы жазбалар</h3></div>{records.map((date,index)=><div className="fuel-row" key={`${date}-${index}`}><div><b>{date}</b><small>{tab==="fuel"?"20 л · KZ 777AAA02":"Жол шығыны"}</small></div><strong>{tab==="fuel"?(index===1?"12 600 ₸":"8 400 ₸"):"4 500 ₸"}</strong></div>)}</section> }
function Documents({ go }: { go: (screen: Screen) => void }) { const [selected,setSelected]=useState("");const [added,setAdded]=useState(false);const items=["Жолсапарлар · 12 құжат","Транспорт актілері · 8 құжат","Қолма-қолсыз түсім · PDF · 2.4 MB","Көлік куәлігі · PDF · 1.1 MB","Техникалық байқау · PDF · 1.6 MB"];return <section className="role-screen"><div className="role-heading"><button className="back" onClick={()=>go("more")}>‹</button><h1>Құжаттар</h1><span/></div>{added&&<div className="action-panel success">✓ Жаңа құжат тіркелді</div>}{items.map((item,index)=><button className="setting-row role-setting" onClick={()=>setSelected(item)} key={item}><span className={index>1?"doc-icon red":"doc-icon"}>▣</span>{item}<b>›</b></button>)}{selected&&<div className="action-panel"><strong>{selected}</strong><p>Құжатты көру немесе басып шығару.</p><button onClick={()=>window.print()}>Басып шығару</button></div>}<button className="role-primary" onClick={()=>setAdded(true)}>Құжат қосу</button></section> }
function Support({ go }: { go: (screen: Screen) => void }) { const [draft,setDraft]=useState("");const [messages,setMessages]=useState(["№100045 тапсырысы бойынша сұрақ бар"]);const send=()=>{if(!draft.trim())return;setMessages([...messages,draft.trim()]);setDraft("")};return <section className="role-screen support-screen"><div className="role-heading"><button className="back" onClick={()=>go("more")}>‹</button><h1>Қолдау қызметі</h1><button onClick={()=>go("documents")}>•••</button></div><div className="support-status">●　Онлайн</div><div className="chat-bubble incoming">Сәлеметсіз бе! Қалай көмектесе аламыз?</div>{messages.map((message,index)=><div className="chat-bubble outgoing" key={`${message}-${index}`}>{message}</div>)}<div className="chat-bubble incoming">Сұрағыңызды қабылдадық, жақында жауап береміз.</div><div className="support-input"><input value={draft} onChange={(event)=>setDraft(event.target.value)} onKeyDown={(event)=>event.key==="Enter"&&send()} placeholder="Хабарлама енгізіңіз..."/><button onClick={send}>➤</button></div></section> }
function DispatcherMore({ go }: { go: (screen: Screen) => void }) { return <section className="role-screen"><h1>Көлік және баптаулар</h1><button className="setting-row role-setting" onClick={() => go("vehicle")}>▣　Көлік туралы ақпарат <b>›</b></button><button className="setting-row role-setting" onClick={() => go("fuel")}>♨　Жанармай және шығындар <b>›</b></button><button className="setting-row role-setting" onClick={() => go("documents")}>▤　Құжаттар <b>›</b></button><button className="setting-row role-setting" onClick={() => go("reports")}>▥　Есептер <b>›</b></button><button className="setting-row role-setting" onClick={() => go("support")}>♧　Қолдау қызметі <b>›</b></button></section> }

