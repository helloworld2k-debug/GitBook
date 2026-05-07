export type FeedbackReadRow = {
  admin_user_id?: string | null;
  read_at: string | null;
};

export type FeedbackMessageRow = {
  author_role: "user" | "admin";
  created_at: string;
};

export type FeedbackUnreadSource = {
  created_at: string;
  id: string;
  support_feedback_admin_reads?: FeedbackReadRow[] | null;
  support_feedback_messages?: FeedbackMessageRow[] | null;
};

function maxIsoDate(values: string[]) {
  return values.reduce<string | null>((latest, value) => {
    if (!latest || new Date(value).getTime() > new Date(latest).getTime()) {
      return value;
    }

    return latest;
  }, null);
}

export function getLatestUserMessageAt(feedback: Pick<FeedbackUnreadSource, "created_at" | "support_feedback_messages">) {
  return maxIsoDate([
    feedback.created_at,
    ...(feedback.support_feedback_messages ?? [])
      .filter((message) => message.author_role === "user")
      .map((message) => message.created_at),
  ]);
}

export function getAdminReadAt(
  reads: FeedbackReadRow[] | null | undefined,
  adminUserId: string,
) {
  return reads?.find((read) => read.admin_user_id === adminUserId)?.read_at ?? null;
}

export function isFeedbackUnread(latestUserMessageAt: string | null, readAt: string | null) {
  if (!latestUserMessageAt) {
    return false;
  }

  if (!readAt) {
    return true;
  }

  return new Date(readAt).getTime() < new Date(latestUserMessageAt).getTime();
}

export function getUnreadFeedbackIds({
  latestUserMessageByFeedbackId,
  readAtByFeedbackId,
}: {
  latestUserMessageByFeedbackId: Map<string, string | null>;
  readAtByFeedbackId: Map<string, string | null>;
}) {
  return new Set(
    [...latestUserMessageByFeedbackId.entries()]
      .filter(([feedbackId, latestUserMessageAt]) => isFeedbackUnread(latestUserMessageAt, readAtByFeedbackId.get(feedbackId) ?? null))
      .map(([feedbackId]) => feedbackId),
  );
}

export function enrichFeedbackUnreadState<T extends FeedbackUnreadSource>(feedback: T[], adminUserId: string) {
  return feedback.map((item) => {
    const latestUserMessageAt = getLatestUserMessageAt(item);
    const adminReadAt = getAdminReadAt(item.support_feedback_admin_reads, adminUserId);

    return {
      ...item,
      adminReadAt,
      isUnread: isFeedbackUnread(latestUserMessageAt, adminReadAt),
      latestUserMessageAt,
    };
  });
}
