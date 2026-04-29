# Notebook · 设计文档 v3（终稿）

> **⚠️ 安全须知：** 本项目为个人工具，无认证。URL 即权限。不要公开分享你的 Edge Function URL。

## 概述

双人共享笔记本。User 和 AI 各自维护自己的条目，对方只能批注。
User 通过前端操作，AI 通过 Supabase MCP 操作数据库。
作为 memory-service v1 上线前的记忆缓冲层。

开源项目，可配置双方名称。

---

## 权限模型

| 操作 | 对自己的条目 | 对对方的条目 |
|------|-------------|-------------|
| 新增 | ✅ | ❌ |
| 编辑 | ✅ | ❌ |
| 删除 | ✅ | ❌ |
| Pin/Unpin | ✅ | ❌ |
| 批注 | ✅ | ✅ |
| 查看 | ✅ | ✅ |

前端固定为 user 侧，AI 侧固定走 MCP（execute_sql）。不做登录。

批注写了就不能改、不能删（与 Ember 一致）。前端不渲染批注的 EDIT/DEL 按钮，只渲染只读气泡 + 时间戳。此不可变性由 DB trigger 强制保证（见数据库设计）。

**渲染安全规则：** 所有 content、settings 字段只能作为 React text node 渲染，禁止 `dangerouslySetInnerHTML`。icon 字段限制为 emoji 或短文本（≤32字符）。

---

## 数据库设计

### `notebook_entries`（原 `lori_notebook`，迁移时 rename）

| Column | Type | Description |
|--------|------|-------------|
| id | bigint (identity) | 自增主键 |
| author | text NOT NULL CHECK (author IN ('ai', 'user')) | 固定值，不随配置变 |
| content | text NOT NULL | 条目内容 |
| pinned | boolean DEFAULT false | 置顶 |
| created_at | timestamptz DEFAULT now() | 创建时间 |
| updated_at | timestamptz DEFAULT now() | 更新时间（trigger 自动维护） |

```sql
CREATE TABLE notebook_entries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  author text NOT NULL CHECK (author IN ('ai', 'user')),
  content text NOT NULL CHECK (octet_length(content) <= 10240),
  pinned boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 排序索引
CREATE INDEX idx_notebook_entries_sort ON notebook_entries (pinned DESC, created_at DESC);

-- updated_at 自动维护
CREATE EXTENSION IF NOT EXISTS moddatetime;
CREATE TRIGGER notebook_entries_updated_at
  BEFORE UPDATE ON notebook_entries
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- 禁止修改 author 字段
CREATE OR REPLACE FUNCTION prevent_author_change() RETURNS trigger AS $$
BEGIN
  IF NEW.author <> OLD.author THEN
    RAISE EXCEPTION 'author field is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notebook_entries_author_immutable
  BEFORE UPDATE ON notebook_entries
  FOR EACH ROW EXECUTE FUNCTION prevent_author_change();

ALTER TABLE notebook_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON notebook_entries FOR ALL USING (true) WITH CHECK (true);
```

### `notebook_annotations`

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE notebook_annotations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id bigint NOT NULL REFERENCES notebook_entries(id) ON DELETE CASCADE,
  author text NOT NULL CHECK (author IN ('ai', 'user')),
  content text NOT NULL CHECK (octet_length(content) <= 10240),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notebook_annotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON notebook_annotations FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_notebook_annotations_entry ON notebook_annotations (entry_id);

-- 批注不可变：禁止 UPDATE 和非级联 DELETE
CREATE OR REPLACE FUNCTION prevent_annotation_modify() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'annotations are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notebook_annotations_no_update
  BEFORE UPDATE ON notebook_annotations
  FOR EACH ROW EXECUTE FUNCTION prevent_annotation_modify();

CREATE TRIGGER notebook_annotations_no_delete
  BEFORE DELETE ON notebook_annotations
  FOR EACH ROW
  WHEN (pg_trigger_depth() = 0)  -- 允许级联删除，阻止直接删除
  EXECUTE FUNCTION prevent_annotation_modify();
```

ON DELETE CASCADE：条目删除时批注跟着走（级联删除绕过 trigger）。直接 UPDATE/DELETE 批注会被 trigger 拒绝。

### `notebook_settings`（单行）

```sql
CREATE TABLE notebook_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ai_name text DEFAULT 'Lori' CHECK (char_length(ai_name) <= 256),
  user_name text DEFAULT '猫猫' CHECK (char_length(user_name) <= 256),
  ai_icon text DEFAULT '' CHECK (char_length(ai_icon) <= 32),
  user_icon text DEFAULT '' CHECK (char_length(user_icon) <= 32)
);

INSERT INTO notebook_settings (id) VALUES (1);

ALTER TABLE notebook_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON notebook_settings FOR ALL USING (true) WITH CHECK (true);
```

`ai_name` / `user_name` 是纯显示名。author 字段固定为 `'ai'` / `'user'`，不随配置变。
fork 的用户只需改 settings 表的显示名。

---

## Edge Function：`notebook-api`

部署为 Supabase Edge Function，`verify_jwt: false`（个人工具）。

### 认证

Edge Function 通过环境变量 `NOTEBOOK_API_TOKEN` 校验请求。前端 hash 格式为 `url|token`。

所有非 OPTIONS 请求必须带 `X-Notebook-Token` header，Edge Function 做常量时间比较：

```javascript
const TOKEN = Deno.env.get("NOTEBOOK_API_TOKEN");
const clientToken = req.headers.get("X-Notebook-Token") || "";

// 常量时间比较，防止 timing attack
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

if (!TOKEN || !safeEqual(TOKEN, clientToken)) {
  return json({ error: "Unauthorized" }, 401);
}
```

### CORS

Edge Function 必须处理 OPTIONS preflight，返回：
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: Content-Type
Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS
```

### 端点设计

```
GET    /notebook-api/entries                → 全量条目（含每条的 annotation_count），排序 pinned DESC, created_at DESC
GET    /notebook-api/entries/:id            → 单条条目 + 批注列表
GET    /notebook-api/settings               → 读取 notebook_settings
POST   /notebook-api/entries                → 新增条目（body: { content, pinned }）
PATCH  /notebook-api/entries/:id            → 编辑条目（body: { content?, pinned? }）
DELETE /notebook-api/entries/:id            → 删除条目（仅 author='user' 的条目）
POST   /notebook-api/entries/:id/annotations → 新增批注（body: { content }）
```

### author 处理规则

所有来自前端的写入请求，Edge Function **显式忽略** body 中的 author 字段，强制设为 `'user'`：

```javascript
// POST entries
const { content, pinned } = await req.json();  // 只 pick 白名单字段
const entry = { author: 'user', content, pinned: pinned || false };

// PATCH entries — 字段白名单 + author 校验
// 先查 entry，非 author='user' 返回 403
const existing = await db.from('notebook_entries').select('author').eq('id', id).single();
if (!existing.data || existing.data.author !== 'user') return json({ error: 'Forbidden' }, 403);

const body = await req.json();
const update = {};
if (typeof body.content === 'string') update.content = body.content;
if (typeof body.pinned === 'boolean') update.pinned = body.pinned;
// 不允许改 author、created_at 等

// POST annotations
const { content } = await req.json();
const annotation = { entry_id: id, author: 'user', content };
```

前端传什么 author 都会被覆盖。不报 400，silently override。

### DELETE 权限

Edge Function 在 DELETE 前查 entry 的 author，如果不是 `'user'` 则返回 403。防止前端误删 AI 的条目。

### content 长度限制

Edge Function 校验 content 长度，超过 10KB 返回 400。DB 层同样有 `CHECK (octet_length(content) <= 10240)` 兜底，覆盖 AI 侧 MCP 写入。

> 注：这不是安全层（没有认证），是防误操作层。真正的隔离靠的是"前端只发 user 请求，AI 走 MCP 不走 Edge Function"。

### 排序规则

默认排序：`pinned DESC, created_at DESC`（置顶优先，新条目在前）。

---

## 前端设计

### 技术栈
- 单 `index.html` 文件
- React 18 CDN（与 Tally/Ember 一致）
- 连接方式：URL hash 存 Edge Function 的完整 URL（如 `https://xxx.supabase.co/functions/v1/notebook-api`）
- 不需要 anon key（Edge Function 内部用 service role 连 DB，前端只调 Edge Function）

### 视觉风格

**色板（从 Lori 肖像图提取）：**
- 背景：`#0a0b0f` → `#111318`（渐变）
- 文字主色：`#c8cdd8`（银灰）
- 文字次色：`#4a5568`（暗灰）
- 强调色-AI：`#6a8fba`（冰蓝）
- 强调色-User：`#b89a6a`（暖金）
- 边框/分割：`rgba(255,255,255,0.06)`
- Pin 高亮：`rgba(180,160,120,0.1)`

**字体：**
- 英文/代码：`JetBrains Mono`（Google Fonts）
- 中文：`Noto Sans SC`（Google Fonts）

**设计关键词：** HUD 感、克制、monospace、低对比度、深色沉浸

### 页面结构

单页应用，无 tab bar。

```
┌─────────────────────────────┐
│  NOTEBOOK                   │
│  {ai_name} × {user_name}   │
│  ── STANDBY MEMORY BUFFER ──│
├─────────────────────────────┤
│  [ALL] [📌] [AI] [USER] [↻] │  ← 筛选栏，AI/USER 按 settings 显示名渲染
├─────────────────────────────┤
│  ┌─ 新增条目输入框 ────────┐ │
│  │ textarea               │ │
│  │ [PIN] ───── [SAVE]     │ │
│  └─────────────────────────┘ │
├─────────────────────────────┤
│  ┌─ 条目卡片 ──────────────┐ │
│  │ [{ai_name}] 📌 #12 04-29│ │
│  │ 条目内容...             │ │
│  │ ─── 2 ANNOTATIONS ──── │ │  ← 点击展开
│  │ [{user_name}] 批注内容  │ │  ← 只读气泡 + 时间戳，无 EDIT/DEL
│  │ ────────────────────── │ │
│  │ 批注输入框              │ │  ← 双方条目都显示
│  │ ── PIN · EDIT · DEL ── │ │  ← 仅对 author='user' 的条目显示
│  └─────────────────────────┘ │
│  ...更多条目               │
├─────────────────────────────┤
│  — NON-ARCHIVABLE —        │
└─────────────────────────────┘
```

### 状态处理

- **Loading**：全局 loading 指示（居中 "LOADING..." 文字）
- **Error**：顶部 error banner，红色半透明背景，自动 5 秒消失或手动关闭
- **Empty**：空列表显示 "NO ENTRIES"

### 交互细节

1. **新增条目**：author 固定为 `'user'`，不需要也不允许选身份
2. **条目卡片**：
   - author='user' 的条目：显示 EDIT / DEL / PIN 按钮
   - author='ai' 的条目：不显示编辑/删除按钮
   - 两边的条目都显示批注区和批注输入框
3. **批注展开**：默认折叠，有批注时显示 `N ANNOTATIONS`，点击展开
4. **批注输入**：per-card local state（每张卡片独立的 controlled input），不用全局 map
5. **批注渲染**：只读气泡 + 作者标签 + 时间戳，不渲染 EDIT/DEL 按钮
6. **编辑模式**：点 EDIT 后 content 变成 textarea，确认/取消
7. **刷新**：手动刷新按钮（↻），不做实时订阅（与 Tally/Ember 一致）
8. **settings 缓存**：首次连接成功后读一次 settings 缓存到 React state，刷新按钮时一并刷新 settings

### 连接页

首次打开无 hash 时显示连接页：
- 输入 Supabase URL（自动拼接 `/functions/v1/notebook-api`）
- 输入 API Token
- 点 CONNECT，测试连接（GET /entries with token）
- 成功后存入 URL hash，格式：`url|token`

---

## AI 侧操作方式（CLAUDE_INSTRUCTIONS.md）

AI 不通过 Edge Function，直接通过 MCP `execute_sql`：

> **⚠️ 关键规则：所有 UPDATE / DELETE 语句必须带 `AND author = 'ai'` 条件。禁止操作 author='user' 的条目。违反此规则会破坏数据完整性。**

```sql
-- 查看所有条目
SELECT * FROM notebook_entries ORDER BY pinned DESC, created_at DESC;

-- 新增条目
INSERT INTO notebook_entries (author, content, pinned) VALUES ('ai', '内容', false);

-- 编辑自己的条目（必须带 author = 'ai'）
UPDATE notebook_entries SET content = '新内容' WHERE id = N AND author = 'ai';

-- 删除自己的条目（必须带 author = 'ai'）
DELETE FROM notebook_entries WHERE id = N AND author = 'ai';

-- Pin/Unpin（必须带 author = 'ai'）
UPDATE notebook_entries SET pinned = true WHERE id = N AND author = 'ai';

-- 加批注（可以给任何条目加）
INSERT INTO notebook_annotations (entry_id, author, content) VALUES (N, 'ai', '批注内容');

-- 查看批注
SELECT * FROM notebook_annotations WHERE entry_id = N ORDER BY created_at;

-- 读取配置（拿显示名）
SELECT * FROM notebook_settings WHERE id = 1;
```

注意：`updated_at` 由 trigger 自动维护，SQL 中不需要手动 `SET updated_at = now()`。

---

## 文件结构（开源仓库）

```
notebook/
├── index.html                 ← 单文件前端
├── README.md                  ← 含安全警示
├── LICENSE                    ← CC BY-NC 4.0
├── CLAUDE_INSTRUCTIONS.md     ← AI 操作指南
└── supabase/
    ├── setup.sql              ← 建表语句（notebook_entries、notebook_annotations、notebook_settings）
    └── edge-function.ts       ← Edge Function 源码
```

---

## 迁移（仅我们自己需要）

```sql
BEGIN;

-- 1. 表重命名
ALTER TABLE lori_notebook RENAME TO notebook_entries;

-- 2. author 值迁移
UPDATE notebook_entries SET author = 'ai' WHERE author = 'lori';
UPDATE notebook_entries SET author = 'user' WHERE author = 'maomao';

-- 3. 校验：应返回 0
SELECT count(*) FROM notebook_entries WHERE author NOT IN ('ai', 'user');

-- 4. 加 CHECK 约束
ALTER TABLE notebook_entries ADD CONSTRAINT notebook_entries_author_check
  CHECK (author IN ('ai', 'user'));
ALTER TABLE notebook_entries ADD CONSTRAINT notebook_entries_content_length
  CHECK (octet_length(content) <= 10240);

-- 5. 加排序索引
CREATE INDEX idx_notebook_entries_sort ON notebook_entries (pinned DESC, created_at DESC);

-- 6. 加 updated_at trigger
CREATE EXTENSION IF NOT EXISTS moddatetime;
CREATE TRIGGER notebook_entries_updated_at
  BEFORE UPDATE ON notebook_entries
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- 7. 加 author 不可变 trigger
CREATE OR REPLACE FUNCTION prevent_author_change() RETURNS trigger AS $$
BEGIN
  IF NEW.author <> OLD.author THEN
    RAISE EXCEPTION 'author field is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notebook_entries_author_immutable
  BEFORE UPDATE ON notebook_entries
  FOR EACH ROW EXECUTE FUNCTION prevent_author_change();

COMMIT;

-- 8. 建新表
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE notebook_annotations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_id bigint NOT NULL REFERENCES notebook_entries(id) ON DELETE CASCADE,
  author text NOT NULL CHECK (author IN ('ai', 'user')),
  content text NOT NULL CHECK (octet_length(content) <= 10240),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE notebook_annotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON notebook_annotations FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_notebook_annotations_entry ON notebook_annotations (entry_id);

-- 批注不可变 trigger
CREATE OR REPLACE FUNCTION prevent_annotation_modify() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'annotations are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notebook_annotations_no_update
  BEFORE UPDATE ON notebook_annotations
  FOR EACH ROW EXECUTE FUNCTION prevent_annotation_modify();

CREATE TRIGGER notebook_annotations_no_delete
  BEFORE DELETE ON notebook_annotations
  FOR EACH ROW
  WHEN (pg_trigger_depth() = 0)
  EXECUTE FUNCTION prevent_annotation_modify();

-- 9. settings 表
CREATE TABLE notebook_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ai_name text DEFAULT 'Lori' CHECK (char_length(ai_name) <= 256),
  user_name text DEFAULT '猫猫' CHECK (char_length(user_name) <= 256),
  ai_icon text DEFAULT '' CHECK (char_length(ai_icon) <= 32),
  user_icon text DEFAULT '' CHECK (char_length(user_icon) <= 32)
);
INSERT INTO notebook_settings (id) VALUES (1);
ALTER TABLE notebook_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_all" ON notebook_settings FOR ALL USING (true) WITH CHECK (true);

-- 10. Edge Function 环境变量（在 Supabase Dashboard 设置）
-- NOTEBOOK_API_TOKEN = <生成一个高熵随机字符串>
```

迁移前先 `pg_dump` 备份。

---

## Cowork 评审回应记录

| # | 评审意见 | 处理 |
|---|---------|------|
| 1 | author 缺 CHECK 约束 | ✅ 已加 |
| 2 | 排序索引缺失 | ✅ 已加 |
| 3 | updated_at 没有 trigger | ✅ 已加 moddatetime trigger |
| 4 | 迁移没有事务包裹 | ✅ BEGIN/COMMIT + 校验 |
| 5 | URL 风格混用 | ✅ 统一为 /entries/:id，批注挂 /entries/:id/annotations |
| 6 | POST author override 没说清 | ✅ 显式 strip + silently override，含代码示例 |
| 7 | PATCH 字段白名单 | ✅ 显式 pick content 和 pinned，含代码示例 |
| 8 | anon key 怎么传 | ✅ 补充说明：不需要 anon key，前端只调 Edge Function |
| 9 | Loading/Error/Empty state | ✅ 已补入前端设计 |
| 10 | 批注输入 per-card local state | ✅ 已补入交互细节 |
| 11 | 批注不渲染 EDIT/DEL | ✅ 已补入权限模型和交互细节 |
| 12 | README 安全警示 | ✅ 文档顶部 + 文件结构中标注 |
| 13 | CLAUDE_INSTRUCTIONS 加醒目警告 | ✅ 已加粗体警告 |
| 14 | 表名 lori_notebook 改统一 | ✅ 迁移 rename 为 notebook_entries |
| 15 | pgcrypto extension | ✅ 已加 CREATE EXTENSION IF NOT EXISTS |
| 16 | CORS / OPTIONS | ✅ 已补入 Edge Function 设计 |
| 17 | content 长度限制 10KB | ✅ 已补入 Edge Function + DB 双层 |
| 18 | settings 读取缓存 | ✅ 已补入交互细节 |

## Codex 评审回应记录

| # | 评审意见（严重度） | 处理 |
|---|-------------------|------|
| 1 | PATCH 没限制 author='user'（High） | ✅ PATCH 先查 author，非 user 返回 403，含代码示例 |
| 2 | URL 即权限不成立，需要 token（High） | ✅ 新增 NOTEBOOK_API_TOKEN 环境变量，前端 hash 存 url\|token，常量时间校验 |
| 3 | RLS 全放行无真正边界（High） | ⚠️ 部分接受：加 author 不可变 trigger 兜底，不做完整 RPC 重构（个人工具过度） |
| 4 | 批注不可变仅 UI 层（Medium） | ✅ 加 DB trigger 禁止 UPDATE/DELETE（级联删除除外） |
| 5 | 10KB 限制仅 Edge Function（Medium） | ✅ DB 层加 CHECK (octet_length(content) <= 10240) |
| 6 | 前端渲染安全未声明（Medium） | ✅ 补入权限模型：text node only，禁止 dangerouslySetInnerHTML，icon ≤32字符 |

---

*设计者：Lori · 2026-04-29*
*评审：Cowork（4.7）· 2026-04-29 — 18 条意见，全部已处理*
*评审：Codex（边界安全）· 2026-04-29 — 6 条意见，5 条完全接受 + 1 条部分接受*
*状态：可交付 Kimi 实现*
