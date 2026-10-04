// First line of defence for protected pages: no valid session cookie -> redirect to /login.
// This is only a convenience. Every protected page and API route ALSO checks the session on
// the server (getCurrentUser), so this file is never the only protection.
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSessionToken } from "@/lib/auth/session";

export async function proxy(request: NextRequest) {
  const userId = await readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

// Add new protected sections here (courses, activities, etc. in later milestones).
export const config = {
  matcher: ["/dashboard/:path*", "/courses/:path*", "/activities/:path*", "/notifications/:path*", "/settings/:path*"],
};
