import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET || process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || "fallback-secret-key-change-me";
const secretKey = new TextEncoder().encode(JWT_SECRET);
const COOKIE_NAME = "train_auth_token";

// Routes that require authentication
const PROTECTED_ROUTES = ["/admin"];

// Routes that should redirect to admin if already logged in
const AUTH_ROUTES = ["/login"];

async function verifyAuth(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, secretKey);
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the path is a protected route
  const isProtected = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  if (isProtected) {
    const isAuthenticated = await verifyAuth(request);
    if (!isAuthenticated) {
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (isAuthRoute) {
    const isAuthenticated = await verifyAuth(request);
    if (isAuthenticated) {
      const adminUrl = new URL("/admin", request.url);
      return NextResponse.redirect(adminUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/login/:path*"],
};
