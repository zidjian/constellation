"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import {
  changeMyEmail,
  changeMyPassword,
  confirmMyEmail,
  deleteMyAccount,
  PASSWORD_MIN,
  renameMe,
} from "./email-auth";
import type { CurrentUser } from "./types";

const message = (err: unknown) =>
  err instanceof ApiError ? err.message : "Algo falló. Revisa tu conexión e inténtalo de nuevo.";

/** Cada bloque del perfil es una sección con su propio estado: uno falla y los demás siguen. */
function Section({
  title,
  description,
  children,
  danger = false,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <section
      className={`flex flex-col gap-4 rounded-xl border px-5 py-5 ${
        danger ? "border-danger/40 bg-danger-soft/20" : "border-line bg-surface/40"
      }`}
    >
      <div>
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm leading-relaxed text-ink-muted">{description}</p>}
      </div>
      {children}
    </section>
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

function Feedback({ error, ok }: { error: string | null; ok: string | null }) {
  if (error)
    return (
      <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">
        {error}
      </p>
    );
  if (ok)
    return (
      <p role="status" className="rounded-md bg-surface-2 px-4 py-3 text-sm">
        {ok}
      </p>
    );
  return null;
}

/** Estado común de los formularios del perfil: ocupado, error y confirmación. */
function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const run = async (fn: () => Promise<string>) => {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      setOk(await fn());
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, ok, run };
}

export function ProfileForms({ user }: { user: CurrentUser }) {
  const conPassword = Boolean(user.email);
  return (
    <div className="flex flex-col gap-5">
      <NameSection user={user} />
      <EmailSection user={user} requierePassword={conPassword} />
      <PasswordSection tienePassword={conPassword} sinCorreo={!user.email} />
      <DeleteSection requierePassword={conPassword} />
    </div>
  );
}

function NameSection({ user }: { user: CurrentUser }) {
  const router = useRouter();
  const id = useId();
  const { busy, error, ok, run } = useSubmit();
  const [name, setName] = useState(user.username);

  return (
    <Section title="Nombre" description="Es como te llamamos en la app.">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const actualizado = await renameMe(name);
            router.refresh();
            return `Ahora te llamamos ${actualizado.username}.`;
          });
        }}
      >
        <Field
          id={id}
          label="Cómo quieres que te llamemos"
          value={name}
          minLength={2}
          maxLength={100}
          required
          onChange={(e) => setName(e.target.value)}
        />
        <Feedback error={error} ok={ok} />
        <Button type="submit" variant="accent" loading={busy} disabled={name.trim() === user.username}>
          Guardar nombre
        </Button>
      </form>
    </Section>
  );
}

function EmailSection({ user, requierePassword }: { user: CurrentUser; requierePassword: boolean }) {
  const emailId = useId();
  const passId = useId();
  const { busy, error, ok, run } = useSubmit();

  return (
    <Section
      title={user.email ? "Correo" : "Añadir correo"}
      description={
        user.email ? (
          <>
            Ahora usas <strong className="font-medium text-ink">{user.email}</strong>. El correo nuevo
            no entra hasta que lo confirmes desde él.
          </>
        ) : (
          "Entraste con Discord. Si añades un correo, podrás entrar también con contraseña."
        )
      }
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          void run(async () => {
            const r = await changeMyEmail({
              email: String(form.get("email")),
              password: String(form.get("password") || "") || undefined,
            });
            return r.message;
          });
        }}
      >
        <Field id={emailId} name="email" type="email" label="Correo nuevo" autoComplete="email" required />
        {requierePassword && (
          <Field
            id={passId}
            name="password"
            type="password"
            label="Confirma con tu contraseña"
            autoComplete="current-password"
            required
          />
        )}
        <Feedback error={error} ok={ok} />
        <Button type="submit" variant="accent" loading={busy}>
          {user.email ? "Cambiar correo" : "Añadir correo"}
        </Button>
      </form>
    </Section>
  );
}

function PasswordSection({
  tienePassword,
  sinCorreo,
}: {
  tienePassword: boolean;
  sinCorreo: boolean;
}) {
  const actualId = useId();
  const nuevaId = useId();
  const { busy, error, ok, run } = useSubmit();

  if (sinCorreo) {
    return (
      <Section
        title="Contraseña"
        description="Añade y confirma un correo arriba y después podrás poner una contraseña."
      >
        <p className="text-sm text-ink-muted">De momento entras solo con Discord.</p>
      </Section>
    );
  }

  return (
    <Section
      title="Contraseña"
      description={
        tienePassword
          ? "Al cambiarla, cualquier enlace de recuperación pendiente deja de servir."
          : "Ponle una contraseña a tu cuenta para entrar también sin Discord."
      }
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const formEl = e.currentTarget;
          void run(async () => {
            await changeMyPassword({
              currentPassword: String(form.get("currentPassword") || "") || undefined,
              newPassword: String(form.get("newPassword")),
            });
            formEl.reset();
            return "Contraseña actualizada.";
          });
        }}
      >
        {tienePassword && (
          <Field
            id={actualId}
            name="currentPassword"
            type="password"
            label="Contraseña actual"
            autoComplete="current-password"
            required
          />
        )}
        <Field
          id={nuevaId}
          name="newPassword"
          type="password"
          label="Contraseña nueva"
          hint={`Mínimo ${PASSWORD_MIN} caracteres, con letras y números.`}
          autoComplete="new-password"
          minLength={PASSWORD_MIN}
          required
        />
        <Feedback error={error} ok={ok} />
        <Button type="submit" variant="accent" loading={busy}>
          {tienePassword ? "Cambiar contraseña" : "Poner contraseña"}
        </Button>
      </form>
    </Section>
  );
}

function DeleteSection({ requierePassword }: { requierePassword: boolean }) {
  const router = useRouter();
  const campoId = useId();
  const { busy, error, run } = useSubmit();
  const [abierto, setAbierto] = useState(false);

  return (
    <Section
      title="Eliminar mi cuenta"
      danger
      description="Se borran tus rutas, tu progreso y tus entrevistas. No se puede deshacer."
    >
      {!abierto ? (
        <Button variant="danger" className="self-start" onClick={() => setAbierto(true)}>
          Quiero eliminar mi cuenta
        </Button>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            void run(async () => {
              await deleteMyAccount(
                requierePassword
                  ? { password: String(form.get("password")) }
                  : { confirm: String(form.get("confirm")) },
              );
              router.replace("/");
              router.refresh();
              return "Cuenta eliminada.";
            });
          }}
        >
          {requierePassword ? (
            <Field
              id={campoId}
              name="password"
              type="password"
              label="Confirma con tu contraseña"
              autoComplete="current-password"
              required
            />
          ) : (
            <Field
              id={campoId}
              name="confirm"
              type="text"
              label="Escribe ELIMINAR para confirmar"
              autoComplete="off"
              required
            />
          )}
          <Feedback error={error} ok={null} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="danger" loading={busy}>
              Eliminar definitivamente
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </Section>
  );
}

/** Pantalla a la que lleva el enlace del correo. Puede abrirse sin sesión: el token es la prueba. */
export function ConfirmEmailView({ token }: { token: string }) {
  const router = useRouter();
  const [estado, setEstado] = useState<"idle" | "ok" | "error">("idle");
  const [texto, setTexto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!token) {
    return (
      <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">
        Este enlace no trae el código de confirmación. Pide otro desde tu perfil.
      </p>
    );
  }

  if (estado === "ok") {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="rounded-lg border border-line bg-surface px-4 py-3">
          {texto}
        </p>
        <Button variant="accent" className="self-start" onClick={() => router.push("/perfil")}>
          Ir a mi perfil
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {estado === "error" && (
        <p role="alert" className="rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">
          {texto}
        </p>
      )}
      <Button
        variant="accent"
        className="self-start"
        loading={busy}
        onClick={() => {
          setBusy(true);
          void confirmMyEmail(token)
            .then((r) => {
              setEstado("ok");
              setTexto(`Listo: tu cuenta ya usa ${r.email}.`);
            })
            .catch((err: unknown) => {
              setEstado("error");
              setTexto(message(err));
            })
            .finally(() => setBusy(false));
        }}
      >
        Confirmar mi correo
      </Button>
    </div>
  );
}
