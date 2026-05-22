# 2026-05-23 Vercel deployment cache/config incident

## Symptom
- Production deployment `dpl_BUgEKX3ViHi2jvwbquyfeLqUGBo7` for commit `a311248` failed before compilation.
- Build log failed at `Applying modifyConfig from Vercel` with `TypeError: The "path" argument must be of type string. Received undefined`.

## Investigation
- Local `npm run build` passed.
- Local `npm run lint && npm test` passed: 114 test files, 579 tests.
- Local `vercel build --prod` passed after pulling production project settings.
- Local `npx vercel@54.3.0 build --prod` also passed, matching the cloud CLI version.
- Failed deployment JSON had empty build config, while successful deployments included `framework: nextjs` and `nodeVersion: 24.x`.

## Root Cause Hypothesis
- One-off Vercel cloud build cache/config injection failure, not a deterministic application code failure.
- The successful redeploy skipped build cache and restored normal Vercel build config injection.

## Resolution
- Ran `vercel redeploy dpl_BUgEKX3ViHi2jvwbquyfeLqUGBo7 --target production`.
- New deployment `dpl_A8BMxfWfFhXoUBvfZtSjG6eVqodA` reached READY and was aliased to `gitbookai.ccwu.cc`.

## Verification
- Build logs show `Build Completed in /vercel/output` and deployment completed.
- `https://gitbookai.ccwu.cc/en`, `/zh-Hant`, `/ja`, and `/ko` all returned HTTP 200.

## Next If Recurs
- First retry with Vercel redeploy/no-cache.
- If repeated, pin project build settings in repo with `vercel.json` or contact Vercel support with deployment IDs.
