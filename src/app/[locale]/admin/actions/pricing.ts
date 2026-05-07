"use server";

import { revalidatePath } from "next/cache";
import { redirectWithAdminFeedback } from "@/lib/admin/feedback";
import { requireAdmin } from "@/lib/auth/guards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { insertAdminAuditLog } from "./audit";
import { getBoundedString, getDiscountPercent, getPositiveDollarAmountInCents, getRequiredString, getSafeLocale, MAX_DONATION_TIER_DESCRIPTION_LENGTH, MAX_DONATION_TIER_LABEL_LENGTH } from "./validation";

export async function updateDonationTier(formData: FormData) {
  const locale = getSafeLocale(formData.get("locale"));
  const admin = await requireAdmin(locale);
  const tierId = getRequiredString(formData, "tier_id", "Donation tier is required");
  const label = getBoundedString(formData, "label", "Tier label", MAX_DONATION_TIER_LABEL_LENGTH);
  const description = getBoundedString(
    formData,
    "description",
    "Tier description",
    MAX_DONATION_TIER_DESCRIPTION_LENGTH,
  );
  const priceAmount = getPositiveDollarAmountInCents(formData, "price", "Price must be a positive dollar amount");
  const discountPercent = getDiscountPercent(formData, "discount_percent");
  const amount = Math.round(priceAmount * (100 - discountPercent) / 100);
  const compareAtAmount = discountPercent > 0 ? priceAmount : null;
  const isActive = formData.get("is_active") === "on";

  if (amount <= 0) {
    throw new Error("Discounted price must be positive");
  }

  const supabase = createSupabaseAdminClient();
  const { data: before } = await supabase
    .from("donation_tiers")
    .select("label,description,amount,compare_at_amount,is_active")
    .eq("id", tierId)
    .single();
  const next = {
    amount,
    compare_at_amount: compareAtAmount,
    description,
    is_active: isActive,
    label,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("donation_tiers").update(next).eq("id", tierId);

  if (error) {
    redirectWithAdminFeedback({
      fallbackPath: "/admin/contribution-pricing",
      formData,
      key: "donation-tier-update-failed",
      locale,
      tone: "error",
    });
  }

  await insertAdminAuditLog({
    action: "update_donation_tier",
    adminUserId: admin.id,
    after: next,
    before: before ?? null,
    reason: `Updated development support tier ${tierId}`,
    targetId: tierId,
    targetType: "donation_tier",
  });

  revalidatePath(`/${locale}/contributions`);
  revalidatePath(`/${locale}/admin/contribution-pricing`);
  revalidatePath(`/${locale}/admin/audit-logs`);
  redirectWithAdminFeedback({
    fallbackPath: "/admin/contribution-pricing",
    formData,
    key: "donation-tier-updated",
    locale,
    tone: "notice",
  });
}
