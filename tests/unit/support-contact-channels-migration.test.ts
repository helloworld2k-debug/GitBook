import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/0014_support_contact_channels.sql"),
  "utf8",
);

describe("support contact channels migration", () => {
  it("creates the support contact channels table with stable ids and enable flags", () => {
    expect(migration).toContain("create table if not exists public.support_contact_channels");
    expect(migration).toContain("check (id in ('telegram', 'discord', 'qq', 'email', 'wechat'))");
    expect(migration).toContain("is_enabled boolean not null default false");
    expect(migration).toContain("updated_by uuid references public.profiles(id)");
  });

  it("seeds the supported contact channel rows", () => {
    expect(migration).toContain("('telegram', 'Telegram', '', false, 10)");
    expect(migration).toContain("('discord', 'Discord', '', false, 20)");
    expect(migration).toContain("('qq', 'QQ', '', false, 30)");
    expect(migration).toContain("('email', 'Email', '', false, 40)");
    expect(migration).toContain("('wechat', 'WeChat', '', false, 50)");
  });

  it("can be re-applied safely when policies already exist", () => {
    expect(migration).toContain('drop policy if exists "support_contact_channels_public_read"');
    expect(migration).toContain('drop policy if exists "support_contact_channels_admin_write"');
  });
});
