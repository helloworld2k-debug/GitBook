"use client";

import { useEffect, useState } from "react";

function getReleaseInputs(formId: string, checkedOnly: boolean) {
  if (typeof document === "undefined") {
    return [];
  }

  const checked = checkedOnly ? ":checked" : "";
  return Array.from(
    document.querySelectorAll<HTMLInputElement>(
      `form#${formId} input[name="release_ids"]${checked}, input[form="${formId}"][name="release_ids"]${checked}`,
    ),
  );
}

export function AdminReleaseSelectAllCheckbox({ formId, label }: { formId: string; label: string }) {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const update = () => {
      const selected = getReleaseInputs(formId, true).length;
      const total = getReleaseInputs(formId, false).length;
      setChecked(total > 0 && selected === total);
    };

    update();
    document.addEventListener("change", update);

    return () => document.removeEventListener("change", update);
  }, [formId]);

  return (
    <input
      aria-label={label}
      checked={checked}
      className="size-4 rounded border-slate-300"
      onChange={(event) => {
        getReleaseInputs(formId, false).forEach((row) => {
          row.checked = event.currentTarget.checked;
          row.dispatchEvent(new Event("change", { bubbles: true }));
        });
      }}
      type="checkbox"
    />
  );
}
