"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/**
 * Entrada escalonada para listas que ya vienen renderizadas del servidor: el contenido es visible
 * aunque no anime (la animación realza, no revela). Con `prefers-reduced-motion` no se mueve nada.
 */
export function Reveal({
  as = "div",
  index = 0,
  className,
  children,
}: {
  as?: "div" | "li" | "section";
  index?: number;
  className?: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const Componente = motion[as];
  return (
    <Componente
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index, 8) * 0.04, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </Componente>
  );
}
