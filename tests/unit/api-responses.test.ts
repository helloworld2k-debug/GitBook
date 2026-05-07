import { describe, expect, it } from "vitest";
import { jsonError, jsonOk } from "@/lib/api/responses";

describe("api responses", () => {
  it("returns a stable error payload and status", async () => {
    const response = jsonError("Unauthorized", 401);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns a stable success payload", async () => {
    const response = jsonOk({ ok: true });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
