"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
    <div className="flex items-center gap-3">
      {user.avatarUrl ? (
        <Image src={user.avatarUrl} alt="" width={32} height={32} className="rounded-full" />
      ) : (
        <span
          aria-hidden
          className="grid size-8 place-items-center rounded-full bg-foreground/10 text-sm font-medium"
        >
          {user.username.slice(0, 1).toUpperCase()}
        </span>
      )}
      <span className="text-sm">{user.username}</span>
      <button
        type="button"
        onClick={logout}
        disabled={leaving}
        className="rounded-md px-2 py-1 text-sm underline-offset-4 hover:underline disabled:opacity-50"
      >
        {leaving ? "Saliendo…" : "Salir"}
      </button>
      {error && (
        <span role="alert" className="text-sm text-red-500">
          No se pudo cerrar sesión. Reintenta.
        </span>
      )}
    </div>
  );
}
