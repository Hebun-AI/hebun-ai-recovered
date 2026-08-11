import type { Metadata } from "next";
import Link from "next/link";

import { removeCategory, saveCategory } from "@/app/admin/(panel)/actions";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Notice, PageHeader } from "@/components/admin/ui";
import { getCategories, getProducts } from "@/lib/db";

export const metadata: Metadata = { title: "Kategoriler", robots: { index: false } };

export default async function AdminCategories({
  searchParams,
}: {
  searchParams: Promise<{ duzenle?: string; bildirim?: string }>;
}) {
  const { duzenle, bildirim } = await searchParams;

  const [categories, products] = await Promise.all([
    getCategories(),
    getProducts({ includeDrafts: true }),
  ]);

  const editing = categories.find((category) => category.id === duzenle);

  return (
    <>
      <PageHeader
        title="Kategoriler"
        description="Kategori adını değiştirmek ürün bağlantılarını da günceller."
      />
      <Notice code={bildirim} />

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <section className="admin-box h-fit">
          <h2 className="admin-box-title">
            {editing ? "Kategoriyi düzenle" : "Yeni kategori ekle"}
          </h2>
          <form action={saveCategory} className="admin-box-body space-y-3">
            {editing ? <input type="hidden" name="id" value={editing.id} /> : null}

            <div>
              <label className="admin-label" htmlFor="name">
                Ad
              </label>
              <input
                id="name"
                name="name"
                required
                defaultValue={editing?.name}
                placeholder="Mobilya & Ahşap"
                className="admin-field"
                key={`name-${editing?.id ?? "yeni"}`}
              />
            </div>

            <div>
              <label className="admin-label" htmlFor="slug">
                Kısa ad (URL)
              </label>
              <input
                id="slug"
                name="slug"
                defaultValue={editing?.slug}
                placeholder="mobilya-ahsap"
                className="admin-field"
                key={`slug-${editing?.id ?? "yeni"}`}
              />
            </div>

            <div>
              <label className="admin-label" htmlFor="era">
                Dönem aralığı
              </label>
              <input
                id="era"
                name="era"
                defaultValue={editing?.era}
                placeholder="1860 — 1940"
                className="admin-field tnum"
                key={`era-${editing?.id ?? "yeni"}`}
              />
            </div>

            <div>
              <label className="admin-label" htmlFor="description">
                Açıklama
              </label>
              <textarea
                id="description"
                name="description"
                rows={4}
                defaultValue={editing?.description}
                placeholder="Bölümün kapsamı ve ekspertiz ölçütü."
                className="admin-field resize-y"
                key={`desc-${editing?.id ?? "yeni"}`}
              />
            </div>

            <div className="flex gap-2">
              <button type="submit" className="admin-btn flex-1">
                {editing ? "Güncelle" : "Kategori ekle"}
              </button>
              {editing ? (
                <Link href="/admin/kategoriler" className="admin-btn admin-btn-secondary">
                  Vazgeç
                </Link>
              ) : null}
            </div>
          </form>
        </section>

        <div className="admin-box overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Ad</th>
                <th>Kısa ad</th>
                <th>Dönem</th>
                <th>Ürün</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => {
                const count = products.filter(
                  (product) => product.categorySlug === category.slug,
                ).length;

                return (
                  <tr key={category.id}>
                    <td>
                      <Link
                        href={`/admin/kategoriler?duzenle=${category.id}`}
                        className="font-medium text-ink hover:text-oxblood"
                      >
                        {category.name}
                      </Link>
                      <p className="mt-1 line-clamp-1 text-xs text-ink-faint">
                        {category.description}
                      </p>
                      <div className="row-actions mt-1 flex items-center gap-2">
                        <Link href={`/admin/kategoriler?duzenle=${category.id}`}>
                          Düzenle
                        </Link>
                        <span className="text-ink-faint">|</span>
                        <Link href={`/kategori/${category.slug}`} target="_blank">
                          Görüntüle
                        </Link>
                        <span className="text-ink-faint">|</span>
                        <form action={removeCategory} className="inline">
                          <input type="hidden" name="id" value={category.id} />
                          <ConfirmButton
                            className="danger"
                            message={`"${category.name}" silinecek. İçindeki ${count} ürün kategorisiz kalır. Emin misiniz?`}
                          >
                            Sil
                          </ConfirmButton>
                        </form>
                      </div>
                    </td>
                    <td className="text-ink-faint">{category.slug}</td>
                    <td className="tnum text-ink-faint">{category.era}</td>
                    <td className="tnum">{count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
