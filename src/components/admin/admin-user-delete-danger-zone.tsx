import { AdminSubmitButton } from "@/components/admin/admin-submit-button";

export function AdminUserDeleteDangerZone({
  action,
  email,
  labels,
  locale,
  userId,
}: {
  action: (formData: FormData) => Promise<void>;
  email: string;
  labels: {
    confirmation: string;
    description: string;
    hint: string;
    submit: string;
    title: string;
    warning: string;
  };
  locale: string;
  userId: string;
}) {
  return (
    <section className="mt-6 rounded-md border border-red-200 bg-red-50 p-5 shadow-sm">
      <h2 className="text-base font-semibold text-red-900">{labels.title}</h2>
      <p className="mt-2 text-sm leading-6 text-red-800">{labels.description}</p>
      <p className="mt-2 text-sm font-medium text-red-900">{labels.warning}</p>
      <form action={action} className="mt-4 grid gap-3">
        <input name="locale" type="hidden" value={locale} />
        <input name="return_to" type="hidden" value="/admin/users" />
        <input name="user_id" type="hidden" value={userId} />
        <label className="grid gap-1 text-sm font-medium text-red-900">
          {labels.confirmation}
          <input
            className="min-h-11 rounded-md border border-red-300 bg-white px-3 text-sm text-slate-950"
            name="confirmation"
            placeholder={labels.hint}
            required
          />
        </label>
        <AdminSubmitButton className="inline-flex min-h-10 w-fit items-center rounded-md bg-red-600 px-4 text-sm font-semibold text-white" pendingLabel="Deleting...">
          {labels.submit}
        </AdminSubmitButton>
      </form>
      <p className="mt-3 text-xs text-red-700">
        Accepted confirmation values: <span className="font-mono">DELETE</span> or <span className="font-mono">{email}</span>
      </p>
    </section>
  );
}
