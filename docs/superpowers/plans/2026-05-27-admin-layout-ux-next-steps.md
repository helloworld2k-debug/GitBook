# Admin Layout UX Next Steps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把后台布局 UX 审计转成可执行的后续工作：先确认已经落地的 P1 改造，再推进剩余的 workbench 统一、状态语义和总览运营信号。

**Architecture:** 当前源码已经包含分组侧边栏、`AdminDataWorkbench`、`AdminTableShell cardsUntil="lg"` 等核心布局原语。本计划不重复改这些已完成项，而是把它们纳入验收基线，然后在相同组件体系上增加更统一的 workbench header、状态 badge 语义和 overview attention 区块。

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS classes, lucide-react, Vitest, Testing Library.

---

## 当前判断

graphify 结果显示 `AdminSubmitButton()` 是后台表单的核心复用点，但这不是优先问题。它统一处理提交 pending、禁用状态和无障碍 live region，当前应保留。

真正应该继续推进的是 UX audit 中的后台布局系统化工作。当前源码已经完成或部分完成：

- 已完成：侧边栏按任务区分组，`Support settings` 使用 `LifeBuoy`，不再和反馈共用图标。
- 已完成：`AdminStandardPage` 与 `AdminDataWorkbench` 已存在。
- 已完成：`AdminTableShell` 支持 `cardsUntil="lg"`。
- 已完成：用户、许可证、支持反馈页面已使用 `AdminDataWorkbench` 和宽表格的 `cardsUntil="lg"`。
- 待推进：筛选、批量操作、导出、结果摘要的位置仍然逐页拼装。
- 待推进：总览页需要从“目录”进一步变成运营仪表盘。
- 待推进：状态颜色需要更明确的语义分组和可选非颜色辅助。

## Files And Responsibilities

- `src/components/admin/admin-shell.tsx`
  - 已承载 shell、导航、页面宽度原语、表格壳、状态 badge。
  - 后续只做小范围增强，避免继续让这个文件无限膨胀。

- `src/components/admin/admin-workbench-header.tsx`
  - 新建共享 workbench header。
  - 负责标题、结果摘要、主操作、次操作、筛选区、批量操作区的统一结构。

- `src/components/admin/admin-status-badge.tsx`
  - 可选新建。如果状态 badge 继续增长，从 `admin-shell.tsx` 拆出。
  - 负责状态 tone、可选图标、语义组。

- `src/app/[locale]/admin/users/page.tsx`
  - 首个 workbench header 迁移页面。
  - 这里内容最复杂，适合作为模式验证页。

- `src/app/[locale]/admin/licenses/page.tsx`
  - 第二个 workbench header 迁移页面。
  - 需要特别注意筛选多、诊断表格多，避免一次重构过大。

- `src/app/[locale]/admin/support-feedback/page.tsx`
  - 第三个 workbench header 迁移页面。
  - 筛选较简单，适合验证简单页面也能用同一结构。

- `src/app/[locale]/admin/page.tsx`
  - 增加 overview attention 区块。
  - 让总览页优先呈现“需要处理什么”，而不是只有导航目录。

- `tests/unit/admin-shell.test.tsx`
  - 保护 shell、导航分组、页面宽度原语、表格断点。

- `tests/unit/admin-layout-alignment.test.ts`
  - 保护关键页面继续使用 `AdminDataWorkbench` 和 `cardsUntil="lg"`。

- `tests/unit/admin-workbench-header.test.tsx`
  - 新建，保护 workbench header 的层级、slot 渲染和可访问标签。

- `tests/unit/admin-pages.test.tsx`
  - 根据需要补总览 attention 文案和结构断言。

---

### Task 1: 验收当前 P1 布局基线

**Files:**
- Read: `src/components/admin/admin-shell.tsx`
- Read: `src/app/[locale]/admin/users/page.tsx`
- Read: `src/app/[locale]/admin/licenses/page.tsx`
- Read: `src/app/[locale]/admin/support-feedback/page.tsx`
- Test: `tests/unit/admin-shell.test.tsx`
- Test: `tests/unit/admin-layout-alignment.test.ts`

- [ ] **Step 1: 运行 shell 与布局基线测试**

```bash
npm test -- tests/unit/admin-shell.test.tsx tests/unit/admin-layout-alignment.test.ts
```

Expected: 两个测试文件全部通过。

- [ ] **Step 2: 确认侧边栏分组仍存在**

Check `src/components/admin/admin-shell.tsx` contains:

```tsx
function getAdminGroups(labels: AdminShellLabels) {
  const groupLabels = labels.navGroups ?? {
    content: "Content",
    operations: "Operations",
    overview: "Overview",
    trust: "Trust & Support",
  };
```

Expected: `Overview`、`Operations`、`Content`、`Trust & Support` 四组都存在。

- [ ] **Step 3: 确认宽页面原语仍存在**

Check `src/components/admin/admin-shell.tsx` contains:

```tsx
export function AdminStandardPage({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`mx-auto max-w-7xl ${className}`}>{children}</section>;
}

export function AdminDataWorkbench({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`mx-auto w-full max-w-[1600px] ${className}`}>{children}</section>;
}
```

Expected: 标准页面和数据页面有清晰分离。

- [ ] **Step 4: 确认宽表格保持 lg 前卡片模式**

Check `src/components/admin/admin-shell.tsx` contains:

```tsx
const cardVisibilityClass = cardsUntil === "lg" ? "lg:hidden" : "md:hidden";
const tableVisibilityClass = cardsUntil === "lg" ? "hidden lg:block" : "hidden md:block";
```

Expected: 用户、许可证、支持反馈这类宽表格可以在 768-1023px 继续显示卡片。

- [ ] **Step 5: Commit 验收记录**

如果本任务没有代码变更，不需要 commit。若为了修正测试或小问题产生修改：

```bash
git add src/components/admin/admin-shell.tsx tests/unit/admin-shell.test.tsx tests/unit/admin-layout-alignment.test.ts
git commit -m "test: verify admin layout p1 baseline"
```

---

### Task 2: 建立共享 AdminWorkbenchHeader

**Files:**
- Create: `src/components/admin/admin-workbench-header.tsx`
- Test: `tests/unit/admin-workbench-header.test.tsx`

- [ ] **Step 1: 写失败测试**

Create `tests/unit/admin-workbench-header.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminWorkbenchHeader } from "@/components/admin/admin-workbench-header";

describe("AdminWorkbenchHeader", () => {
  it("renders title, result summary, primary action, secondary actions, filters, and selection toolbar in stable regions", () => {
    render(
      <AdminWorkbenchHeader
        title="Users"
        description="Manage accounts and access."
        resultSummary="24 of 120 users"
        primaryAction={<a href="/admin/users/new">Create user</a>}
        secondaryActions={<button type="button">Export</button>}
        filters={<form aria-label="User filters"><input aria-label="Search users" /></form>}
        selectionToolbar={<div role="toolbar" aria-label="Bulk user actions">Bulk actions</div>}
      />,
    );

    expect(screen.getByRole("heading", { name: "Users" })).toBeInTheDocument();
    expect(screen.getByText("Manage accounts and access.")).toBeInTheDocument();
    expect(screen.getByText("24 of 120 users")).toBeInTheDocument();

    const actions = screen.getByRole("group", { name: "Workbench actions" });
    expect(within(actions).getByRole("link", { name: "Create user" })).toHaveAttribute("href", "/admin/users/new");
    expect(within(actions).getByRole("button", { name: "Export" })).toBeInTheDocument();

    expect(screen.getByRole("form", { name: "User filters" })).toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: "Bulk user actions" })).toBeInTheDocument();
  });

  it("omits optional regions when they are not provided", () => {
    render(<AdminWorkbenchHeader title="Feedback" resultSummary="8 threads" />);

    expect(screen.getByRole("heading", { name: "Feedback" })).toBeInTheDocument();
    expect(screen.getByText("8 threads")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Workbench actions" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("admin-workbench-filters")).not.toBeInTheDocument();
    expect(screen.queryByTestId("admin-workbench-selection-toolbar")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

```bash
npm test -- tests/unit/admin-workbench-header.test.tsx
```

Expected: FAIL because `@/components/admin/admin-workbench-header` does not exist.

- [ ] **Step 3: 新建最小实现**

Create `src/components/admin/admin-workbench-header.tsx`:

```tsx
type AdminWorkbenchHeaderProps = {
  description?: string;
  filters?: React.ReactNode;
  primaryAction?: React.ReactNode;
  resultSummary?: string;
  secondaryActions?: React.ReactNode;
  selectionToolbar?: React.ReactNode;
  title: string;
};

export function AdminWorkbenchHeader({
  description,
  filters,
  primaryAction,
  resultSummary,
  secondaryActions,
  selectionToolbar,
  title,
}: AdminWorkbenchHeaderProps) {
  const hasActions = Boolean(primaryAction || secondaryActions);

  return (
    <section className="grid gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-normal text-slate-950">{title}</h2>
          {description ? <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{description}</p> : null}
          {resultSummary ? <p className="mt-2 text-sm font-medium text-slate-500">{resultSummary}</p> : null}
        </div>
        {hasActions ? (
          <div aria-label="Workbench actions" className="flex flex-wrap items-center gap-2 lg:justify-end" role="group">
            {secondaryActions}
            {primaryAction}
          </div>
        ) : null}
      </div>
      {filters ? (
        <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm" data-testid="admin-workbench-filters">
          {filters}
        </div>
      ) : null}
      {selectionToolbar ? (
        <div data-testid="admin-workbench-selection-toolbar">
          {selectionToolbar}
        </div>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 4: 运行测试并确认通过**

```bash
npm test -- tests/unit/admin-workbench-header.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/admin-workbench-header.tsx tests/unit/admin-workbench-header.test.tsx
git commit -m "feat: add admin workbench header primitive"
```

---

### Task 3: 先把用户页迁移到 AdminWorkbenchHeader

**Files:**
- Modify: `src/app/[locale]/admin/users/page.tsx`
- Test: `tests/unit/admin-layout-alignment.test.ts`

- [ ] **Step 1: 写结构保护测试**

Append to `tests/unit/admin-layout-alignment.test.ts`:

```ts
  it("uses the shared workbench header on the users page", () => {
    const users = source("src/app/[locale]/admin/users/page.tsx");
    expect(users).toContain("AdminWorkbenchHeader");
    expect(users).toContain("selectionToolbar=");
    expect(users).toContain("filters=");
    expect(users).toContain("resultSummary=");
  });
```

- [ ] **Step 2: 运行测试并确认失败**

```bash
npm test -- tests/unit/admin-layout-alignment.test.ts
```

Expected: FAIL because users page has not imported or rendered `AdminWorkbenchHeader`.

- [ ] **Step 3: 迁移用户页局部布局**

In `src/app/[locale]/admin/users/page.tsx`, add import:

```tsx
import { AdminWorkbenchHeader } from "@/components/admin/admin-workbench-header";
```

Then wrap the existing user filters and bulk toolbar into:

```tsx
<AdminWorkbenchHeader
  title={t("usersTitle")}
  description={t("usersDescription")}
  resultSummary={t("usersSummary", { shown: String(profiles.length), total: String(filteredCount) })}
  filters={
    <AdminUserFilters
      actionPath={`/${locale}/admin/users`}
      labels={{
        apply: t("applyFilters"),
        clear: t("clearFilters"),
        moreFilters: t("moreFilters"),
        role: t("filterRole"),
        search: t("filterSearch"),
        status: t("filterStatus"),
        type: t("filterType"),
      }}
      values={feedback}
    />
  }
  selectionToolbar={
    <AdminUserBulkToolbar
      formId="bulk-users-bulk-action-form"
      labels={{
        bulkArchiveDelete: t("bulkArchiveDelete"),
        bulkArchiveDeleteSelected: t("bulkArchiveDeleteSelected"),
        bulkDisable: t("bulkDisable"),
        bulkEnable: t("bulkEnable"),
        bulkRole: t("bulkChangeRole"),
        bulkSoftDelete: t("bulkSoftDelete"),
        bulkSoftDeleteSelected: t("bulkSoftDeleteSelected"),
        bulkType: t("bulkChangeType"),
        bulkEnableConfirm: t("bulkEnableConfirm"),
        bulkDisableConfirm: t("bulkDisableConfirm"),
        bulkRoleConfirm: t("bulkRoleConfirm"),
      }}
    />
  }
/>
```

Keep the existing hidden bulk form and table markup unchanged. If exact translation keys differ in the file, reuse the existing keys already present on the page rather than inventing new messages.

- [ ] **Step 4: 运行相关测试**

```bash
npm test -- tests/unit/admin-layout-alignment.test.ts tests/unit/admin-shell.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/[locale]/admin/users/page.tsx tests/unit/admin-layout-alignment.test.ts
git commit -m "refactor: use workbench header on users admin page"
```

---

### Task 4: 迁移支持反馈页，验证简单页面适配

**Files:**
- Modify: `src/app/[locale]/admin/support-feedback/page.tsx`
- Test: `tests/unit/admin-layout-alignment.test.ts`

- [ ] **Step 1: 写结构保护测试**

Extend the workbench header test in `tests/unit/admin-layout-alignment.test.ts`:

```ts
    const supportFeedback = source("src/app/[locale]/admin/support-feedback/page.tsx");
    expect(supportFeedback).toContain("AdminWorkbenchHeader");
    expect(supportFeedback).toContain("filters=");
    expect(supportFeedback).toContain("resultSummary=");
```

- [ ] **Step 2: 运行测试并确认失败**

```bash
npm test -- tests/unit/admin-layout-alignment.test.ts
```

Expected: FAIL because support feedback page has not been migrated.

- [ ] **Step 3: 迁移支持反馈页**

In `src/app/[locale]/admin/support-feedback/page.tsx`, add import:

```tsx
import { AdminWorkbenchHeader } from "@/components/admin/admin-workbench-header";
```

Move the all/unread filter links into the `filters` slot:

```tsx
<AdminWorkbenchHeader
  title={t("supportFeedbackTitle")}
  description={t("supportFeedbackDescription")}
  resultSummary={t("supportFeedbackSummary", { shown: String(visibleFeedback.length), total: String(feedbackWithUnreadState.length) })}
  filters={
    <div className="flex flex-wrap items-center gap-2">
      <Link
        className={`inline-flex min-h-10 items-center rounded-md border px-3 text-sm font-medium ${
          filter === "all" ? "border-slate-950 bg-slate-950 text-white" : "border-slate-300 bg-white text-slate-700"
        }`}
        href={buildFilterUrl(null)}
      >
        {t("supportFeedbackAll")}
      </Link>
      <Link
        className={`inline-flex min-h-10 items-center rounded-md border px-3 text-sm font-medium ${
          filter === "unread" ? "border-slate-950 bg-slate-950 text-white" : "border-slate-300 bg-white text-slate-700"
        }`}
        href={buildFilterUrl("unread")}
      >
        {t("supportFeedbackUnread")}
      </Link>
    </div>
  }
/>
```

If exact translation keys differ, reuse the current keys in the file.

- [ ] **Step 4: 运行测试**

```bash
npm test -- tests/unit/admin-layout-alignment.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/[locale]/admin/support-feedback/page.tsx tests/unit/admin-layout-alignment.test.ts
git commit -m "refactor: use workbench header on support feedback"
```

---

### Task 5: 暂缓许可证页大迁移，只做结构边界

**Files:**
- Modify: `src/app/[locale]/admin/licenses/page.tsx`
- Test: `tests/unit/admin-layout-alignment.test.ts`

- [ ] **Step 1: 写轻量结构测试**

Add to `tests/unit/admin-layout-alignment.test.ts`:

```ts
  it("keeps license management in wide workbench mode without forcing a full header migration yet", () => {
    const licenses = source("src/app/[locale]/admin/licenses/page.tsx");
    expect(licenses).toContain("<AdminDataWorkbench>");
    expect(licenses).toContain('<AdminTableShell cardsUntil="lg"');
    expect(licenses).toContain("AdminLicenseBulkToolbar");
  });
```

- [ ] **Step 2: 运行测试**

```bash
npm test -- tests/unit/admin-layout-alignment.test.ts
```

Expected: PASS. If this fails, fix only the missing baseline, not a full license layout rewrite.

- [ ] **Step 3: 记录许可证页后续迁移边界**

Add a short comment near the management section in `src/app/[locale]/admin/licenses/page.tsx`:

```tsx
// Keep license management migration incremental: this page has multiple diagnostics tables,
// so move filters and bulk actions into AdminWorkbenchHeader only after users/support feedback settle.
```

- [ ] **Step 4: Commit**

```bash
git add src/app/[locale]/admin/licenses/page.tsx tests/unit/admin-layout-alignment.test.ts
git commit -m "docs: mark incremental license workbench migration boundary"
```

---

### Task 6: 给总览页增加 Attention 区块

**Files:**
- Modify: `src/app/[locale]/admin/page.tsx`
- Modify: `messages/en.json`
- Modify: `messages/zh-Hant.json`
- Modify: `messages/ja.json`
- Modify: `messages/ko.json`
- Test: `tests/unit/admin-pages.test.tsx`

- [ ] **Step 1: 写页面测试**

In `tests/unit/admin-pages.test.tsx`, add assertions to the admin overview test:

```tsx
expect(screen.getByRole("heading", { name: /Needs attention|需要處理|対応が必要|확인 필요/i })).toBeInTheDocument();
expect(screen.getByText(/Unread feedback|未讀回饋|未読フィードバック|읽지 않은 피드백/i)).toBeInTheDocument();
```

- [ ] **Step 2: 运行测试并确认失败**

```bash
npm test -- tests/unit/admin-pages.test.tsx
```

Expected: FAIL because attention section does not exist or messages are missing.

- [ ] **Step 3: 增加 messages**

Add keys under the existing admin overview message group in every locale:

```json
{
  "attentionTitle": "Needs attention",
  "attentionDescription": "Operational signals that may need follow-up.",
  "attentionUnreadFeedback": "Unread feedback",
  "attentionFailedReleases": "Failed releases",
  "attentionBlockedRedemptions": "Blocked redemptions",
  "attentionEmpty": "No urgent admin work right now."
}
```

Use localized values for zh-Hant, ja, and ko following nearby admin copy style.

- [ ] **Step 4: 实现 Attention 区块**

In `src/app/[locale]/admin/page.tsx`, render this before the directory/card grid:

```tsx
<AdminCard>
  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
    <div>
      <h2 className="text-base font-semibold text-slate-950">{t("attentionTitle")}</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">{t("attentionDescription")}</p>
    </div>
  </div>
  <div className="mt-4 grid gap-3 md:grid-cols-3">
    <div className="rounded-md border border-slate-200 p-3">
      <p className="text-sm font-medium text-slate-600">{t("attentionUnreadFeedback")}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{String(unreadFeedbackCount)}</p>
    </div>
    <div className="rounded-md border border-slate-200 p-3">
      <p className="text-sm font-medium text-slate-600">{t("attentionFailedReleases")}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{String(failedReleaseCount)}</p>
    </div>
    <div className="rounded-md border border-slate-200 p-3">
      <p className="text-sm font-medium text-slate-600">{t("attentionBlockedRedemptions")}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{String(blockedRedemptionCount)}</p>
    </div>
  </div>
</AdminCard>
```

Use existing variables if the page already computes these counts. If a count is not available yet, start with `0` and add a code comment naming the future data source.

- [ ] **Step 5: 运行测试**

```bash
npm test -- tests/unit/admin-pages.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/[locale]/admin/page.tsx messages/en.json messages/zh-Hant.json messages/ja.json messages/ko.json tests/unit/admin-pages.test.tsx
git commit -m "feat: add admin overview attention signals"
```

---

### Task 7: 状态 badge 语义增强

**Files:**
- Modify or Create: `src/components/admin/admin-status-badge.tsx`
- Modify: `src/components/admin/admin-shell.tsx`
- Test: `tests/unit/admin-shell.test.tsx`

- [ ] **Step 1: 写测试**

Add to `tests/unit/admin-shell.test.tsx`:

```tsx
import { AlertTriangle, CheckCircle2 } from "lucide-react";
```

Then add:

```tsx
it("can render admin status badges with non-color semantic icons", () => {
  render(
    <>
      <AdminStatusBadge icon={CheckCircle2} tone="success">Active</AdminStatusBadge>
      <AdminStatusBadge icon={AlertTriangle} tone="danger">Blocked</AdminStatusBadge>
    </>,
  );

  expect(screen.getByText("Active")).toBeInTheDocument();
  expect(screen.getByText("Blocked")).toBeInTheDocument();
  expect(screen.getByText("Active").parentElement).toHaveClass("bg-emerald-50");
  expect(screen.getByText("Blocked").parentElement).toHaveClass("bg-rose-50");
});
```

- [ ] **Step 2: 运行测试并确认失败**

```bash
npm test -- tests/unit/admin-shell.test.tsx
```

Expected: FAIL because `AdminStatusBadge` does not accept `icon`.

- [ ] **Step 3: 扩展 AdminStatusBadge props**

In `src/components/admin/admin-shell.tsx`, update `AdminStatusBadge`:

```tsx
type AdminStatusBadgeProps = {
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: "true" }>;
  tone?: "danger" | "neutral" | "success" | "warning";
};

export function AdminStatusBadge({ children, icon: Icon, tone = "neutral" }: AdminStatusBadgeProps) {
  const toneClass = {
    danger: "bg-rose-50 text-rose-700 ring-rose-100",
    neutral: "bg-slate-100 text-slate-700 ring-slate-200",
    success: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    warning: "bg-amber-50 text-amber-800 ring-amber-100",
  }[tone];

  return (
    <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold ring-1 ${toneClass}`}>
      {Icon ? <Icon aria-hidden="true" className="size-3.5 shrink-0" /> : null}
      {children}
    </span>
  );
}
```

- [ ] **Step 4: 运行测试**

```bash
npm test -- tests/unit/admin-shell.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/admin-shell.tsx tests/unit/admin-shell.test.tsx
git commit -m "feat: support semantic icons in admin status badges"
```

---

### Task 8: 最终验证

**Files:**
- Verify only.

- [ ] **Step 1: 运行相关单元测试**

```bash
npm test -- tests/unit/admin-shell.test.tsx tests/unit/admin-layout-alignment.test.ts tests/unit/admin-workbench-header.test.tsx tests/unit/admin-pages.test.tsx
```

Expected: PASS.

- [ ] **Step 2: 运行 lint**

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 3: 运行完整测试套件**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 4: 手动视觉验收**

Run:

```bash
npm run dev
```

Open these pages at 375px, 768px, 1024px, and 1440px:

- `/en/admin`
- `/en/admin/users`
- `/en/admin/licenses`
- `/en/admin/support-feedback`

Expected:

- 375px: mobile nav works, no body-level horizontal scroll.
- 768px: dense user/license/support feedback records use card mode, not 1500px tables.
- 1024px: dense tables can appear, horizontal scroll is contained inside table region.
- 1440px: data pages use wide content area instead of feeling squeezed into standard content width.

- [ ] **Step 5: Commit final verification notes if docs changed**

If this plan or the audit doc is updated with completion notes:

```bash
git add docs/superpowers/plans/2026-05-27-admin-layout-ux-next-steps.md .worktrees/admin-layout-ux-audit/docs/design/admin-layout-ux-audit-2026-05-26.zh-CN.md
git commit -m "docs: record admin layout ux execution plan"
```

---

## Recommended Execution Order

1. Task 1: 先验收当前 P1 基线。
2. Task 2: 新建 `AdminWorkbenchHeader`。
3. Task 3: 用户页迁移，作为复杂页面样板。
4. Task 4: 支持反馈页迁移，验证简单页面也适用。
5. Task 5: 许可证页暂不大改，只保留边界和测试。
6. Task 6: 总览 attention 区块。
7. Task 7: 状态 badge 语义增强。
8. Task 8: 最终验证。

## Do Not Do Yet

- 不要现在重构 `AdminSubmitButton()`。它目前是合理的共享提交状态组件。
- 不要一次性重写许可证页。它的表格和诊断区太多，适合等用户页、支持反馈页稳定后再迁移。
- 不要把所有 admin 页面强行统一成完全一样的布局。目标是统一操作层级，不是消灭页面差异。
- 不要让 `admin-shell.tsx` 继续承载所有新组件。新 workbench 原语应放到独立文件。

## Self-Review

- Spec coverage: 覆盖了 audit 中已落地的 P1 基线、剩余 workbench 统一、总览 attention、状态 badge 非颜色辅助。
- Placeholder scan: 没有 TBD/TODO/以后再说式占位；许可证页明确选择“暂缓大迁移”并有保护任务。
- Type consistency: `AdminWorkbenchHeader` props 在测试与实现中一致；`AdminStatusBadge` 的 `icon` 类型与 lucide-react 图标兼容。
