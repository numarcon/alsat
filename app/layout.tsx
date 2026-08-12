import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import "./roles.css";

export const metadata: Metadata = { title: "Alsat Workspace — сатуды бір жүйеде басқарыңыз", description: "Компания, сауда өкілі, қойма және жеткізуді біріктіретін Қазақстан бизнесіне арналған B2B workspace.", applicationName: "Alsat Workspace", manifest: "/manifest.webmanifest" };
export const viewport: Viewport = { themeColor: "#0878f9", width: "device-width", initialScale: 1 };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="kk"><body>{children}<Script id="pwa-runtime" strategy="afterInteractive">{"if (location.hostname === 'localhost') { navigator.serviceWorker?.getRegistrations().then(rs => rs.forEach(r => r.unregister())); caches?.keys().then(ks => ks.forEach(k => caches.delete(k))); } else if ('serviceWorker' in navigator) { navigator.serviceWorker.register('/sw.js'); }"}</Script></body></html>; }
