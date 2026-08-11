import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CatalogView } from "@/components/site/catalog-view";
import { getCategories, getCategory, getProducts, type ProductQuery } from "@/lib/db";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) return { title: "Bölüm bulunamadı" };
  return { title: category.name, description: category.description };
}

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((category) => ({ slug: category.slug }));
}

export default async function CategoryPage({
  params,
  searchParams,
}: Params & { searchParams: Promise<{ sirala?: string }> }) {
  const [{ slug }, { sirala }] = await Promise.all([params, searchParams]);
  const category = await getCategory(slug);
  if (!category) notFound();

  const sort = (["yeni", "artan", "azalan"] as const).includes(sirala as never)
    ? (sirala as ProductQuery["sort"])
    : "yeni";

  const [categories, products] = await Promise.all([
    getCategories(),
    getProducts({ categorySlug: slug, sort }),
  ]);

  return (
    <CatalogView
      categories={categories}
      products={products}
      activeCategory={category}
      sort={sort ?? "yeni"}
      eyebrow={`Bölüm · ${category.era}`}
      title={category.name}
      description={category.description}
    />
  );
}
