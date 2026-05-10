type SlowDesktopApiInput = {
  route: string;
  requestId: string;
  reason: string;
  totalMs: number;
  sessionMs?: number;
  entitlementMs?: number;
  leaseMs?: number;
  thresholdMs?: number;
};

export function createRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `req_${Math.random().toString(36).slice(2, 10)}`;
}

export function nowMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }

  return Date.now();
}

export function elapsedMs(startMs: number) {
  return Math.max(0, Math.round(nowMs() - startMs));
}

export function logSlowDesktopApi({
  entitlementMs,
  leaseMs,
  reason,
  requestId,
  route,
  sessionMs,
  thresholdMs = 1000,
  totalMs,
}: SlowDesktopApiInput) {
  if (totalMs < thresholdMs) {
    return;
  }

  console.warn("desktop_api_slow", {
    entitlement_ms: entitlementMs ?? null,
    lease_ms: leaseMs ?? null,
    reason,
    request_id: requestId,
    route,
    session_ms: sessionMs ?? null,
    total_ms: totalMs,
  });
}
