import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, verifyAdminToken } from "@/lib/admin-auth";

// Gate for the whole /admin area. Running it here (Next 16's `proxy`, formerly
// `middleware`) means an unauthenticated request never reaches the page, so no
// admin content is rendered or streamed before the check happens.
export const config = {
  matcher: ["/admin/:path*"],
};

export default async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const authed = await verifyAdminToken(request.cookies.get(ADMIN_COOKIE)?.value);

  if (pathname === "/admin/login") {
    if (!authed) return NextResponse.next();
    // Already signed in; skip the form.
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  if (authed) return NextResponse.next();

  const login = new URL("/admin/login", request.url);
  login.searchParams.set("next", `${pathname}${search}`);
  const response = NextResponse.redirect(login);
  // A stale/expired token would otherwise keep being sent on every request.
  response.cookies.delete(ADMIN_COOKIE);
  return response;
}
