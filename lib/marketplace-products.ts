export type CatalogProduct = {
  id: string;
  companyId?: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  category: string;
  subcategory: string;
  brand: string;
  description: string;
  imageUrl: string;
  imageUrls: string[];
  minOrder: number;
  unit: string;
  bulletPoints: string[];
};

export const demoProducts: CatalogProduct[] = [
  { id: "demo-drill", name: "Bosch Professional GBH 2-26 DRE", sku: "BOS-GBH-226", price: 102500, stock: 24, category: "Құрылыс және жөндеу", subcategory: "Электр құралдары", brand: "Bosch", description: "Кәсіби құрылыс жұмыстарына арналған қуатты перфоратор. Құрылыс алаңында бетонды бұрғылау, қашау және монтаж жұмыстарына ыңғайлы.", imageUrl: "", imageUrls: [], minOrder: 1, unit: "дана", bulletPoints: ["Қуаты 800 W", "SDS-plus патроны", "Үш жұмыс режимі", "Кәсіби серия"] },
  { id: "demo-tape", name: "Қаптама таспасы 48 мм × 50 м", sku: "PACK-TAPE-4850", price: 1250, stock: 460, category: "Өнеркәсіп және бизнес", subcategory: "Қаптама және ыдыстар", brand: "Alsat Pack", description: "Қойма, дүкен және тасымалдауға арналған берік қаптама таспасы. Картон қораптарды сенімді жабуға арналған.", imageUrl: "", imageUrls: [], minOrder: 6, unit: "дана", bulletPoints: ["Ені 48 мм", "Ұзындығы 50 м", "Мөлдір", "Жоғары жабысқақтық"] },
  { id: "demo-paper", name: "A4 қағазы, 80 г/м², 500 парақ", sku: "OFF-A4-80500", price: 2300, stock: 780, category: "Үй, жиһаз және бақша", subcategory: "Кеңсе және қағаз өнімдері", brand: "Office Line", description: "Күнделікті басып шығаруға арналған ақ кеңсе қағазы. Лазерлік және сиялы принтерлерге жарайды.", imageUrl: "", imageUrls: [], minOrder: 5, unit: "қаптама", bulletPoints: ["A4 форматы", "80 г/м²", "500 парақ", "Ақтық деңгейі жоғары"] },
  { id: "demo-gloves", name: "Жұмыс қолғаптары", sku: "SAFE-GLOVE-GRY", price: 860, stock: 310, category: "Өнеркәсіп және бизнес", subcategory: "Қауіпсіздік және қорғаныс", brand: "SafeWork", description: "Қойма және өндірістік жұмыстарға арналған қорғаныс қолғаптары. Алақан бөлігі сырғанамайтын жабынмен күшейтілген.", imageUrl: "", imageUrls: [], minOrder: 12, unit: "жұп", bulletPoints: ["Сырғанамайтын жабын", "Әмбебап өлшем", "Тозуға төзімді", "Қойма жұмысына арналған"] },
  { id: "demo-coffee", name: "Кофе Jacobs Monarch, 200 г", sku: "JAC-MON-200", price: 2980, stock: 220, category: "Азық-түлік және сусындар", subcategory: "Бакалея", brand: "Jacobs", description: "Кеңсе, дүкен және HoReCa үшін еритін кофе. Қанық дәм мен хош иісті сақтайтын шыны құтыда.", imageUrl: "", imageUrls: [], minOrder: 4, unit: "дана", bulletPoints: ["200 г", "Еритін кофе", "Шыны құты", "Кеңсе мен HoReCa үшін"] },
];

export const money = {
  format(value: number) {
    const rounded = Math.round(Number(value) || 0);
    const sign = rounded < 0 ? "−" : "";
    const digits = Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return `${sign}${digits} ₸`;
  },
};

export function normalizeProduct(row: Record<string, unknown>): CatalogProduct {
  return {
    id: String(row.id),
    companyId: typeof row.company_id === "string" ? row.company_id : undefined,
    name: String(row.marketplace_title || row.name || "Тауар"),
    sku: String(row.sku || "SKU көрсетілмеген"),
    price: Number(row.price || 0),
    stock: Math.max(0, Number(row.stock || 0)),
    category: String(row.category || row.marketplace_category || "Басқа тауарлар"),
    subcategory: String(row.subcategory || row.marketplace_subcategory || "Өзге"),
    brand: String(row.brand || ""),
    description: String(row.marketplace_description || row.description || "Alsat Marketplace каталогындағы тауар."),
    imageUrl: typeof row.marketplace_image_url === "string" ? row.marketplace_image_url : typeof row.image_url === "string" ? row.image_url : "",
    imageUrls: Array.isArray(row.image_urls) ? row.image_urls.filter((item): item is string => typeof item === "string") : [],
    minOrder: Math.max(1, Number(row.marketplace_min_order || 1)),
    unit: String(row.unit || "дана"),
    bulletPoints: Array.isArray(row.bullet_points) ? row.bullet_points.filter((item): item is string => typeof item === "string") : [],
  };
}

export function demoProductArtIndex(productId: string) {
  return Math.max(0, demoProducts.findIndex((product) => product.id === productId));
}
