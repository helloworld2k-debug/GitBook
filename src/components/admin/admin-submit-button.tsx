"use client";

import { useFormStatus } from "react-dom";

type AdminSubmitButtonProps = {
  "aria-label"?: string;
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
  type?: "submit";
};

export function AdminSubmitButton({
  "aria-label": ariaLabel,
  children,
  className = "",
  pendingLabel = "Saving...",
  type = "submit",
}: AdminSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      aria-busy={pending}
      aria-disabled={pending}
      aria-label={ariaLabel}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
      disabled={pending}
      type={type}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
