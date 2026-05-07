# 软件下载功能开发文档

本文档用于在另一个网站中复刻当前项目的软件下载与后台下载管理能力。目标是让运营人员能在后台发布软件版本，前端用户能在首页和版本归档页下载最新或历史版本。

## 1. 功能范围

### 前台用户

- 首页展示最新已发布版本号、发布日期、macOS 下载按钮、Windows 下载按钮。
- 支持主下载地址和备用下载地址。
- 如果后台没有发布版本，首页使用配置里的兜底下载链接。
- 版本归档页展示所有已发布版本，按发布日期倒序排列。
- 只展示 `is_published = true` 的版本。

### 后台运营

- 创建软件版本：版本号、发布日期、更新说明、发布状态。
- 支持两种交付方式：
  - `file`：上传 macOS 与 Windows 安装包到对象存储。
  - `link`：填写 macOS 与 Windows 主下载 URL，可选备用 URL。
- 切换版本发布状态：发布 / 下架。
- 后台列表可查看版本信息、交付方式、下载资源。

## 2. 数据模型

推荐使用两张业务表和一个公开对象存储 bucket。

### `software_releases`

```sql
create type software_release_platform as enum ('macos', 'windows');

create table public.software_releases (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  released_at date not null,
  notes text,
  is_published boolean not null default false,
  delivery_mode text not null default 'file',
  macos_primary_url text,
  macos_backup_url text,
  windows_primary_url text,
  windows_backup_url text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint software_releases_delivery_mode_check check (delivery_mode in ('file', 'link'))
);

create index software_releases_published_date_idx
on public.software_releases (is_published, released_at desc, created_at desc);
```

### `software_release_assets`

```sql
create table public.software_release_assets (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references public.software_releases(id) on delete cascade,
  platform software_release_platform not null,
  file_name text not null,
  storage_path text not null,
  file_size bigint,
  created_at timestamptz not null default now(),
  unique (release_id, platform)
);

create index software_release_assets_release_id_idx
on public.software_release_assets (release_id);
```

### Storage bucket

```sql
insert into storage.buckets (id, name, public)
values ('software-releases', 'software-releases', true)
on conflict (id) do update set public = true;
```

文件路径建议：

```text
software-releases/{release_id}/{platform}/{sanitized_file_name}
```

示例：

```text
software-releases/2d6c.../macos/MyApp-1.2.0.dmg
software-releases/2d6c.../windows/MyApp-1.2.0.exe
```

## 3. 权限策略

核心原则：

- 公开用户只能读取已发布版本。
- 管理员可读写所有版本和资源。
- bucket 可以公开读，写入、更新、删除仅管理员。

```sql
alter table public.software_releases enable row level security;
alter table public.software_release_assets enable row level security;

create policy "software_releases_public_read_published_or_admin"
  on public.software_releases
  for select
  using (is_published = true or public.is_admin());

create policy "software_releases_admin_insert"
  on public.software_releases
  for insert
  with check (public.is_admin());

create policy "software_releases_admin_update"
  on public.software_releases
  for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "software_release_assets_public_read_published_or_admin"
  on public.software_release_assets
  for select
  using (
    public.is_admin()
    or exists (
      select 1
      from public.software_releases
      where software_releases.id = software_release_assets.release_id
        and software_releases.is_published = true
    )
  );

create policy "software_release_assets_admin_insert"
  on public.software_release_assets
  for insert
  with check (public.is_admin());
```

## 4. 后端类型与查询封装

建议建立独立模块，例如：

```text
src/lib/releases/software-releases.ts
```

核心类型：

```ts
export const SOFTWARE_RELEASES_BUCKET = "software-releases";

export type ReleasePlatform = "macos" | "windows";
export type ReleaseDeliveryMode = "file" | "link";

export type SoftwareReleaseAsset = {
  id: string;
  platform: ReleasePlatform;
  fileName: string;
  storagePath: string;
  fileSize: number | null;
  downloadUrl: string;
};

export type SoftwareRelease = {
  id: string;
  version: string;
  releasedAt: string;
  notes: string | null;
  deliveryMode: ReleaseDeliveryMode;
  macosPrimaryUrl: string | null;
  macosBackupUrl: string | null;
  windowsPrimaryUrl: string | null;
  windowsBackupUrl: string | null;
  isPublished?: boolean;
  assets: SoftwareReleaseAsset[];
};
```

下载地址解析：

```ts
export function getPlatformDelivery(release: SoftwareRelease | null, platform: ReleasePlatform) {
  if (!release) return null;

  if (release.deliveryMode === "link") {
    return platform === "macos"
      ? { primaryUrl: release.macosPrimaryUrl, backupUrl: release.macosBackupUrl, source: "link" as const }
      : { primaryUrl: release.windowsPrimaryUrl, backupUrl: release.windowsBackupUrl, source: "link" as const };
  }

  const asset = release.assets.find((entry) => entry.platform === platform);
  return {
    primaryUrl: asset?.downloadUrl ?? null,
    backupUrl: null,
    source: "file" as const,
  };
}
```

公开查询：

```ts
const RELEASE_SELECT =
  "id,version,released_at,notes,delivery_mode,macos_primary_url,macos_backup_url,windows_primary_url,windows_backup_url,is_published,software_release_assets(id,platform,file_name,storage_path,file_size)";

export async function getLatestPublishedRelease(client: ReleaseClient) {
  const { data, error } = await client
    .from("software_releases")
    .select(RELEASE_SELECT)
    .eq("is_published", true)
    .order("released_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw error;
  return data?.[0] ? mapRelease(data[0], client) : null;
}
```

## 5. 前台页面设计

### 首页下载区

数据来源：

- 优先取最新已发布版本。
- 如果查询失败或没有版本，使用配置兜底链接。
- 如果某个平台缺少下载地址，按钮置灰或隐藏。

建议展示：

- 产品标题和简介。
- `Download for macOS`
- `Download for Windows`
- 备用下载按钮，仅当存在 backup URL 时展示。
- 最新版本文案，例如：`Latest version v1.2.0 · May 7, 2026`
- 历史版本入口：`Older versions`

### 版本归档页

路径建议：

```text
/versions
```

展示字段：

- 版本号
- 发布日期
- 更新说明
- macOS 主下载 / 备用下载
- Windows 主下载 / 备用下载

空状态：

```text
No releases are published yet.
```

## 6. 后台管理页面

路径建议：

```text
/admin/releases
```

### 创建表单字段

- `version`：必填，例如 `v1.2.0`
- `released_at`：必填，格式 `YYYY-MM-DD`
- `notes`：可选，建议限制 4000 字符以内
- `delivery_mode`：必填，`file` 或 `link`
- `is_published`：可选 checkbox

当 `delivery_mode = file`：

- `macos_file`：必填
- `windows_file`：必填

当 `delivery_mode = link`：

- `macos_primary_url`：必填
- `windows_primary_url`：必填
- `macos_backup_url`：可选
- `windows_backup_url`：可选

### 后台列表

每个版本建议显示：

- 版本号
- 发布 / 未发布状态
- 交付方式：上传文件 / 外部链接
- 发布日期
- 更新说明
- macOS 与 Windows 下载资源
- 发布 / 下架按钮

## 7. 服务端 Action 逻辑

创建版本时的流程：

1. 校验管理员权限。
2. 读取并校验表单字段。
3. 如果是 `file` 模式，要求同时上传 macOS 和 Windows 文件。
4. 如果是 `link` 模式，要求两个主 URL，备用 URL 不能与主 URL 相同。
5. 插入 `software_releases`。
6. `file` 模式上传安装包到 Storage，并写入 `software_release_assets`。
7. 刷新首页、版本归档页、后台 releases 页缓存。
8. 返回成功提示。

发布状态切换流程：

1. 校验管理员权限。
2. 根据 `release_id` 更新 `is_published`。
3. 刷新首页、版本归档页、后台 releases 页缓存。
4. 返回成功提示。

关键校验函数：

```ts
export function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._ -]+/g, "-").replace(/\s+/g, "-");
}

export function getReleaseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Release date must use YYYY-MM-DD");
  }
  return value;
}

export function validateReleaseUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Enter a valid URL");
  }
  return value;
}
```

## 8. 缓存策略

推荐：

- 首页最新版本缓存 300 秒。
- 版本列表缓存 300 秒。
- 创建版本和切换发布状态后主动 revalidate。

Next.js 示例：

```ts
import { unstable_cache } from "next/cache";

export const getCachedLatestPublishedRelease = unstable_cache(
  async () => getLatestPublishedRelease(createPublicClient()),
  ["latest-published-release"],
  {
    revalidate: 300,
    tags: ["software-releases"],
  },
);
```

创建或更新后：

```ts
revalidatePath(`/${locale}`);
revalidatePath(`/${locale}/versions`);
revalidatePath(`/${locale}/admin/releases`);
```

## 9. 多语言文案

至少需要以下翻译 namespace：

```json
{
  "home": {
    "downloadMac": "Download for macOS",
    "downloadWindows": "Download for Windows",
    "latestVersion": "Latest version {version} · {date}",
    "latestVersionPending": "Latest release information is coming soon.",
    "olderVersions": "Older versions"
  },
  "versions": {
    "title": "Release archive",
    "subtitle": "Download previous builds for macOS and Windows.",
    "downloadMac": "macOS",
    "downloadWindows": "Windows",
    "empty": "No releases are published yet.",
    "releases": {
      "primaryLink": "Primary",
      "backupLink": "Backup"
    }
  },
  "admin": {
    "releases": {
      "title": "Software releases",
      "createTitle": "Create release",
      "version": "Version",
      "releasedAt": "Release date",
      "notes": "Release notes",
      "deliveryMode": "Delivery mode",
      "deliveryModeFile": "Upload files",
      "deliveryModeLink": "Use download links",
      "macFile": "macOS installer",
      "windowsFile": "Windows installer",
      "macPrimaryUrl": "macOS primary URL",
      "macBackupUrl": "macOS backup URL",
      "windowsPrimaryUrl": "Windows primary URL",
      "windowsBackupUrl": "Windows backup URL",
      "published": "Published",
      "publish": "Publish",
      "unpublish": "Unpublish",
      "create": "Create release",
      "assets": "Assets"
    }
  }
}
```

## 10. 测试清单

### 单元测试

- `getLatestPublishedRelease` 只返回已发布最新版本。
- `getPublishedReleases` 按发布日期倒序返回。
- `getPlatformDelivery` 在 `file` 模式返回 Storage public URL。
- `getPlatformDelivery` 在 `link` 模式返回主 URL 和备用 URL。
- 后台交付方式表单切换时，只显示对应字段。
- 创建 `file` 模式版本时，缺少任一平台文件应失败。
- 创建 `link` 模式版本时，缺少任一主 URL 应失败。
- 备用 URL 与主 URL 相同时应失败。
- 发布状态切换后调用页面缓存刷新。

### 页面测试

- 首页展示 macOS 和 Windows 下载按钮。
- 首页存在 backup URL 时展示备用下载。
- 版本归档页展示所有已发布版本。
- 没有发布版本时展示空状态。
- 后台 releases 页显示创建表单和版本列表。

### 数据库测试

- migration 包含 `software_releases`。
- migration 包含 `software_release_assets`。
- migration 包含 `software-releases` bucket。
- RLS policy 限制公开用户只能读已发布版本。

## 11. 上线检查

- Supabase migration 已应用。
- `software-releases` bucket 为 public。
- 管理员角色函数 `is_admin()` 可用。
- 前端兜底下载链接已配置。
- 上传文件大小没有超过平台限制。
- CDN 或对象存储 public URL 可直接访问。
- 创建一个未发布版本确认前台不可见。
- 发布后确认首页和版本归档页可见。
- 下架后确认前台不可见。

## 12. 推荐迭代

第一阶段只做当前能力：

- macOS / Windows 两个平台。
- 上传文件或外链二选一。
- 发布 / 下架。
- 首页最新版本 + 版本归档页。

第二阶段可增加：

- SHA256 校验值。
- 文件大小格式化显示。
- 架构标签，例如 Apple Silicon、Intel、x64、arm64。
- 下载统计。
- 强制登录下载。
- 灰度发布。
- 私有 bucket + 签名下载链接。

