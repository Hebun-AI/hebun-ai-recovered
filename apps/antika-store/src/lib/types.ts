export type ProductStatus = "yayinda" | "taslak";

export type Product = {
  id: string;
  /** URL'de kullanılan benzersiz ad: /urun/<slug> */
  slug: string;
  title: string;
  /** Katalog numarası — müzayede fişi hissi için. */
  reference: string;
  categorySlug: string;
  /** Kuruş cinsinden. Para birimi TRY. */
  priceKurus: number;
  stock: number;
  status: ProductStatus;
  featured: boolean;
  /** Kısa vitrin metni (liste kartlarında). */
  excerpt: string;
  /** Uzun açıklama; satır aralarıyla paragraflara bölünür. */
  description: string;
  /** Ürün künyesi: Dönem, Menşe, Ölçü, Malzeme... */
  attributes: { label: string; value: string }[];
  /** Boşsa üretilen "arşiv plakası" görseli kullanılır. */
  imageUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type Category = {
  id: string;
  slug: string;
  name: string;
  description: string;
  /** Kategori vitrininde gösterilen dönem etiketi. */
  era: string;
};

export type OrderItem = {
  productId: string;
  title: string;
  reference: string;
  slug: string;
  unitPriceKurus: number;
  quantity: number;
};

export type OrderStatus = "beklemede" | "odendi" | "iptal";

export type Order = {
  id: string;
  /** Görünen sipariş numarası: TRH-2026-0007 */
  number: string;
  status: OrderStatus;
  items: OrderItem[];
  totalKurus: number;
  customerName: string;
  customerEmail: string;
  /** Stripe Checkout oturumu; demo modda "demo". */
  stripeSessionId: string;
  createdAt: string;
};

export type Message = {
  id: string;
  name: string;
  email: string;
  subject: string;
  body: string;
  read: boolean;
  createdAt: string;
};

export type Settings = {
  siteTitle: string;
  tagline: string;
  email: string;
  phone: string;
  address: string;
  workingHours: string;
  instagram: string;
  /** Kargo bedava eşiği (kuruş). 0 = her siparişte ücretsiz. */
  freeShippingLimitKurus: number;
  shippingFeeKurus: number;
};

export type Database = {
  products: Product[];
  categories: Category[];
  orders: Order[];
  messages: Message[];
  settings: Settings;
};
