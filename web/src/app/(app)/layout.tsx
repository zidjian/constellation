import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/get-current-user";
import { UserMenu } from "@/features/auth/user-menu";

// Rutas protegidas: proxy.ts filtra por presencia de cookie; aquí se valida contra la API.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
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
