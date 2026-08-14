import type { SVGProps } from "react";

export type AlsatIconName =
  | "home" | "catalog" | "search" | "heart" | "cart" | "user" | "menu"
  | "arrow" | "chevron" | "check" | "shield" | "truck" | "lock" | "building"
  | "package" | "tools" | "laptop" | "office" | "cleaning" | "box" | "vest"
  | "food" | "wallet" | "users" | "route" | "warehouse" | "scan" | "bell"
  | "plus" | "logout" | "settings" | "chart" | "orders" | "store" | "agent"
  | "marketplace" | "commission" | "close" | "filter" | "minus" | "refresh"
  | "clock" | "location" | "phone" | "mail" | "star" | "document" | "fuel"
  | "chat" | "eye" | "edit" | "trash" | "image" | "credit-card" | "receipt";

type IconProps = Omit<SVGProps<SVGSVGElement>, "name"> & { name: AlsatIconName; size?: number };

const paths: Record<AlsatIconName, React.ReactNode> = {
  home: <><path d="M3.5 10.8 12 3.7l8.5 7.1"/><path d="M5.5 9.8v10.5h13V9.8M9.2 20.3v-6.1h5.6v6.1"/></>,
  catalog: <><rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/></>,
  search: <><circle cx="10.7" cy="10.7" r="6.7"/><path d="m16 16 4.5 4.5"/></>,
  heart: <path d="M20.6 5.8c-2.2-2.3-5.8-1.7-7.4.8L12 8.4l-1.2-1.8C9.2 4.1 5.6 3.5 3.4 5.8c-2.3 2.4-1.7 6.1.6 8.3L12 21l8-6.9c2.3-2.2 2.9-5.9.6-8.3Z"/>,
  cart: <><path d="M3 4h2l2.1 10.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20.5 8H6"/><circle cx="9.5" cy="20" r="1.3"/><circle cx="17.5" cy="20" r="1.3"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4.2 21c.7-5 3.6-7.5 7.8-7.5s7.1 2.5 7.8 7.5"/></>,
  menu: <path d="M4 6.5h16M4 12h16M4 17.5h11"/>,
  arrow: <><path d="M5 12h14"/><path d="m14 7 5 5-5 5"/></>,
  chevron: <path d="m9 6 6 6-6 6"/>,
  check: <path d="m5 12.5 4.2 4.2L19.5 6.5"/>,
  shield: <><path d="M12 3 4.5 6v5.3c0 4.8 3.1 8.1 7.5 9.7 4.4-1.6 7.5-4.9 7.5-9.7V6L12 3Z"/><path d="m8.7 12 2.1 2.1 4.7-5"/></>,
  truck: <><path d="M3 6h11v10H3zM14 9h4l3 3.5V16h-7z"/><circle cx="7" cy="18.5" r="2"/><circle cx="18" cy="18.5" r="2"/></>,
  lock: <><rect x="4.5" y="10" width="15" height="11" rx="2.5"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10M12 14v3"/></>,
  building: <><path d="M4 21V6l8-3v18M12 8h8v13M7.5 8h1M7.5 12h1M7.5 16h1M15.5 12h1M15.5 16h1M3 21h18"/></>,
  package: <><path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="M4 7v10l8 4 8-4V7M12 11v10M8 5l8 4"/></>,
  tools: <><path d="M14.5 6.3a4.5 4.5 0 0 0-5.7 5.6L3.5 17.2a2.3 2.3 0 0 0 3.3 3.3l5.3-5.3a4.5 4.5 0 0 0 5.6-5.7l-2.9 2.9-3.2-.8-.8-3.2 3.7-2.1Z"/></>,
  laptop: <><rect x="4" y="4" width="16" height="12" rx="2"/><path d="M2.5 19h19M8 19l.7-3h6.6l.7 3"/></>,
  office: <><path d="M5 21V5h10v16M15 10h4v11M8 9h4M8 13h4M8 17h4M3 21h18"/></>,
  cleaning: <><path d="M7 8h9l1.7 12H5.3L7 8Z"/><path d="M9 8V5.8A2.8 2.8 0 0 1 11.8 3H16M16 3v4M14 14h5M16.5 11.5v5"/></>,
  box: <><path d="M4 8h16v12H4zM3 4h18v4H3z"/><path d="M9 12h6"/></>,
  vest: <><path d="m8 4 4 3 4-3 3 5-2 12H7L5 9l3-5Z"/><path d="M9.5 5.2 8.5 21M14.5 5.2l1 15.8M6.5 15h11"/></>,
  food: <><path d="M4 3v7a3 3 0 0 0 6 0V3M7 3v18M15 3v8c0 2 1 3 3 3V3v18"/></>,
  wallet: <><path d="M3.5 6h15v14h-15zM3.5 8.5h15M15 12h6v5h-6a2.5 2.5 0 0 1 0-5Z"/></>,
  users: <><circle cx="9" cy="8" r="3.5"/><path d="M2.8 20c.4-4.5 2.6-7 6.2-7s5.8 2.5 6.2 7M15.5 5.2a3.5 3.5 0 0 1 0 5.6M17 13.4c2.5.6 3.8 2.8 4.2 6.6"/></>,
  route: <><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18h2a3 3 0 0 0 3-3v-6a3 3 0 0 1 3-3"/></>,
  warehouse: <><path d="M3 21V8l9-5 9 5v13M7 21v-9h10v9M7 16h10"/></>,
  scan: <><path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M7 12h10"/><path d="M8 9v6M11 9v6M14 9v6M17 9v6"/></>,
  bell: <><path d="M18 9a6 6 0 0 0-12 0c0 6-2.5 6.5-3 8h18c-.5-1.5-3-2-3-8ZM10 21h4"/></>,
  plus: <path d="M12 4.5v15M4.5 12h15"/>,
  logout: <><path d="M10 5H4v14h6M14 8l4 4-4 4M18 12H8"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
  orders: <><rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M9 3v4h6V3M8.5 12h7M8.5 16h5"/></>,
  store: <><path d="M4 9h16l-2-5H6L4 9Z"/><path d="M5 9v11h14V9M9 20v-6h6v6"/></>,
  agent: <><circle cx="10" cy="8" r="4"/><path d="M3 21c.5-5 3-8 7-8 2.4 0 4.3 1 5.5 2.8M18.5 14v7M15 17.5h7"/></>,
  marketplace: <><path d="M3 9h18M5 9v11h14V9M7 4h10l2 5H5l2-5Z"/><path d="M9 20v-6h6v6"/></>,
  commission: <><circle cx="8" cy="8" r="4"/><circle cx="16" cy="16" r="4"/><path d="m6 18 12-12"/></>,
  close: <path d="m5 5 14 14M19 5 5 19"/>,
  filter: <path d="M4 6h16M7 12h10M10 18h4"/>,
  minus: <path d="M5 12h14"/>,
  refresh: <><path d="M20 6v5h-5"/><path d="M18.2 8.2A7.5 7.5 0 1 0 19 16"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></>,
  location: <><path d="M20 10c0 5.5-8 11-8 11S4 15.5 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
  phone: <path d="M8.5 3.8 10 7.5 7.8 9a15 15 0 0 0 7.2 7.2l1.5-2.2 3.7 1.5v3a2 2 0 0 1-2.2 2C10.3 19.5 4.5 13.7 3.5 6A2 2 0 0 1 5.5 3.8h3Z"/>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></>,
  star: <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>,
  document: <><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></>,
  fuel: <><path d="M5 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M3 21h15M8 7h5v5H8z"/><path d="m16 8 3 3v6a1.5 1.5 0 0 0 3 0V9l-2-2"/></>,
  chat: <path d="M4 4h16v12H9l-5 4V4Z"/>,
  eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></>,
  edit: <><path d="M4 20h4l11-11-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></>,
  trash: <><path d="M4 7h16M9 3h6l1 4M6 7l1 14h10l1-14M10 11v6M14 11v6"/></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m4 17 5-4 3 2 3-3 5 5"/></>,
  "credit-card": <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h3"/></>,
  receipt: <><path d="M6 3v18l3-2 3 2 3-2 3 2V3l-3 2-3-2-3 2-3-2Z"/><path d="M9 9h6M9 13h6"/></>,
};

export function AlsatIcon({ name, size = 24, className, ...props }: IconProps) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" aria-hidden="true" {...props}>{paths[name]}</svg>;
}

export function AlsatMark({ size = 40, className, ...props }: Omit<SVGProps<SVGSVGElement>, "width" | "height"> & { size?: number }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true" {...props}>
    <path d="M23.8 4 5.2 38.5h9.6l9-16.8 5 9.2h-7.6l-4.1 7.6h25.7L23.8 4Z" fill="currentColor"/>
    <path d="m29.2 7.5 8.1 14.9-5.2 4.6-8.3-15.3 5.4-4.2Z" fill="currentColor" opacity=".48"/>
    <path d="m7.6 36.5 8.7-16 5.2 4.5-7.2 13.5H6.5l1.1-2Z" fill="currentColor" opacity=".7"/>
  </svg>;
}

export function AlsatBrand({ label = "MARKETPLACE", compact = false, inverse = false, className = "" }: { label?: string; compact?: boolean; inverse?: boolean; className?: string }) {
  return <span className={`alsat-brand-lockup${compact ? " is-compact" : ""}${inverse ? " is-inverse" : ""} ${className}`.trim()}><span className="alsat-brand-mark"><AlsatMark size={compact ? 30 : 38}/></span>{!compact && <span className="alsat-brand-type"><strong>ALSAT</strong><small>{label}</small></span>}</span>;
}
