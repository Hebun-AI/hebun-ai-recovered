import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductEditor } from "@/components/admin/product-editor";
import { Notice, PageHeader } from "@/components/admin/ui";
import { getCategories, getProductById } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Ürünü düzenle", robots: { index: false } };

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ bildirim?: string }>;
}) {
  const [{ id }, { bildirim }] = await Promise.all([params, searchParams]);

  const [product, categories] = await Promise.all([getProductById(id), getCategories()]);
  if (!product) notFound();

  return (
    <>
      <PageHeader
        title="Ürünü düzenle"
        action={{ href: "/admin/urunler", label: "← Listeye dön" }}
        description={`Son güncelleme: ${formatDateTime(product.updatedAt)}`}
      />
      <Notice code={bildirim} />
      <ProductEditor product={product} categories={categories} />
    </>
  );
}
