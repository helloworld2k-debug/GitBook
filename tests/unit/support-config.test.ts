import { describe, expect, it } from "vitest";
import { getDefaultSupportChannelsConfig, getVisibleSupportChannels, normalizeSupportChannels } from "@/config/support";

describe("support channels", () => {
  it("hides unconfigured chat channels", () => {
    const channels = getVisibleSupportChannels({
      discord: "",
      email: "",
      qq: "123456",
      telegram: "https://t.me/example",
      wechat: "",
    });

    expect(channels.map((channel) => channel.id)).toEqual(["qq", "telegram"]);
  });

  it("builds environment defaults for all supported channels", () => {
    const config = getDefaultSupportChannelsConfig({
      NEXT_PUBLIC_SUPPORT_DISCORD: "https://discord.gg/example",
      NEXT_PUBLIC_SUPPORT_EMAIL: "support@example.com",
      NEXT_PUBLIC_SUPPORT_QQ: "123456",
      NEXT_PUBLIC_SUPPORT_TELEGRAM: "https://t.me/example",
      NEXT_PUBLIC_SUPPORT_WECHAT: "wechat-id",
    });

    expect(config).toEqual({
      discord: "https://discord.gg/example",
      email: "support@example.com",
      qq: "123456",
      telegram: "https://t.me/example",
      wechat: "wechat-id",
    });
  });

  it("prefers database-backed enabled rows and preserves their sort order", () => {
    const channels = normalizeSupportChannels({
      defaults: {
        discord: "https://discord.gg/default",
        email: "default@example.com",
        qq: "",
        telegram: "",
        wechat: "",
      },
      rows: [
        { id: "email", is_enabled: true, label: "Email", sort_order: 2, value: "help@example.com" },
        { id: "telegram", is_enabled: true, label: "Telegram", sort_order: 1, value: "https://t.me/help" },
        { id: "qq", is_enabled: false, label: "QQ", sort_order: 3, value: "123456" },
      ],
    });

    expect(channels.map((channel) => channel.id)).toEqual(["telegram", "email"]);
    expect(channels[1]).toMatchObject({ href: "mailto:help@example.com", value: "help@example.com" });
  });

  it("falls back to environment defaults when no rows exist", () => {
    const channels = normalizeSupportChannels({
      defaults: {
        discord: "https://discord.gg/default",
        email: "support@example.com",
        qq: "",
        telegram: "",
        wechat: "",
      },
      rows: [],
    });

    expect(channels.map((channel) => channel.id)).toEqual(["discord", "email"]);
  });
});
