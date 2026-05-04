"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

type ConfirmActionButtonProps = {
  children: React.ReactNode;
  className?: string;
  confirmLabel: string;
  pendingLabel?: string;
  type?: "submit";
};

export function ConfirmActionButton({
  children,
  className = "",
  confirmLabel,
  pendingLabel = "Processing...",
  type = "submit",
}: ConfirmActionButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const { pending } = useFormStatus();

  return (
    <div className="grid gap-2">
      <button
        aria-busy={pending}
        aria-disabled={pending}
        className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
        disabled={pending}
        onClick={(event) => {
          if (pending) {
            event.preventDefault();
            return;
          }

          if (!confirming) {
            event.preventDefault();
            setConfirming(true);
          }
        }}
        type={type}
      >
        {pending ? pendingLabel : confirming ? confirmLabel : children}
      </button>
      {confirming && !pending ? (
        <p className="text-xs text-amber-200">Click again to confirm this action.</p>
      ) : null}
    </div>
  );
}
