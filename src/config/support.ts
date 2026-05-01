import { MessageCircle, Send, Users } from "lucide-react";

export type SupportChannelId = "qq" | "wechat" | "telegram" | "discord";

export type SupportChannelsConfig = Record<SupportChannelId, string>;

export const supportChannels: SupportChannelsConfig = {
  discord: process.env.NEXT_PUBLIC_SUPPORT_DISCORD ?? "",
  qq: process.env.NEXT_PUBLIC_SUPPORT_QQ ?? "",
  telegram: process.env.NEXT_PUBLIC_SUPPORT_TELEGRAM ?? "",
  wechat: process.env.NEXT_PUBLIC_SUPPORT_WECHAT ?? "",
};

const supportChannelMeta = {
  discord: { icon: Users, label: "Discord" },
  qq: { icon: MessageCircle, label: "QQ" },
  telegram: { icon: Send, label: "Telegram" },
  wechat: { icon: MessageCircle, label: "WeChat" },
} satisfies Record<SupportChannelId, { icon: typeof MessageCircle; label: string }>;

export function getVisibleSupportChannels(config: SupportChannelsConfig = supportChannels) {
  return (Object.keys(supportChannelMeta) as SupportChannelId[])
    .map((id) => ({
      id,
      value: config[id].trim(),
      ...supportChannelMeta[id],
    }))
    .filter((channel) => channel.value.length > 0);
}
