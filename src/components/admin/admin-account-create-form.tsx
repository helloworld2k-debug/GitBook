"use client";

import { useState } from "react";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { AdminTemporaryPasswordField } from "@/components/admin/admin-temporary-password-field";

type AccountCreationMode = "invite" | "temporary-password";

type AdminAccountCreateFormProps = {
  canManageRoles: boolean;
  createTempAction: (formData: FormData) => void | Promise<void>;
  inviteAction: (formData: FormData) => void | Promise<void>;
  labels: {
    createInvite: string;
    createTempAccount: string;
    creationMode: string;
    displayName: string;
    email: string;
    generatePassword: string;
    inviteMode: string;
    operatorRole: string;
    ownerRole: string;
    role: string;
    temporaryPassword: string;
    tempPasswordMode: string;
    userRole: string;
  };
  locale: string;
};

export function AdminAccountCreateForm({ canManageRoles, createTempAction, inviteAction, labels, locale }: AdminAccountCreateFormProps) {
  const [mode, setMode] = useState<AccountCreationMode>("invite");
  const action = mode === "invite" ? inviteAction : createTempAction;

  return (
    <form action={action} className="mt-4 grid gap-4">
      <input name="locale" type="hidden" value={locale} />
      <input name="return_to" type="hidden" value="/admin/users" />

      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold text-slate-700">{labels.creationMode}</legend>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700">
            <input
              checked={mode === "invite"}
              className="size-4 border-slate-300"
              name="creation_mode"
              onChange={() => setMode("invite")}
              type="radio"
              value="invite"
            />
            {labels.inviteMode}
          </label>
          <label className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700">
            <input
              checked={mode === "temporary-password"}
              className="size-4 border-slate-300"
              name="creation_mode"
              onChange={() => setMode("temporary-password")}
              type="radio"
              value="temporary-password"
            />
            {labels.tempPasswordMode}
          </label>
        </div>
      </fieldset>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_13rem]">
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          {labels.email}
          <input
            autoComplete="email"
            className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950/10"
            name="email"
            required
            type="email"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          {labels.displayName}
          <input
            autoComplete="name"
            className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950/10"
            maxLength={80}
            name="display_name"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          {labels.role}
          <select
            className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950/10"
            name="admin_role"
            defaultValue="user"
          >
            <option value="user">{labels.userRole}</option>
            {canManageRoles ? (
              <>
                <option value="operator">{labels.operatorRole}</option>
                <option value="owner">{labels.ownerRole}</option>
              </>
            ) : null}
          </select>
        </label>
      </div>

      {mode === "temporary-password" ? (
        <AdminTemporaryPasswordField generateLabel={labels.generatePassword} label={labels.temporaryPassword} />
      ) : null}

      <AdminSubmitButton
        className="inline-flex min-h-11 w-fit items-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
        pendingLabel={mode === "invite" ? labels.createInvite : labels.createTempAccount}
      >
        {mode === "invite" ? labels.createInvite : labels.createTempAccount}
      </AdminSubmitButton>
    </form>
  );
}
