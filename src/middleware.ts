import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Cheap, edge-safe check: is there a session cookie at all?
// This only decides whether to bounce the request to /signin before
// it even reaches a page. The REAL verification (is the session valid,
// not expired, user still active) happens server-side via
// getCurrentUser() in layout.tsx / route handlers — middleware never
// touches the database.
const PUBLIC_PATHS = ["/signin", "/signup", "/api/auth/login", "/api/auth/register"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic =
    PUBLIC_PATHS.some((p) => pathname === p) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.includes(".");

  const hasSessionCookie = !!request.cookies.get("auth_session")?.value;

  if (!isPublic && !hasSessionCookie) {
    const signinUrl = new URL("/signin", request.url);
    signinUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(signinUrl);
  }

  // Already signed in and hitting /signin or /signup? send them onward.
  if ((pathname === "/signin" || pathname === "/signup") && hasSessionCookie) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
