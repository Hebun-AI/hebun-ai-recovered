"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { endSession } from "@/lib/auth";
import {
  createCategory,
  createProduct,
  deleteCategory,
  deleteMessage,
  deleteProduct,
  markOrderPaid,
  setMessageRead,
  setOrderStatus,
  slugify,
  updateCategory,
  updateProduct,
  updateSettings,
  type ProductInput,
} from "@/lib/db";
import { parsePriceToKurus } from "@/lib/format";
import type { OrderStatus, ProductStatus } from "@/lib/types";

/** Ürün değişince mağaza tarafındaki önbelleği tazele. */
function revalidateStore() {
  revalidatePath("/", "layout");
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function readProductInput(formData: FormData): ProductInput {
  const title = text(formData, "title") || "İsimsiz parça";

  const labels = formData.getAll("attrLabel").map((value) => String(value).trim());
  const values = formData.getAll("attrValue").map((value) => String(value).trim());
  const attributes = labels
    .map((label, index) => ({ label, value: values[index] ?? "" }))
    .filter((attribute) => attribute.label && attribute.value);

  return {
    title,
    slug: slugify(text(formData, "slug") || title),
    reference: text(formData, "reference") || "TRH-000",
    categorySlug: text(formData, "categorySlug"),
    priceKurus: parsePriceToKurus(text(formData, "price")),
    stock: Math.max(0, Number.parseInt(text(formData, "stock"), 10) || 0),
    status: (text(formData, "status") === "taslak" ? "taslak" : "yayinda") as ProductStatus,
    featured: formData.get("featured") === "on",
    excerpt: text(formData, "excerpt"),
    description: text(formData, "description"),
    attributes,
    imageUrl: text(formData, "imageUrl"),
  };
}

export async function saveProduct(formData: FormData) {
  const id = text(formData, "id");
  const input = readProductInput(formData);

  if (id) {
    await updateProduct(id, input);
    revalidateStore();
    redirect(`/admin/urunler/${id}?bildirim=guncellendi`);
  }

  const created = await createProduct(input);
  revalidateStore();
  redirect(`/admin/urunler/${created.id}?bildirim=olusturuldu`);
}

export async function removeProduct(formData: FormData) {
  await deleteProduct(text(formData, "id"));
  revalidateStore();
  redirect("/admin/urunler?bildirim=silindi");
}

export async function toggleProductStatus(formData: FormData) {
  const id = text(formData, "id");
  const status = text(formData, "status") === "yayinda" ? "taslak" : "yayinda";
  await updateProduct(id, { status });
  revalidateStore();
  revalidatePath("/admin/urunler");
}

export async function saveCategory(formData: FormData) {
  const id = text(formData, "id");
  const name = text(formData, "name");
  if (!name) redirect("/admin/kategoriler?bildirim=hata");

  const input = {
    name,
    slug: slugify(text(formData, "slug") || name),
    era: text(formData, "era"),
    description: text(formData, "description"),
  };

  if (id) await updateCategory(id, input);
  else await createCategory(input);

  revalidateStore();
  redirect("/admin/kategoriler?bildirim=kaydedildi");
}

export async function removeCategory(formData: FormData) {
  await deleteCategory(text(formData, "id"));
  revalidateStore();
  redirect("/admin/kategoriler?bildirim=silindi");
}

export async function changeOrderStatus(formData: FormData) {
  const id = text(formData, "id");
  const status = text(formData, "status") as OrderStatus;

  // "Ödendi"ye geçiş stok düşümünü de tetikler; markOrderPaid bunu bir kez yapar.
  if (status === "odendi") await markOrderPaid(id);
  else await setOrderStatus(id, status);

  revalidateStore();
  revalidatePath("/admin/siparisler");
}

export async function toggleMessageRead(formData: FormData) {
  await setMessageRead(text(formData, "id"), text(formData, "read") !== "true");
  revalidatePath("/admin/mesajlar");
  revalidatePath("/admin");
}

export async function removeMessage(formData: FormData) {
  await deleteMessage(text(formData, "id"));
  revalidatePath("/admin/mesajlar");
  redirect("/admin/mesajlar?bildirim=silindi");
}

export async function saveSettings(formData: FormData) {
  await updateSettings({
    siteTitle: text(formData, "siteTitle"),
    tagline: text(formData, "tagline"),
    email: text(formData, "email"),
    phone: text(formData, "phone"),
    address: text(formData, "address"),
    workingHours: text(formData, "workingHours"),
    instagram: text(formData, "instagram"),
    freeShippingLimitKurus: parsePriceToKurus(text(formData, "freeShippingLimit")),
    shippingFeeKurus: parsePriceToKurus(text(formData, "shippingFee")),
  });
  revalidateStore();
  redirect("/admin/ayarlar?bildirim=kaydedildi");
}

export async function logout() {
  await endSession();
  redirect("/admin/giris");
}
