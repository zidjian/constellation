"use client";

// Error inesperado en una página (boundary de cliente). Los fallos de la API en las rutas
// protegidas los resuelve el layout de (app) desde el servidor.
// Un 401 no llega aquí: ese layout redirige a /.
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <section role="alert" className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold">No pudimos cargar esta página</h1>
      <p>El servidor no responde en este momento. Inténtalo de nuevo en unos segundos.</p>
      <button
        type="button"
        onClick={reset}
        className="self-start rounded-md border border-current px-4 py-2 text-sm"
      >
        Reintentar
      </button>
    </section>
  );
}
