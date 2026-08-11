import type { Metadata } from "next";

import { CatalogView } from "@/components/site/catalog-view";
import { getCategories, getProducts, type ProductQuery } from "@/lib/db";

export const metadata: Metadata = {
  title: "Katalog",
  description: "Vitrindeki tüm antika parçalar — mobilya, halı, gümüş, seramik ve objeler.",
};

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ sirala?: string }>;
}) {
  const { sirala } = await searchParams;
  const sort = (["yeni", "artan", "azalan"] as const).includes(sirala as never)
    ? (sirala as ProductQuery["sort"])
    : "yeni";

  const [categories, products] = await Promise.all([
    getCategories(),
    getProducts({ sort }),
  ]);

  return (
    <CatalogView
      categories={categories}
      products={products}
      sort={sort ?? "yeni"}
      eyebrow="Katalog XXVI"
      title="Vitrindeki her şey"
      description="Beş bölüm, tek tek belgelenmiş parçalar. Listedeki her kayıt tektir; satıldığında yerine aynısı gelmez."
    />
  );
}
