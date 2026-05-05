"use client";

import { useSearchParams } from "next/navigation";
import { FormStatusBanner } from "@/components/form-status-banner";

type PaymentStatusBannerProps = {
  message: string;
};

export function PaymentStatusBanner({ message }: PaymentStatusBannerProps) {
  const searchParams = useSearchParams();

  if (searchParams.get("payment") !== "cancelled") {
    return null;
  }

  return (
    <div className="mt-5">
      <FormStatusBanner message={message} tone="warning" />
    </div>
  );
}
