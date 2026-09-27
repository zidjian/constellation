import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/get-current-user";
import { ProfileForms } from "@/features/auth/profile-forms";

export const metadata: Metadata = { title: "Mi perfil · Constellation" };

export default async function PerfilPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">Tu cuenta</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {user.discordId ? "Entras con Discord" : "Entras con correo y contraseña"}
        </p>
      </header>
      <ProfileForms user={user} />
    </div>
  );
}
