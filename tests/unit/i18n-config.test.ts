import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import enMessages from "../../messages/en.json";
import zhMessages from "../../messages/zh.json";

type MessageTree = Record<string, string | MessageTree>;

function messageKeys(value: MessageTree, prefix = ""): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;

    return typeof child === "string" ? [path] : messageKeys(child, path);
  });
}

describe("i18n configuration", () => {
  it("keeps localized message keys aligned with English", () => {
    const expectedKeys = messageKeys(enMessages).sort();

    expect(messageKeys(zhMessages).sort()).toEqual(expectedKeys);
  });

  it("uses Simplified Chinese copy for the active Chinese locale", () => {
    expect(zhMessages.donate.checkoutDodo).toBe("立即支持开发");
    expect(zhMessages.admin.overview.licensesTitle).toBe("兑换");
    expect(zhMessages.dashboard.trial.code).toContain("兑换码");

    const serializedMessages = JSON.stringify(zhMessages);
    expect(serializedMessages).not.toMatch(/[兌開發後臺軟體檢視郵儲選]/);
  });

  it("normalizes localized app routes through next-intl proxy without intercepting auth callbacks", () => {
    const middleware = readFileSync("src/proxy.ts", "utf8");

    expect(middleware).toContain('matcher: ["/((?!api|auth/callback|_next|_vercel|.*\\\\..*).*)"]');
    expect(middleware).toContain("createMiddleware(routing)");
    expect(middleware).toContain("refreshSupabaseSession(request, response)");
  });

  it("wires next-intl request configuration into Next.js", () => {
    const nextConfig = readFileSync("next.config.ts", "utf8");

    expect(nextConfig).toContain('createNextIntlPlugin("./src/i18n/request.ts")');
    expect(nextConfig).toContain("withNextIntl(nextConfig)");
  });

});
