import { describe, expect, it } from "vitest";
import { getVisibleSupportChannels } from "@/config/support";

describe("support channels", () => {
  it("hides unconfigured chat channels", () => {
    const channels = getVisibleSupportChannels({
      discord: "",
      qq: "123456",
      telegram: "https://t.me/example",
      wechat: "",
    });

    expect(channels.map((channel) => channel.id)).toEqual(["qq", "telegram"]);
  });
});
