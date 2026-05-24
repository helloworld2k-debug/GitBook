import type { AdminFeedbackKey, AdminFeedbackTone } from "./feedback";

export type AdminInlineActionState<TData = unknown> = {
  data?: TData;
  key?: AdminFeedbackKey;
  message?: string;
  tone?: AdminFeedbackTone;
};

export type AdminInlineActionResult<TData = unknown> = AdminInlineActionState<TData>;

export const emptyAdminInlineActionState: AdminInlineActionState = {};
