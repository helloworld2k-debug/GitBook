"use client";

import { useFormStatus } from "react-dom";

type FormSubmitButtonProps = {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
  type?: "submit";
};

export function FormSubmitButton({
  children,
  className = "",
  pendingLabel = "Submitting...",
  type = "submit",
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      aria-busy={pending}
      aria-disabled={pending}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
      disabled={pending}
      type={type}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
