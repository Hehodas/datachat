import { NextResponse, type NextRequest } from "next/server";
import {
  consumeRateLimit,
  getClientIp,
  isAuthorized,
  tooManyRequestsResponse,
  unauthorizedResponse,
} from "@/lib/access";

export function middleware(request: NextRequest) {
  if (!isAuthorized(request)) {
    return unauthorizedResponse("text");
  }

  if (
    request.method === "POST" &&
    request.nextUrl.pathname.startsWith("/api/") &&
    !consumeRateLimit(getClientIp(request))
  ) {
    return tooManyRequestsResponse("text");
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
