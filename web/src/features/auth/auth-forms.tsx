"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { Button, buttonClass } from "@/components/ui/button";
import { ApiError, apiUrl } from "@/lib/api";
import { forgotPassword, login, PASSWORD_MIN, register, resetPassword } from "./email-auth";

/** Marco común de las cuatro pantallas de cuenta: una columna estrecha y nada más. */
export function AuthShell({
  title,
  intro,
  children,
  footer,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-8 px-4 py-10">
      <BrandMark />
      <main className="flex flex-1 flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
          {intro && <p className="mt-2 leading-relaxed text-ink-muted">{intro}</p>}
        </div>
        {children}
      </main>
      {footer && <footer className="text-sm text-ink-muted">{footer}</footer>}
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  ...rest
}: { id: string; label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        {...rest}
        className="h-11 rounded-md border border-line-strong bg-surface px-3 placeholder:text-ink-muted focus:border-accent focus:outline-none focus-visible:outline-2 focus-visible:outline-accent"
      />
      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">
      {children}
    </p>
  );
}

const message = (err: unknown) =>
  err instanceof ApiError ? err.message : "Algo falló. Revisa tu conexión e inténtalo de nuevo.";

/** El login con Discord sigue siendo una navegación completa: el OAuth lo resuelve la API. */
export function DiscordButton({ children = "Entrar con Discord" }: { children?: ReactNode }) {
  return (
    <a href={apiUrl("/auth/discord")} className={buttonClass("secondary", "lg", "w-full")}>
      {children}
    </a>
  );
}

export function LoginForm() {
  const router = useRouter();
  const emailId = useId();
  const passId = useId();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setBusy(true);
        setError(null);
        try {
          await login({
            email: String(form.get("email")),
            password: String(form.get("password")),
          });
          router.replace("/paths");
          router.refresh();
        } catch (err) {
          setError(message(err));
          setBusy(false);
        }
      }}
    >
      <Field id={emailId} name="email" type="email" label="Correo" autoComplete="email" required />
      <Field id={passId} name="password" type="password" label="Contraseña" autoComplete="current-password" required />
      {error && <ErrorText>{error}</ErrorText>}
      <Button type="submit" size="lg" variant="accent" loading={busy}>
        Entrar
      </Button>
      <Link href="/recuperar" className="text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline">
        ¿Olvidaste tu contraseña?
      </Link>
    </form>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const emailId = useId();
  const passId = useId();
  const nameId = useId();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setBusy(true);
        setError(null);
        try {
          await register({
            email: String(form.get("email")),
            password: String(form.get("password")),
            username: String(form.get("username") || "") || undefined,
          });
          router.replace("/assessment");
          router.refresh();
        } catch (err) {
          setError(message(err));
          setBusy(false);
        }
      }}
    >
      <Field id={emailId} name="email" type="email" label="Correo" autoComplete="email" required />
      <Field
        id={nameId}
        name="username"
        type="text"
        label="Cómo quieres que te llamemos"
        hint="Opcional: si lo dejas vacío, usamos la parte de tu correo."
        autoComplete="nickname"
        maxLength={100}
      />
      <Field
        id={passId}
        name="password"
        type="password"
        label="Contraseña"
        hint={`Mínimo ${PASSWORD_MIN} caracteres, con letras y números.`}
        autoComplete="new-password"
        minLength={PASSWORD_MIN}
        required
      />
      {error && <ErrorText>{error}</ErrorText>}
      <Button type="submit" size="lg" variant="accent" loading={busy}>
        Crear cuenta
      </Button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const emailId = useId();
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (sent) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="rounded-lg border border-line bg-surface px-4 py-3 leading-relaxed">
          {sent}
        </p>
        <p className="text-sm text-ink-muted">
          Revisa también la carpeta de spam. El enlace caduca en 1 hora y solo sirve una vez.
        </p>
        <Link href="/entrar" className={buttonClass("secondary", "md", "self-start")}>
          Volver a entrar
        </Link>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setBusy(true);
        setError(null);
        try {
          const r = await forgotPassword(String(form.get("email")));
          setSent(r.message);
        } catch (err) {
          setError(message(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field id={emailId} name="email" type="email" label="Correo" autoComplete="email" required />
      {error && <ErrorText>{error}</ErrorText>}
      <Button type="submit" size="lg" variant="accent" loading={busy}>
        Enviarme el enlace
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const passId = useId();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!token) {
    return (
      <div className="flex flex-col gap-4">
        <ErrorText>Este enlace no trae el código de recuperación. Pide uno nuevo.</ErrorText>
        <Link href="/recuperar" className={buttonClass("accent", "md", "self-start")}>
          Pedir otro enlace
        </Link>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setBusy(true);
        setError(null);
        try {
          await resetPassword({ token, password: String(form.get("password")) });
          // El restablecer ya deja la sesión abierta: no tiene sentido pedir que entre otra vez.
          router.replace("/paths");
          router.refresh();
        } catch (err) {
          setError(message(err));
          setBusy(false);
        }
      }}
    >
      <Field
        id={passId}
        name="password"
        type="password"
        label="Contraseña nueva"
        hint={`Mínimo ${PASSWORD_MIN} caracteres, con letras y números.`}
        autoComplete="new-password"
        minLength={PASSWORD_MIN}
        required
      />
      {error && (
        <div className="flex flex-col gap-2">
          <ErrorText>{error}</ErrorText>
          <Link href="/recuperar" className="text-sm text-accent underline-offset-4 hover:underline">
            Pedir otro enlace
          </Link>
        </div>
      )}
      <Button type="submit" size="lg" variant="accent" loading={busy}>
        Guardar y entrar
      </Button>
    </form>
  );
}
