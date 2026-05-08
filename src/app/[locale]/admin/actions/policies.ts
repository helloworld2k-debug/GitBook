"use server";

import { revalidatePath } from "next/cache";
import { redirectWithAdminFeedback } from "@/lib/admin/feedback";
import { requireAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { insertAdminAuditLog } from "./audit";
import {
  getBoundedString,
  getPolicyPageSlug,
  getSafeLocale,
  MAX_POLICY_BODY_LENGTH,
  MAX_POLICY_SUMMARY_LENGTH,
  MAX_POLICY_TITLE_LENGTH,
} from "./validation";

export async function updatePolicyPage(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const slug = getPolicyPageSlug(formData);
  const title = getBoundedString(formData, "title", "Policy title is required", MAX_POLICY_TITLE_LENGTH);
  const summary = getBoundedString(formData, "summary", "Policy summary is required", MAX_POLICY_SUMMARY_LENGTH);
  const body = getBoundedString(formData, "body", "Policy body is required", MAX_POLICY_BODY_LENGTH);
  const supabase = createSupabaseAdminClient();

  const { data: before } = await supabase
    .from("policy_pages")
    .select("slug,title,summary,body")
    .eq("slug", slug)
    .single();

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("policy_pages")
    .update({
      body,
      summary,
      title,
      updated_at: now,
      updated_by: admin.id,
    })
    .eq("slug", slug);

  if (error) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/policies",
      formData,
      key: "policy-page-update-failed",
      locale,
      tone: "error",
    });
  }

  await insertAdminAuditLog({
    action: "update_policy_page",
    adminUserId: admin.id,
    after: { body, slug, summary, title },
    before: before ?? null,
    reason: `Updated policy page ${slug}`,
    targetId: "11111111-1111-1111-1111-111111111111",
    targetType: "policy_page",
  });

  revalidatePath(`/en/policies/${slug}`);
  revalidatePath(`/${locale}/admin/policies`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/policies",
    formData,
    key: "policy-page-updated",
    locale,
    tone: "notice",
  });
}
