import { describe, expect, it } from "vitest";
import { getUnreadFeedbackIds } from "@/lib/admin/support-feedback-unread";

describe("support feedback unread helpers", () => {
  it("marks feedback unread when it has a user message newer than the admin read timestamp", () => {
    const unreadIds = getUnreadFeedbackIds({
      latestUserMessageByFeedbackId: new Map([
        ["feedback-1", "2026-05-07T10:00:00.000Z"],
        ["feedback-2", "2026-05-07T09:00:00.000Z"],
        ["feedback-3", "2026-05-07T08:00:00.000Z"],
      ]),
      readAtByFeedbackId: new Map([
        ["feedback-1", "2026-05-07T10:05:00.000Z"],
        ["feedback-2", "2026-05-07T08:59:59.000Z"],
      ]),
    });

    expect(unreadIds).toEqual(new Set(["feedback-2", "feedback-3"]));
  });
});
