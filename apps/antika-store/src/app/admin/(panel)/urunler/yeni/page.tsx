import type { Metadata } from "next";

import { ProductEditor } from "@/components/admin/product-editor";
import { PageHeader } from "@/components/admin/ui";
import { getCategories } from "@/lib/db";

export const metadata: Metadata = { title: "Yeni ürün", robots: { index: false } };

export default async function NewProductPage() {
  const categories = await getCategories();

  return (
    <>
      <PageHeader
        title="Yeni ürün ekle"
        action={{ href: "/admin/urunler", label: "← Listeye dön" }}
        description="Kaydettiğiniz an vitrinde görünür; hazır değilse durumu Taslak bırakın."
      />
      <ProductEditor categories={categories} />
    </>
  );
}
