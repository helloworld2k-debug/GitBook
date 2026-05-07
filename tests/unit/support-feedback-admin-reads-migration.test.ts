import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/0019_support_feedback_admin_reads.sql"), "utf8");

describe("support feedback admin reads migration", () => {
  it("creates per-admin feedback read tracking with RLS", () => {
    expect(migration).toContain("create table if not exists public.support_feedback_admin_reads");
    expect(migration).toContain("feedback_id uuid not null references public.support_feedback(id) on delete cascade");
    expect(migration).toContain("admin_user_id uuid not null references public.profiles(id) on delete cascade");
    expect(migration).toContain("read_at timestamptz not null default now()");
    expect(migration).toContain("primary key (feedback_id, admin_user_id)");
    expect(migration).toContain("alter table public.support_feedback_admin_reads enable row level security");
    expect(migration).toContain("support_feedback_admin_reads_admin_all");
  });
});
