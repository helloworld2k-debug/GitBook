import { describe, expect, it } from "vitest";
import { getSponsorLevelForTotal } from "@/lib/certificates/levels";

describe("getSponsorLevelForTotal", () => {
  it("returns null below the first threshold", () => {
    expect(getSponsorLevelForTotal(499)?.code ?? null).toBeNull();
  });

  it("returns the highest level reached", () => {
    expect(getSponsorLevelForTotal(500)?.code).toBe("bronze");
    expect(getSponsorLevelForTotal(9000)?.code).toBe("silver");
    expect(getSponsorLevelForTotal(50000)?.code).toBe("platinum");
  });
});
