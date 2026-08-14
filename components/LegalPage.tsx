import Link from "next/link";
import type { ReactNode } from "react";

export const owner = {
  name: "«Krausz & Deisler» ЖШС",
  bin: "090740009232",
  address: "Қазақстан Республикасы, Алматы қаласы, Айналмалы көшесі, 69А",
  phone: "+7 (700) 300-30-09",
  email: "info@alsat.kz",
  support: "support@alsat.kz",
};

export default function LegalPage({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  return <main className="legal-shell"><header className="legal-header"><Link href="/"><span>▲</span><div><strong>ALSAT</strong><small>MARKETPLACE</small></div></Link><Link href="/">← Marketplace-ке оралу</Link></header><div className="legal-layout"><article className="legal-document"><p className="legal-overline">ALSAT MARKETPLACE · ҚҰҚЫҚТЫҚ АҚПАРАТ</p><h1>{title}</h1><p className="legal-lead">{lead}</p><div className="legal-updated">Қолданысқа енгізілген күні: 14 тамыз 2026 жыл · Нұсқа 1.0</div>{children}</article><aside className="legal-owner"><span>ЖҮЙЕ ИЕСІ</span><h2>{owner.name}</h2><dl><div><dt>БСН</dt><dd>{owner.bin}</dd></div><div><dt>Мекенжай</dt><dd>{owner.address}</dd></div><div><dt>Телефон</dt><dd><a href="tel:+77003003009">{owner.phone}</a></dd></div><div><dt>Email</dt><dd><a href={`mailto:${owner.email}`}>{owner.email}</a></dd></div><div><dt>Қолдау</dt><dd><a href={`mailto:${owner.support}`}>{owner.support}</a></dd></div></dl><nav><Link href="/legal/offer">Жария оферта</Link><Link href="/legal/payment">Төлем</Link><Link href="/legal/delivery">Жеткізу</Link><Link href="/legal/refund">Қайтару</Link><Link href="/legal/privacy">Құпиялық</Link></nav></aside></div></main>;
}
