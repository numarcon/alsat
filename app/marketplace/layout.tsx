import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Alsat Marketplace — бизнеске арналған көтерме сауда",
  description: "Бизнес иелері мен дүкендерге арналған көтерме B2B marketplace.",
};

export default function MarketplaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
