import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken, getCookieName } from "@/lib/auth/session";

const publicPaths = ["/login"];
const authApiPaths = ["/api/auth/login", "/api/auth/logout"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isStatic = pathname.startsWith("/_next") || pathname === "/favicon.ico";
  if (isStatic) return NextResponse.next();

  const isPublic = publicPaths.some((p) => pathname === p);
  const isAuthApi = authApiPaths.some((p) => pathname.startsWith(p));
  const isMeApi = pathname === "/api/auth/me";

  const cookieName = getCookieName();
  const token = request.cookies.get(cookieName)?.value;
  const session = token ? await verifyToken(token) : null;

  // API /me — pass through (will check cookie server-side)
  if (isMeApi) return NextResponse.next();

  // Auth API — allow always
  if (isAuthApi) return NextResponse.next();

  // Already logged in, trying to access login page → redirect to dashboard
  if (session && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Not logged in, trying to access protected page → redirect to login
  if (!session && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
