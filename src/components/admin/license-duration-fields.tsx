"use client";

import { useState } from "react";

type LicenseDurationFieldsProps = {
  labels: {
    duration: string;
    durationTrial: string;
    durationMonth1: string;
    durationMonth3: string;
    durationYear1: string;
    fixedPaidDurationsHelp: string;
    trialDays: string;
  };
};

export function LicenseDurationFields({ labels }: LicenseDurationFieldsProps) {
  const [durationKind, setDurationKind] = useState("trial_3_day");

  return (
    <>
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        {labels.duration}
        <select
          className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950/10"
          name="duration_kind"
          onChange={(event) => setDurationKind(event.currentTarget.value)}
          value={durationKind}
        >
          <option value="trial_3_day">{labels.durationTrial}</option>
          <option value="month_1">{labels.durationMonth1}</option>
          <option value="month_3">{labels.durationMonth3}</option>
          <option value="year_1">{labels.durationYear1}</option>
        </select>
      </label>
      {durationKind === "trial_3_day" ? (
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          {labels.trialDays}
          <input
            className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm font-normal text-slate-950 shadow-sm focus:border-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-950/10"
            defaultValue="3"
            max="7"
            min="1"
            name="trial_days"
            type="number"
          />
        </label>
      ) : (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-600">
          {labels.fixedPaidDurationsHelp}
        </p>
      )}
    </>
  );
}
