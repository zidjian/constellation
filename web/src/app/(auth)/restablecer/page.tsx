import type { Metadata } from "next";
import { AuthShell, ResetPasswordForm } from "@/features/auth/auth-forms";

export const metadata: Metadata = { title: "Nueva contraseña · Constellation" };
export const dynamic = "force-dynamic";

export default async function RestablecerPage({ searchParams }: PageProps<"/restablecer">) {
  const { token } = await searchParams;
  return (
    <AuthShell title="Elige una contraseña nueva" intro="Al guardarla entras directo a tus rutas.">
      <ResetPasswordForm token={typeof token === "string" ? token : ""} />
    </AuthShell>
  );
}
