import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/get-current-user";
import type { CurrentUser } from "@/features/auth/types";
import { UserMenu } from "@/features/auth/user-menu";

// Rutas protegidas: proxy.ts filtra por presencia de cookie; aquí se valida contra la API.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  let user: CurrentUser | null;
  try {
    user = await getCurrentUser();
  } catch {
    // API caída o lenta (timeout): se responde desde el servidor, sin depender de JS en el cliente.
    return <ServiceUnavailable />;
  }
  if (!user) redirect("/");

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-foreground/10 px-4 py-3">
        <Link href="/paths" className="font-semibold">
          Constellation
        </Link>
        <UserMenu user={user} />
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">{children}</main>
    </div>
  );
}

function ServiceUnavailable() {
  return (
    <section role="alert" className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold">No pudimos cargar esta página</h1>
      <p>El servidor no responde en este momento. Inténtalo de nuevo en unos segundos.</p>
      <Link href="/paths" className="self-start rounded-md border border-current px-4 py-2 text-sm">
        Reintentar
      </Link>
    </section>
  );
}
