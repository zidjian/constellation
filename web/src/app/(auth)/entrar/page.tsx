import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell, DiscordButton, LoginForm } from "@/features/auth/auth-forms";
import { getCurrentUser } from "@/features/auth/get-current-user";

export const metadata: Metadata = { title: "Entrar · Constellation" };
export const dynamic = "force-dynamic";

export default async function EntrarPage() {
  if (await getCurrentUser().catch(() => null)) redirect("/paths");
  return (
    <AuthShell
      title="Entra a tu cielo"
      intro="Con tu correo o con Discord: la ruta que traces queda guardada igual."
      footer={
        <>
          ¿Aún no tienes cuenta?{" "}
          <Link href="/registro" className="text-accent underline-offset-4 hover:underline">
            Créala en un minuto
          </Link>
        </>
      }
    >
      <LoginForm />
      <div className="flex items-center gap-3 text-xs text-ink-muted">
        <span className="h-px flex-1 bg-line" />o<span className="h-px flex-1 bg-line" />
      </div>
      <DiscordButton />
    </AuthShell>
  );
}
