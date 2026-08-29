import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  consumeRateLimit,
  isAuthorized,
  RATE_LIMIT_MAX,
  resetRateLimiter,
} from "../access";

function authRequest(user: string, password: string): Request {
  const encoded = Buffer.from(`${user}:${password}`).toString("base64");
  return new Request("http://localhost/api/chat", {
    headers: { Authorization: `Basic ${encoded}` },
  });
}

describe("access", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resetRateLimiter();
    vi.stubEnv("CHAT_BASIC_USER", "testuser");
    vi.stubEnv("CHAT_BASIC_PASSWORD", "testpass");
  });

  it("accepts valid Basic credentials", () => {
    expect(isAuthorized(authRequest("testuser", "testpass"))).toBe(true);
  });

  it("rejects wrong password", () => {
    expect(isAuthorized(authRequest("testuser", "wrong"))).toBe(false);
  });

  it("rejects missing Authorization header", () => {
    expect(isAuthorized(new Request("http://localhost/api/chat"))).toBe(false);
  });

  it("fails closed when credentials are missing from env", () => {
    vi.unstubAllEnvs();
    delete process.env.CHAT_BASIC_USER;
    delete process.env.CHAT_BASIC_PASSWORD;
    expect(isAuthorized(authRequest("testuser", "testpass"))).toBe(false);
  });

  it("returns 429 after rate limit exceeded", () => {
    const ip = "127.0.0.1";
    for (let i = 0; i < RATE_LIMIT_MAX; i += 1) {
      expect(consumeRateLimit(ip)).toBe(true);
    }
    expect(consumeRateLimit(ip)).toBe(false);
  });
});
