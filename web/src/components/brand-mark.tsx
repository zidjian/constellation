import Link from "next/link";

// Marca: tres puntos unidos, el tercero encendido. Es la idea del producto en miniatura.
export function BrandMark({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2.5 rounded-sm font-semibold tracking-tight">
      <svg aria-hidden width="30" height="20" viewBox="0 0 30 20">
        <path d="M4 15 L14 5 L26 11" fill="none" stroke="var(--color-accent)" strokeWidth="1.75" strokeLinecap="round" />
        <circle cx="4" cy="15" r="3" fill="var(--color-accent)" />
        <circle cx="14" cy="5" r="3" fill="var(--color-accent)" />
        <circle
          cx="26"
          cy="11"
          r="3.5"
          fill="var(--color-primary)"
          stroke="var(--color-primary-strong)"
          className="origin-[26px_11px] transition-transform duration-200 ease-out-quint group-hover:scale-125"
        />
      </svg>
      <span>
        Constellation<span className="sr-only"> · DevTalles</span>
      </span>
    </Link>
  );
}
