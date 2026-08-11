import clsx from "clsx";

/**
 * Ürün fotoğrafı yoksa gösterilen "arşiv plakası".
 *
 * Gri kutu yerine, slug'dan türetilen deterministik bir gravür deseni çizer:
 * aynı ürün her zaman aynı plakayı alır, katalog bütünlüğü bozulmaz.
 * Admin panelinden görsel adresi girildiğinde yerini gerçek fotoğrafa bırakır.
 */

const TONES = [
  { base: "#e3d6bd", deep: "#c2ab84", line: "#6d5734" }, // sepya
  { base: "#d9dcd0", deep: "#a8b3a2", line: "#3d5a50" }, // bakır pası
  { base: "#e4d3cb", deep: "#c2a094", line: "#6d2a23" }, // oxblood
  { base: "#d7d9dd", deep: "#a8adb6", line: "#2f3742" }, // kurşun mavi
  { base: "#e8dcc0", deep: "#cbb479", line: "#a87f2e" }, // pirinç
];

function hash(seed: string): number {
  let value = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    value ^= seed.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return Math.abs(value);
}

type MotifProps = {
  kind: number;
  line: string;
  base: string;
  petals: number;
  rings: number;
};

/**
 * Beş bezeme ailesi: rozet, kilim göbeği, guilloş, yivli sütun, kafes.
 * Katalog sayfasında yan yana dizilen plakaların birbirini tekrar etmemesi için.
 */
function Motif({ kind, line, base, petals, rings }: MotifProps) {
  const stroke = { fill: "none", stroke: line, strokeWidth: 0.9, opacity: 0.55 } as const;

  if (kind === 1) {
    // kilim göbeği: iç içe eşkenar dörtgenler + basamaklı köşe kancaları
    return (
      <>
        {Array.from({ length: 5 }).map((_, index) => (
          <rect
            key={index}
            x={-(48 + index * 20)}
            y={-(48 + index * 20)}
            width={(48 + index * 20) * 2}
            height={(48 + index * 20) * 2}
            transform="rotate(45)"
            {...stroke}
            strokeWidth={index === 0 ? 1.4 : 0.7}
            opacity={0.5 - index * 0.06}
          />
        ))}
        {Array.from({ length: 4 }).map((_, index) => (
          <path
            key={index}
            d="M-96 0 L-72 0 L-72 -24 L-52 -24"
            {...stroke}
            transform={`rotate(${index * 90})`}
          />
        ))}
      </>
    );
  }

  if (kind === 2) {
    // guilloş: bir çember üzerinde dizilmiş, birbirine geçen halkalar
    return (
      <>
        {Array.from({ length: 14 }).map((_, index) => (
          <circle key={index} cx="0" cy="-56" r="52" {...stroke} opacity="0.32"
            transform={`rotate(${(360 / 14) * index})`} />
        ))}
        <circle r="112" {...stroke} strokeWidth="1.2" opacity="0.45" />
        <circle r="44" {...stroke} strokeWidth="1" opacity="0.5" />
      </>
    );
  }

  if (kind === 3) {
    // yivli sütun: dikey yivler + üstte kemer, altta kaide bandı
    return (
      <>
        {Array.from({ length: 13 }).map((_, index) => (
          <line
            key={index}
            x1={-96 + index * 16}
            y1="-96"
            x2={-96 + index * 16}
            y2="96"
            {...stroke}
            opacity="0.3"
          />
        ))}
        <path d="M-104 -60 A104 104 0 0 1 104 -60" {...stroke} strokeWidth="1.3" opacity="0.5" />
        <path d="M-104 60 A104 104 0 0 0 104 60" {...stroke} strokeWidth="1.3" opacity="0.5" />
        <rect x="-118" y="-8" width="236" height="16" {...stroke} opacity="0.35" />
      </>
    );
  }

  if (kind === 4) {
    // kafes: 45° eğik ızgara panosu, ortada oval kartuş
    return (
      <>
        <g transform="rotate(45)">
          {Array.from({ length: 9 }).map((_, index) => (
            <g key={index}>
              <line x1={-80 + index * 20} y1="-80" x2={-80 + index * 20} y2="80" {...stroke} opacity="0.28" />
              <line x1="-80" y1={-80 + index * 20} x2="80" y2={-80 + index * 20} {...stroke} opacity="0.28" />
            </g>
          ))}
          <rect x="-80" y="-80" width="160" height="160" {...stroke} strokeWidth="1.3" opacity="0.45" />
        </g>
        <ellipse rx="62" ry="88" fill={base} opacity="0.6" />
        <ellipse rx="62" ry="88" {...stroke} strokeWidth="1.3" opacity="0.5" />
      </>
    );
  }

  // 0 — rozet: yaprak dizisi + halkalar + dış tarama
  return (
    <>
      {Array.from({ length: petals }).map((_, index) => (
        <ellipse
          key={index}
          cx="0"
          cy="-58"
          rx="17"
          ry="52"
          {...stroke}
          transform={`rotate(${(360 / petals) * index})`}
        />
      ))}
      {Array.from({ length: rings }).map((_, index) => (
        <circle
          key={index}
          r={38 + index * 22}
          {...stroke}
          strokeWidth={index === 0 ? 1.4 : 0.6}
          opacity={0.5 - index * 0.08}
        />
      ))}
      {Array.from({ length: 48 }).map((_, index) => (
        <line
          key={index}
          x1="0"
          y1="-118"
          x2="0"
          y2="-128"
          stroke={line}
          strokeWidth="0.7"
          opacity="0.4"
          transform={`rotate(${index * 7.5})`}
        />
      ))}
    </>
  );
}

type Props = {
  seed: string;
  /** Plakanın ortasındaki monogram — genelde ürün adının ilk harfi. */
  monogram?: string;
  className?: string;
};

export function ArchivePlate({ seed, monogram, className }: Props) {
  const h = hash(seed);
  const tone = TONES[h % TONES.length];
  const petals = 8 + (h % 5); // 8–12 yaprak
  const rotation = h % 45;
  const rings = 3 + (h % 3);
  const motif = Math.floor(h / 32) % 5;
  const letter = (monogram ?? seed).charAt(0).toLocaleUpperCase("tr");
  const id = `plate-${h.toString(36)}`;

  return (
    <svg
      viewBox="0 0 400 500"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label="Katalog plakası"
      className={clsx("block h-full w-full", className)}
    >
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={tone.base} />
          <stop offset="55%" stopColor={tone.base} />
          <stop offset="100%" stopColor={tone.deep} />
        </linearGradient>

        <pattern id={`${id}-hatch`} width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M0 6 L6 0" stroke={tone.line} strokeWidth="0.4" opacity="0.35" />
        </pattern>

        <radialGradient id={`${id}-glow`} cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="400" height="500" fill={`url(#${id}-bg)`} />
      <rect width="400" height="500" fill={`url(#${id}-hatch)`} />
      <rect width="400" height="500" fill={`url(#${id}-glow)`} />

      {/* çerçeve: ince–kalın–ince deco üçlüsü */}
      <rect x="18" y="18" width="364" height="464" fill="none" stroke={tone.line} strokeWidth="0.8" opacity="0.6" />
      <rect x="26" y="26" width="348" height="448" fill="none" stroke={tone.line} strokeWidth="2" opacity="0.28" />
      <rect x="32" y="32" width="336" height="436" fill="none" stroke={tone.line} strokeWidth="0.6" opacity="0.5" />

      {/* köşe fleuronları */}
      {[
        [32, 32, 1, 1],
        [368, 32, -1, 1],
        [32, 468, 1, -1],
        [368, 468, -1, -1],
      ].map(([x, y, sx, sy], index) => (
        <g key={index} transform={`translate(${x} ${y}) scale(${sx} ${sy})`} opacity="0.7">
          <path d="M0 22 L0 6 L22 6" fill="none" stroke={tone.line} strokeWidth="1.2" />
          <circle cx="6" cy="12" r="1.8" fill={tone.line} />
        </g>
      ))}

      {/* madalyon — beş motif ailesinden biri, slug'a göre seçilir */}
      {/* Serbest dönüş yalnız radyal simetrik rozette; diğer motifler eksenli durur. */}
      <g transform={`translate(200 232) rotate(${motif === 0 ? rotation : 0})`} opacity="0.85">
        <Motif kind={motif} line={tone.line} base={tone.base} petals={petals} rings={rings} />
        <circle r="30" fill={tone.base} opacity="0.85" />
        <circle r="30" fill="none" stroke={tone.line} strokeWidth="0.8" opacity="0.7" />
      </g>

      <text
        x="200"
        y="232"
        textAnchor="middle"
        dominantBaseline="central"
        fill={tone.line}
        opacity="0.8"
        style={{ fontFamily: "var(--font-display), serif", fontSize: "34px", letterSpacing: "0.04em" }}
      >
        {letter}
      </text>

      {/* alt künye şeridi */}
      <line x1="60" y1="404" x2="340" y2="404" stroke={tone.line} strokeWidth="0.6" opacity="0.5" />
      <text
        x="200"
        y="424"
        textAnchor="middle"
        fill={tone.line}
        opacity="0.65"
        style={{ fontFamily: "var(--font-sans), sans-serif", fontSize: "10px", letterSpacing: "0.34em" }}
      >
        MİRÂS · ARŞİV
      </text>
    </svg>
  );
}

type ImageProps = {
  src: string;
  alt: string;
  seed: string;
  monogram?: string;
  className?: string;
};

/** Görsel adresi varsa fotoğrafı, yoksa plakayı basar. */
export function ProductVisual({ src, alt, seed, monogram, className }: ImageProps) {
  if (!src) return <ArchivePlate seed={seed} monogram={monogram} className={className} />;
  // eslint-disable-next-line @next/next/no-img-element -- görsel adresi admin panelinden serbest girilir
  return <img src={src} alt={alt} className={clsx("h-full w-full object-cover", className)} />;
}
