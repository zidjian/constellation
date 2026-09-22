import { NextResponse, type NextRequest } from "next/server";

// Next 16: proxy.ts reemplaza a middleware.ts. Solo comprueba la presencia de la cookie;
// la validez la decide la API (el layout protegido llama a /v1/me).
const SESSION_COOKIE = "cst_session";

export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/assessment/:path*", "/paths/:path*"],
};
