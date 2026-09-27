import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell, DiscordButton, RegisterForm } from "@/features/auth/auth-forms";
import { getCurrentUser } from "@/features/auth/get-current-user";

export const metadata: Metadata = { title: "Crear cuenta · Constellation" };
export const dynamic = "force-dynamic";

export default async function RegistroPage() {
  if (await getCurrentUser().catch(() => null)) redirect("/paths");
  return (
    <AuthShell
      title="Crea tu cuenta"
      intro="Te lleva un minuto. Después vienen la entrevista y tu primera constelación."
      footer={
        <>
          ¿Ya tienes cuenta?{" "}
          <Link href="/entrar" className="text-accent underline-offset-4 hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <RegisterForm />
      <div className="flex items-center gap-3 text-xs text-ink-muted">
        <span className="h-px flex-1 bg-line" />o<span className="h-px flex-1 bg-line" />
      </div>
      <DiscordButton>Crear cuenta con Discord</DiscordButton>
    </AuthShell>
  );
}
