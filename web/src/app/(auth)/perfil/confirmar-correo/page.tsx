import type { Metadata } from "next";
import { AuthShell } from "@/features/auth/auth-forms";
import { ConfirmEmailView } from "@/features/auth/profile-forms";

export const metadata: Metadata = { title: "Confirmar correo · Constellation" };
export const dynamic = "force-dynamic";

export default async function ConfirmarCorreoPage({
  searchParams,
}: PageProps<"/perfil/confirmar-correo">) {
  const { token } = await searchParams;
  return (
    <AuthShell
      title="Confirma tu correo"
      intro="Con esto tu cuenta pasa a usar esta dirección para entrar y para recuperarla."
    >
      <ConfirmEmailView token={typeof token === "string" ? token : ""} />
    </AuthShell>
  );
}
