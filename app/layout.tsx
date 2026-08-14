import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import "./roles.css";
import "./alsat-design.css";

export const metadata: Metadata = { title: { default: "Alsat — B2B сауда экожүйесі", template: "%s · Alsat" }, description: "Marketplace, Workspace, қойма және жеткізу — бизнеске арналған біртұтас Alsat экожүйесі.", applicationName: "Alsat", manifest: "/manifest.webmanifest" };
export const viewport: Viewport = { themeColor: "#083528", width: "device-width", initialScale: 1 };
const pwaRuntime = `(() => {
  const recoveryKey = "alsat-runtime-recovery-v5";
  const messageOf = value => String(value?.message || value?.reason?.message || value?.reason || value || "");
  const isStaleRuntime = value => /ChunkLoadError|Loading chunk|module factory is not available|Failed to fetch dynamically imported module/i.test(messageOf(value));
  const clearRuntime = async () => {
    await Promise.all([
      navigator.serviceWorker?.getRegistrations().then(items => Promise.all(items.map(item => item.unregister()))),
      globalThis.caches?.keys().then(keys => Promise.all(keys.map(key => caches.delete(key)))),
    ]);
  };
  const recover = value => {
    if (!isStaleRuntime(value) || sessionStorage.getItem(recoveryKey)) return;
    sessionStorage.setItem(recoveryKey, "1");
    clearRuntime().finally(() => location.reload());
  };
  addEventListener("error", event => recover(event.error || event.message), true);
  addEventListener("unhandledrejection", event => recover(event), true);
  if (location.hostname === "localhost") {
    clearRuntime();
    return;
  }
  if (!("serviceWorker" in navigator)) return;
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    location.reload();
  });
  navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then(registration => registration.update());
})();`;
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="kk"><body>{children}<Script id="pwa-runtime" strategy="beforeInteractive">{pwaRuntime}</Script></body></html>; }
