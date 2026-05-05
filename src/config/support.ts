import { MessageCircle, Send, Users } from "lucide-react";

export type SupportChannelId = "qq" | "wechat" | "telegram" | "discord" | "email";

export type SupportChannelsConfig = Record<SupportChannelId, string>;

export type SupportChannelRow = {
  id: SupportChannelId;
  is_enabled: boolean;
  label: string;
  sort_order: number;
  value: string;
};

export type NormalizedSupportChannel = SupportChannelRow & {
  href: string | null;
  icon: typeof MessageCircle;
};

type SupportEnvSource = Partial<Record<
  | "NEXT_PUBLIC_SUPPORT_DISCORD"
  | "NEXT_PUBLIC_SUPPORT_EMAIL"
  | "NEXT_PUBLIC_SUPPORT_QQ"
  | "NEXT_PUBLIC_SUPPORT_TELEGRAM"
  | "NEXT_PUBLIC_SUPPORT_WECHAT",
  string
>>;

export function getDefaultSupportChannelsConfig(source: SupportEnvSource = process.env) {
  return {
    discord: source.NEXT_PUBLIC_SUPPORT_DISCORD ?? "",
    email: source.NEXT_PUBLIC_SUPPORT_EMAIL ?? "",
    qq: source.NEXT_PUBLIC_SUPPORT_QQ ?? "",
    telegram: source.NEXT_PUBLIC_SUPPORT_TELEGRAM ?? "",
    wechat: source.NEXT_PUBLIC_SUPPORT_WECHAT ?? "",
  } satisfies SupportChannelsConfig;
}

const supportChannelMeta = {
  discord: { icon: Users, label: "Discord" },
  email: { icon: MessageCircle, label: "Email" },
  qq: { icon: MessageCircle, label: "QQ" },
  telegram: { icon: Send, label: "Telegram" },
  wechat: { icon: MessageCircle, label: "WeChat" },
} satisfies Record<SupportChannelId, { icon: typeof MessageCircle; label: string }>;

function getChannelHref(id: SupportChannelId, value: string) {
  if (id === "email") {
    return value ? `mailto:${value}` : null;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  return null;
}

export function normalizeSupportChannels(input: {
  defaults: SupportChannelsConfig;
  rows: SupportChannelRow[];
}) {
  const visibleRows = input.rows
    .filter((row) => row.is_enabled && row.value.trim().length > 0)
    .sort((left, right) => left.sort_order - right.sort_order);

  if (visibleRows.length > 0) {
    return visibleRows.map((row) => ({
      ...row,
      href: getChannelHref(row.id, row.value.trim()),
      icon: supportChannelMeta[row.id].icon,
      label: row.label || supportChannelMeta[row.id].label,
      value: row.value.trim(),
    })) satisfies NormalizedSupportChannel[];
  }

  return (Object.keys(supportChannelMeta) as SupportChannelId[])
    .map((id) => ({
      id,
      is_enabled: true,
      label: supportChannelMeta[id].label,
      sort_order: 999,
      href: getChannelHref(id, input.defaults[id].trim()),
      value: input.defaults[id].trim(),
      icon: supportChannelMeta[id].icon,
    }))
    .filter((channel) => channel.value.length > 0) satisfies NormalizedSupportChannel[];
}

export function getVisibleSupportChannels(config: SupportChannelsConfig = getDefaultSupportChannelsConfig()) {
  return normalizeSupportChannels({
    defaults: config,
    rows: [],
  });
}

export function toSupportChannelRows(config: SupportChannelsConfig) {
  return (Object.keys(supportChannelMeta) as SupportChannelId[])
    .map((id, index) => ({
      id,
      is_enabled: config[id].trim().length > 0,
      ...supportChannelMeta[id],
      sort_order: (index + 1) * 10,
      value: config[id].trim(),
    })) satisfies SupportChannelRow[];
}
