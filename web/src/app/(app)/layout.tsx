import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
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
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-(--z-sticky) border-b border-line bg-bg/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-6">
            <BrandMark href="/paths" />
            <nav aria-label="Principal" className="hidden items-center gap-1 text-sm sm:flex">
              <Link href="/paths" className="rounded-md px-2.5 py-1.5 text-ink-muted hover:bg-surface hover:text-ink">
                Mis rutas
              </Link>
              <Link href="/assessment" className="rounded-md px-2.5 py-1.5 text-ink-muted hover:bg-surface hover:text-ink">
                Nueva ruta
              </Link>
            </nav>
          </div>
          <UserMenu user={user} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-10">{children}</main>
    </div>
  );
}

function ServiceUnavailable() {
  return (
    <section role="alert" className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-20">
      <h1 className="text-2xl font-semibold">No pudimos cargar esta página</h1>
      <p className="text-ink-muted">El servidor no responde en este momento. Inténtalo de nuevo en unos segundos.</p>
      <Link href="/paths" className="self-start rounded-md border border-line-strong px-4 py-2 text-sm hover:bg-surface">
        Reintentar
      </Link>
    </section>
  );
}
