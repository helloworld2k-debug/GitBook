import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/0025_policy_pages.sql"), "utf8");

describe("policy pages migration", () => {
  it("creates editable policy pages with English default content and admin-only writes", () => {
    expect(migration).toContain("create table if not exists public.policy_pages");
    expect(migration).toContain("slug text primary key");
    expect(migration).toContain("title text not null");
    expect(migration).toContain("summary text not null");
    expect(migration).toContain("body text not null");
    expect(migration).toContain("alter table public.policy_pages enable row level security");
    expect(migration).toContain("policy_pages_public_read");
    expect(migration).toContain("policy_pages_admin_all");
    expect(migration).toContain("Terms of Service");
    expect(migration).toContain("Privacy Policy");
    expect(migration).toContain("Refund Policy");
  });
});
