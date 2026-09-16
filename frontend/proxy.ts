/*
 * Runs before every matched request:
 *
 *  1. /api/* is forwarded to the backend at request time (BACKEND_INTERNAL_URL),
 *     so the browser stays same-origin and never learns where the API lives.
 *  2. Optimistic routing: signed-out visitors are sent to /login, signed-in
 *     ones skip the sign-in pages. This reads only a hint cookie that carries no
 *     secret; the backend authorises every API call on its own.
 */
import { NextResponse, type NextRequest } from "next/server";

const SESSION_HINT = "mmry_session";
const PROTECTED = ["/dashboard", "/analytics", "/profile", "/settings"];
const AUTH_PAGES = ["/login", "/register"];

const startsWithAny = (path: string, prefixes: string[]) =>
  prefixes.some((p) => path === p || path.startsWith(`${p}/`));

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/api/")) {
    const backend = process.env.BACKEND_INTERNAL_URL ?? "http://127.0.0.1:4000";
    return NextResponse.rewrite(new URL(`${pathname}${search}`, backend));
  }

  const signedIn = request.cookies.get(SESSION_HINT)?.value === "1";

  if (!signedIn && startsWithAny(pathname, PROTECTED)) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  if (signedIn && startsWithAny(pathname, AUTH_PAGES)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/dashboard/:path*", "/analytics/:path*", "/profile/:path*", "/settings/:path*", "/login", "/register"],
};
