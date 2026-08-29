const WWW_AUTHENTICATE = 'Basic realm="DataChat"';

export const RATE_LIMIT_MAX = 20;
export const RATE_LIMIT_WINDOW_MS = 60_000;

type RateBucket = {
  count: number;
  resetAt: number;
};

const rateBuckets = new Map<string, RateBucket>();

function timingSafeEqualUtf8(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const maxLen = Math.max(a.length, b.length);
  let mismatch = a.length === b.length ? 0 : 1;

  for (let i = 0; i < maxLen; i++) {
    mismatch |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }

  return mismatch === 0;
}

function decodeBasicCredentials(
  authorization: string | null,
): { user: string; password: string } | null {
  if (!authorization) {
    return null;
  }

  const space = authorization.indexOf(" ");
  if (space === -1) {
    return null;
  }

  const scheme = authorization.slice(0, space);
  const encoded = authorization.slice(space + 1).trim();
  if (scheme !== "Basic" || !encoded) {
    return null;
  }

  try {
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    const colon = decoded.indexOf(":");
    if (colon === -1) {
      return null;
    }
    return {
      user: decoded.slice(0, colon),
      password: decoded.slice(colon + 1),
    };
  } catch {
    return null;
  }
}

let missingCredentialsLogged = false;

function expectedCredentials(): { user: string; password: string } | null {
  const user = process.env.CHAT_BASIC_USER;
  const password = process.env.CHAT_BASIC_PASSWORD;
  if (!user || !password) {
    if (!missingCredentialsLogged) {
      missingCredentialsLogged = true;
      console.error(
        "CHAT_BASIC_USER or CHAT_BASIC_PASSWORD is not set; denying all requests",
      );
    }
    return null;
  }
  return { user, password };
}

export function isAuthorized(request: Request): boolean {
  const expected = expectedCredentials();
  if (!expected) {
    return false;
  }

  const parsed = decodeBasicCredentials(request.headers.get("authorization"));
  if (!parsed) {
    return false;
  }

  const userOk = timingSafeEqualUtf8(parsed.user, expected.user);
  const passwordOk = timingSafeEqualUtf8(parsed.password, expected.password);
  return userOk && passwordOk;
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first.slice(0, 128);
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp.slice(0, 128);
  }

  return "unknown";
}

export function consumeRateLimit(ip: string, now = Date.now()): boolean {
  if (rateBuckets.size > 10_000) {
    for (const [key, bucket] of rateBuckets) {
      if (now >= bucket.resetAt) {
        rateBuckets.delete(key);
      }
    }
  }

  const bucket = rateBuckets.get(ip);
  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (bucket.count >= RATE_LIMIT_MAX) {
    return false;
  }

  bucket.count += 1;
  return true;
}

export function resetRateLimiter(): void {
  rateBuckets.clear();
}

export function unauthorizedResponse(format: "json" | "text" = "text"): Response {
  const headers = { "WWW-Authenticate": WWW_AUTHENTICATE };
  if (format === "json") {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  }
  return new Response("Unauthorized", { status: 401, headers });
}

export function tooManyRequestsResponse(format: "json" | "text" = "text"): Response {
  if (format === "json") {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }
  return new Response("Too many requests", { status: 429 });
}

export function enforceChatAccess(request: Request): Response | null {
  if (!isAuthorized(request)) {
    return unauthorizedResponse("json");
  }

  if (!consumeRateLimit(getClientIp(request))) {
    return tooManyRequestsResponse("json");
  }

  return null;
}
