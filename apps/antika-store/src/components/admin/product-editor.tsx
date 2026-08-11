"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormStatus } from "react-dom";

import { removeProduct, saveProduct } from "@/app/admin/(panel)/actions";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { ProductVisual } from "@/components/archive-plate";
import { kurusToInput } from "@/lib/format";
import type { Category, Product } from "@/lib/types";

const EMPTY_ATTRIBUTES = [
  { label: "Dönem", value: "" },
  { label: "Menşe", value: "" },
  { label: "Malzeme", value: "" },
  { label: "Ölçü", value: "" },
  { label: "Durum", value: "" },
];

function SaveButton({ isNew }: { isNew: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="admin-btn w-full" disabled={pending}>
      {pending ? "Kaydediliyor…" : isNew ? "Yayınla" : "Güncelle"}
    </button>
  );
}

export function ProductEditor({
  product,
  categories,
}: {
  product?: Product;
  categories: Category[];
}) {
  const isNew = !product;
  const [attributes, setAttributes] = useState(
    product?.attributes.length ? product.attributes : EMPTY_ATTRIBUTES,
  );
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");

  return (
    <form action={saveProduct} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      {product ? <input type="hidden" name="id" value={product.id} /> : null}

      {/* ------------------------------ ana sütun ----------------------------- */}
      <div className="space-y-5">
        <div>
          <label className="admin-label" htmlFor="title">
            Ürün adı
          </label>
          <input
            id="title"
            name="title"
            required
            defaultValue={product?.title}
            placeholder="Sedef Kakma Osmanlı Konsol"
            className="admin-title-input"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
          <span className="text-ink-faint">Kalıcı bağlantı:</span>
          <span>/urun/</span>
          <input
            name="slug"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="otomatik oluşturulur"
            className="admin-field w-64 py-1"
          />
          {product ? (
            <Link
              href={`/urun/${product.slug}`}
              target="_blank"
              className="text-verdigris hover:underline"
            >
              Görüntüle ↗
            </Link>
          ) : null}
        </div>

        <section className="admin-box">
          <h2 className="admin-box-title">Vitrin metni</h2>
          <div className="admin-box-body">
            <textarea
              name="excerpt"
              rows={2}
              defaultValue={product?.excerpt}
              placeholder="Kartlarda ve liste sayfalarında görünen tek cümlelik tanıtım."
              className="admin-field resize-y"
            />
          </div>
        </section>

        <section className="admin-box">
          <h2 className="admin-box-title">Ekspertiz notu / açıklama</h2>
          <div className="admin-box-body">
            <textarea
              name="description"
              rows={12}
              defaultValue={product?.description}
              placeholder={
                "Parçanın hikâyesini yazın.\nHer satır ayrı paragraf olur.\nKusur ve onarımları açıkça belirtin."
              }
              className="admin-field resize-y font-[var(--font-sans)] leading-relaxed"
            />
            <p className="mt-2 text-xs text-ink-faint">
              Satır sonu = yeni paragraf. Ürün sayfasında “Parça hakkında” bölümünde çıkar.
            </p>
          </div>
        </section>

        <section className="admin-box">
          <h2 className="admin-box-title">Künye</h2>
          <div className="admin-box-body space-y-2">
            {attributes.map((attribute, index) => (
              <div key={index} className="grid grid-cols-[10rem_minmax(0,1fr)_auto] gap-2">
                <input
                  name="attrLabel"
                  defaultValue={attribute.label}
                  placeholder="Dönem"
                  className="admin-field"
                />
                <input
                  name="attrValue"
                  defaultValue={attribute.value}
                  placeholder="y. 1885"
                  className="admin-field"
                />
                <button
                  type="button"
                  onClick={() => setAttributes(attributes.filter((_, i) => i !== index))}
                  className="admin-btn admin-btn-secondary px-3"
                  aria-label="Satırı sil"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setAttributes([...attributes, { label: "", value: "" }])}
              className="admin-btn admin-btn-secondary"
            >
              + Satır ekle
            </button>
            <p className="text-xs text-ink-faint">
              Boş bırakılan satırlar kaydedilmez. İlk satır ürün kartında etiket olarak görünür.
            </p>
          </div>
        </section>
      </div>

      {/* ------------------------------- yan sütun ---------------------------- */}
      <div className="space-y-5">
        <section className="admin-box">
          <h2 className="admin-box-title">Yayınla</h2>
          <div className="admin-box-body space-y-4">
            <div>
              <label className="admin-label" htmlFor="status">
                Durum
              </label>
              <select
                id="status"
                name="status"
                defaultValue={product?.status ?? "yayinda"}
                className="admin-field"
              >
                <option value="yayinda">Yayında</option>
                <option value="taslak">Taslak</option>
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="featured"
                defaultChecked={product?.featured ?? false}
                className="h-4 w-4 accent-[#a87f2e]"
              />
              Ana sayfa vitrininde göster
            </label>

            <SaveButton isNew={isNew} />

            {product ? (
              <ConfirmButton
                formAction={removeProduct}
                className="admin-btn admin-btn-danger w-full"
                message={`"${product.title}" kalıcı olarak silinecek. Emin misiniz?`}
              >
                Ürünü sil
              </ConfirmButton>
            ) : null}
          </div>
        </section>

        <section className="admin-box">
          <h2 className="admin-box-title">Kategori</h2>
          <div className="admin-box-body max-h-56 space-y-2 overflow-y-auto">
            {categories.map((category, index) => (
              <label key={category.id} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="categorySlug"
                  value={category.slug}
                  defaultChecked={
                    product ? product.categorySlug === category.slug : index === 0
                  }
                  className="h-4 w-4 accent-[#a87f2e]"
                />
                {category.name}
              </label>
            ))}
            <Link
              href="/admin/kategoriler"
              className="mt-2 inline-block text-sm text-verdigris hover:underline"
            >
              + Yeni kategori
            </Link>
          </div>
        </section>

        <section className="admin-box">
          <h2 className="admin-box-title">Ürün verisi</h2>
          <div className="admin-box-body space-y-3">
            <div>
              <label className="admin-label" htmlFor="price">
                Fiyat (₺)
              </label>
              <input
                id="price"
                name="price"
                inputMode="decimal"
                defaultValue={product ? kurusToInput(product.priceKurus) : ""}
                placeholder="185000.00"
                className="admin-field tnum"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="admin-label" htmlFor="stock">
                  Stok
                </label>
                <input
                  id="stock"
                  name="stock"
                  type="number"
                  min={0}
                  defaultValue={product?.stock ?? 1}
                  className="admin-field tnum"
                />
              </div>
              <div>
                <label className="admin-label" htmlFor="reference">
                  Referans
                </label>
                <input
                  id="reference"
                  name="reference"
                  defaultValue={product?.reference}
                  placeholder="TRH-000"
                  className="admin-field tnum"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="admin-box">
          <h2 className="admin-box-title">Öne çıkan görsel</h2>
          <div className="admin-box-body space-y-3">
            <div className="aspect-[4/5] w-full overflow-hidden border border-[#ded2bd]">
              <ProductVisual
                src={imageUrl}
                alt=""
                seed={slug || "yeni-parca"}
                monogram={slug || "M"}
              />
            </div>
            <input
              name="imageUrl"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="https://… görsel adresi"
              className="admin-field"
            />
            <p className="text-xs text-ink-faint">
              Boş bırakırsanız ürüne özel arşiv plakası üretilir — vitrinde gri kutu görünmez.
            </p>
          </div>
        </section>
      </div>
    </form>
  );
}
