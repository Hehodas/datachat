import { NextResponse, type NextRequest } from "next/server";
import {
  isAuthorized,
  unauthorizedResponse,
} from "@/lib/access";

export function middleware(request: NextRequest) {
  if (!isAuthorized(request)) {
    return unauthorizedResponse("text");
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
