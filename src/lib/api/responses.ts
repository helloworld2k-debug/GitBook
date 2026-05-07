import { NextResponse } from "next/server";

export function jsonError(message: string, status = 400, init?: ResponseInit) {
  return NextResponse.json({ error: message }, { ...init, status });
}

export function jsonOk<T extends Record<string, unknown>>(payload: T, status = 200) {
  return NextResponse.json(payload, { status });
}
