import type { Metadata } from "next";
import Link from "next/link";

import { removeProduct, toggleProductStatus } from "@/app/admin/(panel)/actions";
import { ProductVisual } from "@/components/archive-plate";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Notice, PageHeader, StatusBadge } from "@/components/admin/ui";
import { getCategories, getProducts } from "@/lib/db";
import { formatDate, formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Ürünler", robots: { index: false } };

type Search = { durum?: string; ara?: string; bildirim?: string };

export default async function AdminProducts({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { durum, ara, bildirim } = await searchParams;

  const [all, categories] = await Promise.all([
    getProducts({ includeDrafts: true, search: ara }),
    getCategories(),
  ]);

  const products =
    durum === "yayinda" || durum === "taslak"
      ? all.filter((product) => product.status === durum)
      : all;

  const counts = {
    tumu: all.length,
    yayinda: all.filter((product) => product.status === "yayinda").length,
    taslak: all.filter((product) => product.status === "taslak").length,
  };

  const filters = [
    { key: "", label: "Tümü", count: counts.tumu },
    { key: "yayinda", label: "Yayında", count: counts.yayinda },
    { key: "taslak", label: "Taslak", count: counts.taslak },
  ];

  return (
    <>
      <PageHeader
        title="Ürünler"
        action={{ href: "/admin/urunler/yeni", label: "Yeni ekle" }}
      />
      <Notice code={bildirim} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-sm">
          {filters.map((filter, index) => (
            <span key={filter.label} className="flex items-center gap-3">
              {index > 0 ? <span className="text-ink-faint">|</span> : null}
              <Link
                href={filter.key ? `/admin/urunler?durum=${filter.key}` : "/admin/urunler"}
                className={
                  (durum ?? "") === filter.key
                    ? "font-medium text-ink"
                    : "text-verdigris hover:underline"
                }
              >
                {filter.label}{" "}
                <span className="tnum text-ink-faint">({filter.count})</span>
              </Link>
            </span>
          ))}
        </div>

        <form className="flex items-center gap-2">
          {durum ? <input type="hidden" name="durum" value={durum} /> : null}
          <input
            name="ara"
            defaultValue={ara ?? ""}
            placeholder="Ürünlerde ara"
            className="admin-field w-52"
          />
          <button type="submit" className="admin-btn admin-btn-secondary">
            Ara
          </button>
        </form>
      </div>

      <div className="admin-box overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th className="w-14" />
              <th>Ürün</th>
              <th>Referans</th>
              <th>Kategori</th>
              <th>Fiyat</th>
              <th>Stok</th>
              <th>Durum</th>
              <th>Tarih</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-10 text-center text-ink-faint">
                  Kayıt bulunamadı.
                </td>
              </tr>
            ) : (
              products.map((product) => {
                const category = categories.find((item) => item.slug === product.categorySlug);
                return (
                  <tr key={product.id}>
                    <td>
                      <div className="h-12 w-10 overflow-hidden border border-[#ded2bd]">
                        <ProductVisual
                          src={product.imageUrl}
                          alt=""
                          seed={product.slug}
                          monogram={product.title}
                        />
                      </div>
                    </td>
                    <td>
                      <Link
                        href={`/admin/urunler/${product.id}`}
                        className="font-medium text-ink hover:text-oxblood"
                      >
                        {product.title}
                      </Link>
                      <div className="row-actions mt-1 flex flex-wrap items-center gap-2">
                        <Link href={`/admin/urunler/${product.id}`}>Düzenle</Link>
                        <span className="text-ink-faint">|</span>
                        <form action={toggleProductStatus} className="inline">
                          <input type="hidden" name="id" value={product.id} />
                          <input type="hidden" name="status" value={product.status} />
                          <button type="submit">
                            {product.status === "yayinda" ? "Taslağa al" : "Yayınla"}
                          </button>
                        </form>
                        <span className="text-ink-faint">|</span>
                        <Link href={`/urun/${product.slug}`} target="_blank">
                          Görüntüle
                        </Link>
                        <span className="text-ink-faint">|</span>
                        <form action={removeProduct} className="inline">
                          <input type="hidden" name="id" value={product.id} />
                          <ConfirmButton
                            className="danger"
                            message={`"${product.title}" kalıcı olarak silinecek. Emin misiniz?`}
                          >
                            Sil
                          </ConfirmButton>
                        </form>
                      </div>
                    </td>
                    <td className="tnum text-ink-faint">{product.reference}</td>
                    <td>
                      {category ? (
                        <Link
                          href={`/admin/urunler?durum=${durum ?? ""}`}
                          className="text-verdigris hover:underline"
                        >
                          {category.name}
                        </Link>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </td>
                    <td className="tnum">{formatPrice(product.priceKurus)}</td>
                    <td className="tnum">
                      {product.stock > 0 ? (
                        product.stock
                      ) : (
                        <span className="text-oxblood">Tükendi</span>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={product.status} />
                    </td>
                    <td className="tnum text-ink-faint">{formatDate(product.createdAt)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-sm text-ink-faint">
        {products.length} kayıt gösteriliyor. Satırın üzerine gelince işlemler belirir.
      </p>
    </>
  );
}
