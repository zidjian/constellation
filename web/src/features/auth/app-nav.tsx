"use client";

import { motion, useReducedMotion } from "motion/react";
import { BookOpen, CircleCheck, Sparkles, Stars, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/paths", label: "Mis rutas", Icon: Stars },
  { href: "/cursos", label: "Catálogo", Icon: BookOpen },
  { href: "/completados", label: "Terminados", Icon: CircleCheck, soloEscritorio: true },
  { href: "/assessment", label: "Nueva ruta", Icon: Sparkles, soloEscritorio: true },
  { href: "/perfil", label: "Perfil", Icon: User },
];

/**
 * La sección activa se marca con una línea que se desplaza entre pestañas (`layoutId`), no con un
 * borde que aparece y desaparece: el movimiento dice de dónde vienes.
 */
export function AppNav() {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  return (
    <nav aria-label="Principal" className="flex min-w-0 items-center gap-0.5 text-[0.8125rem] sm:text-sm">
      {ITEMS.map(({ href, label, Icon, soloEscritorio }) => {
        const activo = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={activo ? "page" : undefined}
            className={
              "relative flex items-center gap-1.5 rounded-md px-1.5 py-1.5 whitespace-nowrap transition-colors duration-150 sm:px-2.5 " +
              (activo ? "text-ink" : "text-ink-muted hover:bg-surface hover:text-ink ") +
              (soloEscritorio ? "hidden sm:flex" : "")
            }
          >
            <Icon aria-hidden size={16} strokeWidth={1.75} className="shrink-0" />
            {label}
            {activo && (
              <motion.span
                aria-hidden
                layoutId="nav-activo"
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
                className="absolute inset-x-1.5 -bottom-[11px] h-px bg-accent sm:inset-x-2.5"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
