import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-2xl px-5 py-32 text-center">
      <p className="eyebrow">Kayıt yok</p>
      <h1 className="display mt-4 text-[3.2rem] leading-none">
        Bu parça arşivde bulunamadı.
      </h1>
      <p className="mt-5 text-ink-soft">
        Aradığınız sayfa taşınmış ya da parça satılmış olabilir. Katalogdan devam edin;
        benzerini bulmamızı isterseniz yazın.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link href="/kategori" className="btn">
          Kataloğa dön
        </Link>
        <Link href="/iletisim" className="btn btn-ghost">
          Bize yazın
        </Link>
      </div>
    </section>
  );
}
