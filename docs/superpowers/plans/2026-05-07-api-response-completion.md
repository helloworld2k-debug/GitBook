# API Response Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish response helper adoption in tested API routes without changing response contracts.

**Architecture:** Flat error routes use `jsonError`; arbitrary response shapes use `jsonPayload`; redirect responses continue to use `NextResponse.redirect`.

**Tech Stack:** Next.js route handlers, Vitest, zod, Supabase clients.

---

### Task 1: Add Generic JSON Payload Helper

**Files:**
- Modify: `src/lib/api/responses.ts`

- [x] Add `jsonPayload(payload, status, init)` to preserve arbitrary body shapes.

### Task 2: Migrate Tested API Routes

**Files:**
- Modify: `src/app/api/webhooks/dodo/route.ts`
- Modify: `src/app/[locale]/desktop/authorize/route.ts`
- Modify: `src/app/api/desktop/auth/exchange/route.ts`
- Modify: `src/app/api/desktop/auth/refresh/route.ts`
- Modify: `src/app/api/desktop/auth/logout/route.ts`
- Modify: `src/app/api/desktop/entitlement/route.ts`

- [x] Replace flat error JSON with `jsonError`.
- [x] Replace arbitrary JSON payloads with `jsonPayload`.
- [x] Keep `NextResponse.redirect` unchanged.

### Task 3: Verification

- [x] Run focused route tests.
- [ ] Run `npm run lint`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Commit the response migration to `main`.
