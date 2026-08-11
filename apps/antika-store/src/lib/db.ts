import { promises as fs } from "node:fs";
import path from "node:path";

import type {
  Category,
  Database,
  Message,
  Order,
  Product,
  Settings,
} from "./types";

/**
 * Örnek mağaza için dosya tabanlı depo.
 *
 * Amaç: kurulum sürtünmesi olmadan (Postgres/Supabase kurmadan) tüm akışın —
 * ürün ekleme, sipariş, mesaj — uçtan uca çalışması. Arayüz bilerek dar
 * tutuldu; Hebun Commerce'e taşınırken bu dosyanın yerine Drizzle repository
 * konur, çağıran taraf değişmez.
 */

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "db.json");
const SEED_PATH = path.join(DATA_DIR, "seed.json");

/** Aynı anda gelen yazmaları sıraya alır — dosya deposunun tek kilidi. */
let writeQueue: Promise<unknown> = Promise.resolve();

async function readDatabase(): Promise<Database> {
  try {
    const raw = await fs.readFile(DB_PATH, "utf8");
    return JSON.parse(raw) as Database;
  } catch {
    const seed = JSON.parse(await fs.readFile(SEED_PATH, "utf8")) as Database;
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DB_PATH, JSON.stringify(seed, null, 2), "utf8");
    return seed;
  }
}

async function writeDatabase(db: Database): Promise<void> {
  const tmp = `${DB_PATH}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
  await fs.rename(tmp, DB_PATH);
}

/** Okuma + yazmayı tek sıra üzerinde yapar, kayıp güncellemeyi önler. */
async function mutate<T>(fn: (db: Database) => T | Promise<T>): Promise<T> {
  const run = writeQueue.then(async () => {
    const db = await readDatabase();
    const result = await fn(db);
    await writeDatabase(db);
    return result;
  });
  writeQueue = run.catch(() => undefined);
  return run;
}

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function slugify(input: string): string {
  const map: Record<string, string> = {
    ç: "c", Ç: "c", ğ: "g", Ğ: "g", ı: "i", İ: "i",
    ö: "o", Ö: "o", ş: "s", Ş: "s", ü: "u", Ü: "u",
  };
  return input
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

/* ---------------------------------- okuma --------------------------------- */

export async function getSettings(): Promise<Settings> {
  return (await readDatabase()).settings;
}

export async function getCategories(): Promise<Category[]> {
  return (await readDatabase()).categories;
}

export async function getCategory(slug: string): Promise<Category | undefined> {
  return (await readDatabase()).categories.find((c) => c.slug === slug);
}

export type ProductQuery = {
  categorySlug?: string;
  /** Varsayılan olarak yalnız yayında olanlar döner; admin true geçer. */
  includeDrafts?: boolean;
  featuredOnly?: boolean;
  search?: string;
  sort?: "yeni" | "artan" | "azalan";
};

export async function getProducts(query: ProductQuery = {}): Promise<Product[]> {
  const db = await readDatabase();
  let items = db.products;

  if (!query.includeDrafts) items = items.filter((p) => p.status === "yayinda");
  if (query.categorySlug) items = items.filter((p) => p.categorySlug === query.categorySlug);
  if (query.featuredOnly) items = items.filter((p) => p.featured);

  if (query.search) {
    const needle = query.search.toLocaleLowerCase("tr");
    items = items.filter((p) =>
      [p.title, p.reference, p.excerpt].some((field) =>
        field.toLocaleLowerCase("tr").includes(needle),
      ),
    );
  }

  const sorted = [...items];
  if (query.sort === "artan") sorted.sort((a, b) => a.priceKurus - b.priceKurus);
  else if (query.sort === "azalan") sorted.sort((a, b) => b.priceKurus - a.priceKurus);
  else sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return sorted;
}

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  return (await readDatabase()).products.find((p) => p.slug === slug);
}

export async function getProductById(id: string): Promise<Product | undefined> {
  return (await readDatabase()).products.find((p) => p.id === id);
}

export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  const db = await readDatabase();
  return ids
    .map((id) => db.products.find((p) => p.id === id))
    .filter((p): p is Product => Boolean(p));
}

export async function getOrders(): Promise<Order[]> {
  const db = await readDatabase();
  return [...db.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getOrderById(id: string): Promise<Order | undefined> {
  return (await readDatabase()).orders.find((o) => o.id === id);
}

export async function getMessages(): Promise<Message[]> {
  const db = await readDatabase();
  return [...db.messages].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* --------------------------------- yazma ---------------------------------- */

export type ProductInput = Omit<Product, "id" | "createdAt" | "updatedAt">;

export async function createProduct(input: ProductInput): Promise<Product> {
  return mutate((db) => {
    const product: Product = {
      ...input,
      slug: uniqueSlug(db.products, input.slug || slugify(input.title)),
      id: randomId("prd"),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.products.unshift(product);
    return product;
  });
}

export async function updateProduct(
  id: string,
  input: Partial<ProductInput>,
): Promise<Product | undefined> {
  return mutate((db) => {
    const product = db.products.find((p) => p.id === id);
    if (!product) return undefined;
    if (input.slug && input.slug !== product.slug) {
      input = { ...input, slug: uniqueSlug(db.products, input.slug, id) };
    }
    Object.assign(product, input, { updatedAt: nowIso() });
    return product;
  });
}

export async function deleteProduct(id: string): Promise<void> {
  await mutate((db) => {
    db.products = db.products.filter((p) => p.id !== id);
  });
}

function uniqueSlug(products: Product[], base: string, ignoreId?: string): string {
  const clean = slugify(base) || "urun";
  let candidate = clean;
  let counter = 2;
  while (products.some((p) => p.slug === candidate && p.id !== ignoreId)) {
    candidate = `${clean}-${counter++}`;
  }
  return candidate;
}

export async function createCategory(input: Omit<Category, "id">): Promise<Category> {
  return mutate((db) => {
    const category: Category = { ...input, id: randomId("cat") };
    db.categories.push(category);
    return category;
  });
}

export async function updateCategory(
  id: string,
  input: Partial<Omit<Category, "id">>,
): Promise<void> {
  await mutate((db) => {
    const category = db.categories.find((c) => c.id === id);
    if (!category) return;
    const previousSlug = category.slug;
    Object.assign(category, input);
    if (input.slug && input.slug !== previousSlug) {
      for (const product of db.products) {
        if (product.categorySlug === previousSlug) product.categorySlug = category.slug;
      }
    }
  });
}

export async function deleteCategory(id: string): Promise<void> {
  await mutate((db) => {
    db.categories = db.categories.filter((c) => c.id !== id);
  });
}

export async function createOrder(
  input: Omit<Order, "id" | "number" | "createdAt">,
): Promise<Order> {
  return mutate((db) => {
    const year = new Date().getFullYear();
    const sequence = String(db.orders.length + 1).padStart(4, "0");
    const order: Order = {
      ...input,
      id: randomId("ord"),
      number: `TRH-${year}-${sequence}`,
      createdAt: nowIso(),
    };
    db.orders.unshift(order);
    return order;
  });
}

export async function markOrderPaid(sessionIdOrOrderId: string): Promise<Order | undefined> {
  return mutate((db) => {
    const order = db.orders.find(
      (o) => o.stripeSessionId === sessionIdOrOrderId || o.id === sessionIdOrOrderId,
    );
    if (!order || order.status === "odendi") return order;
    order.status = "odendi";
    // Ödeme kesinleşince stok düşülür — sepete atmak stok tutmaz.
    for (const item of order.items) {
      const product = db.products.find((p) => p.id === item.productId);
      if (product) product.stock = Math.max(0, product.stock - item.quantity);
    }
    return order;
  });
}

export async function setOrderCustomer(
  id: string,
  customer: { customerName?: string; customerEmail?: string },
): Promise<void> {
  await mutate((db) => {
    const order = db.orders.find((o) => o.id === id);
    if (!order) return;
    if (customer.customerName) order.customerName = customer.customerName;
    if (customer.customerEmail) order.customerEmail = customer.customerEmail;
  });
}

export async function setOrderStatus(id: string, status: Order["status"]): Promise<void> {
  await mutate((db) => {
    const order = db.orders.find((o) => o.id === id);
    if (order) order.status = status;
  });
}

export async function attachSessionToOrder(id: string, sessionId: string): Promise<void> {
  await mutate((db) => {
    const order = db.orders.find((o) => o.id === id);
    if (order) order.stripeSessionId = sessionId;
  });
}

export async function createMessage(
  input: Omit<Message, "id" | "createdAt" | "read">,
): Promise<Message> {
  return mutate((db) => {
    const message: Message = {
      ...input,
      id: randomId("msg"),
      read: false,
      createdAt: nowIso(),
    };
    db.messages.unshift(message);
    return message;
  });
}

export async function setMessageRead(id: string, read: boolean): Promise<void> {
  await mutate((db) => {
    const message = db.messages.find((m) => m.id === id);
    if (message) message.read = read;
  });
}

export async function deleteMessage(id: string): Promise<void> {
  await mutate((db) => {
    db.messages = db.messages.filter((m) => m.id !== id);
  });
}

export async function updateSettings(input: Partial<Settings>): Promise<void> {
  await mutate((db) => {
    db.settings = { ...db.settings, ...input };
  });
}
