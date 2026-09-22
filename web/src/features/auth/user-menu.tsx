"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import type { CurrentUser } from "./types";

export function UserMenu({ user }: { user: CurrentUser }) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState(false);

  async function logout() {
    setLeaving(true);
    setError(false);
    try {
      await apiFetch("/auth/logout", { method: "POST" });
      router.replace("/");
      router.refresh();
    } catch {
      // Si la API no responde, la cookie sigue viva: no se finge un logout.
      setError(true);
      setLeaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2.5">
      {user.avatarUrl ? (
        <Image src={user.avatarUrl} alt="" width={28} height={28} className="rounded-full" />
      ) : (
        <span aria-hidden className="grid size-7 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
          {user.username.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="hidden max-w-40 truncate text-sm sm:inline">{user.username}</span>
      <Button variant="ghost" size="sm" onClick={logout} loading={leaving}>
        {leaving ? "Saliendo…" : "Salir"}
      </Button>
      {error && (
        <span role="alert" className="text-sm text-danger">
          No se pudo cerrar sesión. Reintenta.
        </span>
      )}
    </div>
  );
}
