import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACTING_USER_COOKIE, getSessionSecret, verifySessionValue } from "@/lib/session-token";

// Sends anyone without a valid signed session cookie to /login. API routes do
// their own checks (the HR webhook uses its HMAC signature, health is public).
export function proxy(request: NextRequest) {
  const value = request.cookies.get(ACTING_USER_COOKIE)?.value;
  if (verifySessionValue(value, getSessionSecret())) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!login|api|_next/static|_next/image|favicon\\.ico|favicon\\.svg).*)"]
};
