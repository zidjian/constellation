import { NextResponse, type NextRequest } from "next/server";

// Next 16: proxy.ts reemplaza a middleware.ts. Solo comprueba la presencia de la cookie;
// la validez la decide la API (el layout protegido llama a /v1/me).
const SESSION_COOKIE = "cst_session";

export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    // A /entrar, no a la landing: quien viene de un enlace suyo quiere volver a lo que pedía.
    return NextResponse.redirect(new URL("/entrar", request.url));
  }
  return NextResponse.next();
}

// `/perfil/confirmar-correo` queda fuera a propósito: el enlace llega al correo nuevo y se abre
// donde no hay sesión. El token es la prueba, no la cookie.
export const config = {
  matcher: ["/assessment/:path*", "/paths/:path*", "/perfil"],
};
