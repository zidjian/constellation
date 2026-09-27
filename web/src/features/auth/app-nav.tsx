"use client";

import { motion, useReducedMotion } from "motion/react";
import { BookOpen, CircleCheck, Sparkles, Stars, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/paths", label: "Mis rutas", corto: "Rutas", Icon: Stars },
  { href: "/cursos", label: "Catálogo", corto: "Catálogo", Icon: BookOpen },
  { href: "/completados", label: "Terminados", corto: "Hechos", Icon: CircleCheck },
  { href: "/assessment", label: "Nueva ruta", corto: "Nueva", Icon: Sparkles },
  { href: "/perfil", label: "Perfil", corto: "Perfil", Icon: User },
];

const esActiva = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

/**
 * Barra superior en escritorio. La sección activa se marca con una línea que se desplaza entre
 * pestañas (`layoutId`), no con un borde que aparece y desaparece: el movimiento dice de dónde vienes.
 */
export function AppNav() {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  return (
    <nav aria-label="Principal" className="hidden items-center gap-0.5 text-sm sm:flex">
      {ITEMS.map(({ href, label, Icon }) => {
        const activa = esActiva(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={activa ? "page" : undefined}
            className={
              "relative flex items-center gap-1.5 rounded-md px-2.5 py-1.5 whitespace-nowrap transition-colors duration-150 " +
              (activa ? "text-ink" : "text-ink-muted hover:bg-surface hover:text-ink")
            }
          >
            <Icon aria-hidden size={16} strokeWidth={1.75} className="shrink-0" />
            {label}
            {activa && (
              <motion.span
                aria-hidden
                layoutId="nav-activa-superior"
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
                className="absolute inset-x-2.5 -bottom-[11px] h-px bg-accent"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * En móvil la navegación baja al pulgar: cinco destinos no caben en la cabecera junto a la marca y
 * la sesión. Barra fija abajo, con icono y etiqueta corta, y respeto del área segura del iPhone.
 */
export function AppNavMobile() {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-(--z-sticky) border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm sm:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-1">
        {ITEMS.map(({ href, corto, label, Icon }) => {
          const activa = esActiva(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={activa ? "page" : undefined}
                aria-label={label}
                className={
                  "relative flex flex-col items-center gap-1 px-1 pt-2.5 pb-2 text-[0.6875rem] transition-colors duration-150 " +
                  (activa ? "text-ink" : "text-ink-muted")
                }
              >
                {activa && (
                  <motion.span
                    aria-hidden
                    layoutId="nav-activa-inferior"
                    transition={
                      reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }
                    }
                    className="absolute inset-x-3 top-0 h-px bg-accent"
                  />
                )}
                <Icon aria-hidden size={19} strokeWidth={activa ? 2 : 1.6} />
                {corto}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
