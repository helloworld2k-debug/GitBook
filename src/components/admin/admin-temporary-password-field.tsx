"use client";

import { useId, useState } from "react";

function generateTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const values = new Uint32Array(18);

  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(values);
  } else {
    for (let index = 0; index < values.length; index += 1) {
      values[index] = Math.floor(Math.random() * alphabet.length);
    }
  }

  return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
}

export function AdminTemporaryPasswordField({
  generateLabel,
  label,
  required = true,
}: {
  generateLabel: string;
  label: string;
  required?: boolean;
}) {
  const id = useId();
  const [password, setPassword] = useState("");

  return (
    <div className="grid gap-2">
      <label className="grid gap-1 text-sm font-medium text-slate-700" htmlFor={id}>
        {label}
        <input
          className="min-h-11 rounded-md border border-slate-300 px-3 py-2 font-mono text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950/10"
          id={id}
          minLength={8}
          name="password"
          onChange={(event) => setPassword(event.currentTarget.value)}
          required={required}
          type="text"
          value={password}
        />
      </label>
      <button
        className="inline-flex min-h-10 w-fit items-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-500 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
        onClick={() => setPassword(generateTemporaryPassword())}
        type="button"
      >
        {generateLabel}
      </button>
    </div>
  );
}
