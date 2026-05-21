import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { validateRequestOrigin } from "@/lib/auth/csrf";

describe("validateRequestOrigin", () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://gitbookai.example";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("accepts requests with the correct site origin", () => {
    const request = new Request("https://gitbookai.example/api/auth/login", {
      headers: { origin: "https://gitbookai.example" },
      method: "POST",
    });

    expect(validateRequestOrigin(request)).toBe(true);
  });

  it("rejects requests with a mismatched origin", () => {
    const request = new Request("https://gitbookai.example/api/auth/login", {
      headers: { origin: "https://evil.example" },
      method: "POST",
    });

    expect(validateRequestOrigin(request)).toBe(false);
  });

  it("rejects requests without an origin header", () => {
    const request = new Request("https://gitbookai.example/api/auth/login", {
      method: "POST",
    });

    expect(validateRequestOrigin(request)).toBe(false);
  });

  it("accepts localhost in development mode", () => {
    process.env.NODE_ENV = "development";

    const request = new Request("http://localhost:3000/api/auth/login", {
      headers: { origin: "http://localhost:3000" },
      method: "POST",
    });

    expect(validateRequestOrigin(request)).toBe(true);
  });

  it("rejects localhost in production mode", () => {
    process.env.NODE_ENV = "production";

    const request = new Request("http://localhost:3000/api/auth/login", {
      headers: { origin: "http://localhost:3000" },
      method: "POST",
    });

    expect(validateRequestOrigin(request)).toBe(false);
  });
});
