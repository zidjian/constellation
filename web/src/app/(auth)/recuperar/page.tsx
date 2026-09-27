import type { Metadata } from "next";
import { AuthShell, ForgotPasswordForm } from "@/features/auth/auth-forms";

export const metadata: Metadata = { title: "Recuperar contraseña · Constellation" };

export default function RecuperarPage() {
  return (
    <AuthShell
      title="Recupera tu contraseña"
      intro="Escribe tu correo y te mandamos un enlace para elegir una nueva."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
