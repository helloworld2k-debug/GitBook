import { beforeEach, describe, expect, it, vi } from "vitest";
import { replySupportFeedback, submitSupportFeedback } from "@/app/[locale]/support/actions";

const mocks = vi.hoisted(() => ({
  createSupabaseAdminClient: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
  requireUser: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
  requireUser: mocks.requireUser,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

describe("support feedback actions", () => {
  beforeEach(() => {
    mocks.createSupabaseAdminClient.mockReset();
    mocks.redirect.mockClear();
    mocks.requireUser.mockReset().mockResolvedValue({ email: "user@example.com", id: "user-1" });
  });

  it("requires login before submitting feedback and stores the signed-in user", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    const from = vi.fn((table: string) => {
      if (table === "support_feedback") {
        return { insert };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.createSupabaseAdminClient.mockReturnValue({ from });

    const formData = new FormData();
    formData.set("contact", "@hello");
    formData.set("subject", "Account issue");
    formData.set("message", "I need help with my account.");

    await expect(submitSupportFeedback("en", formData)).rejects.toThrow("NEXT_REDIRECT:/en/support?feedback=saved");

    expect(mocks.requireUser).toHaveBeenCalledWith("en", "/en/support");
    expect(insert).toHaveBeenCalledWith({
      contact: "@hello",
      email: "user@example.com",
      message: "I need help with my account.",
      subject: "Account issue",
      user_id: "user-1",
    });
  });

  it("allows a signed-in user to continue their own feedback thread", async () => {
    const feedbackSingle = vi.fn(async () => ({ data: { id: "feedback-1", user_id: "user-1" }, error: null }));
    const feedbackEqUser = vi.fn(() => ({ single: feedbackSingle }));
    const feedbackEqId = vi.fn(() => ({ eq: feedbackEqUser }));
    const feedbackSelect = vi.fn(() => ({ eq: feedbackEqId }));
    const messageInsert = vi.fn(async () => ({ error: null }));
    const feedbackUpdateEq = vi.fn(async () => ({ error: null }));
    const feedbackUpdate = vi.fn(() => ({ eq: feedbackUpdateEq }));
    const from = vi.fn((table: string) => {
      if (table === "support_feedback") {
        return { select: feedbackSelect, update: feedbackUpdate };
      }

      if (table === "support_feedback_messages") {
        return { insert: messageInsert };
      }

      throw new Error(`Unexpected table: ${table}`);
    });
    mocks.createSupabaseAdminClient.mockReturnValue({ from });

    const formData = new FormData();
    formData.set("message", "Here is more context.");

    await expect(replySupportFeedback("zh-Hant", "feedback-1", formData)).rejects.toThrow(
      "NEXT_REDIRECT:/zh-Hant/support/feedback/feedback-1?reply=saved",
    );

    expect(mocks.requireUser).toHaveBeenCalledWith("zh-Hant", "/zh-Hant/support/feedback/feedback-1");
    expect(messageInsert).toHaveBeenCalledWith({
      author_role: "user",
      body: "Here is more context.",
      feedback_id: "feedback-1",
      user_id: "user-1",
    });
    expect(feedbackUpdate).toHaveBeenCalledWith({ status: "open", updated_at: expect.any(String) });
  });
});
