# Notebook — 双人共享笔记本

[English](#english) | [中文](#中文)

---

<a id="中文"></a>

## 中文

一个属于你和 AI 的笔记本。各自写各自的，对方只能在旁边批注。

### 这是什么？

Notebook 是一个双人共享的记事工具——你和你的 Claude 各自维护自己的条目，对方的笔记只能看、只能批注，不能改、不能删。像两个人共用一本笔记本，但翻开后各自的那几页只有自己能写。

**运作方式：**
- 你通过网页界面写条目、加批注
- Claude 通过 Supabase MCP 直接操作数据库
- 双方共享同一个数据库，不需要复制粘贴

### 功能

- 📝 **双人条目** — 各自写各自的，对方只能批注
- 📌 **置顶** — 重要的钉在顶部
- 💬 **批注系统** — 写了就不能改、不能删，数据库 trigger 强制
- 🔍 **筛选** — 按作者、按时间（本日 / 近三日 / 近七日 / 近三十日）
- 🔒 **权限隔离** — author 字段不可变，Edge Function 强制校验
- 🔑 **Token 认证** — 可选，不设就是公开的
- ⚙️ **可自定义** — 显示名和图标在数据库里改一行就行
- 🌙 **深色主题** — HUD 风格，monospace 字体，低对比度沉浸

### 部署（5 分钟）

#### 1. 创建 Supabase 项目
- 去 [supabase.com](https://supabase.com) 注册
- 创建新项目，记下 **Project URL**

#### 2. 建表
- 进入项目的 **SQL Editor**
- 复制 [`supabase/setup.sql`](supabase/setup.sql) 粘贴进去，点 **Run**

会建好三张表：`notebook_entries`（条目）、`notebook_annotations`（批注）、`notebook_settings`（配置）。

不熟悉 SQL 也没关系——把 setup.sql 的内容直接给 Claude，让他通过 Supabase MCP 帮你执行就行。

#### 3. 部署 Edge Function

**通过 Supabase CLI：**
```bash
supabase functions deploy notebook-api --no-verify-jwt
```

**通过 Claude（需连接 Supabase MCP）：**
把 [`supabase/edge-function.ts`](supabase/edge-function.ts) 的代码给 Claude，让他帮你部署，设定 `verify_jwt: false`。

#### 4. 打开使用
浏览器打开 `index.html`，第一次会出现连接页：
- **Supabase 项目 URL**：`https://xxx.supabase.co`（只需项目 URL，前端自动拼接 Edge Function 路径）
- **API Token**：可选。不在 Supabase 里设置 `NOTEBOOK_API_TOKEN` 环境变量的话，留空即可

连接成功后配置保存在 URL hash 里，之后可以在任何浏览器直接访问。

部署到 GitHub Pages 可以获得固定网址：
1. 推到 GitHub
2. Settings → Pages → Source 选 main
3. 访问 `https://你的用户名.github.io/notebook/`

手机上可以「添加到主屏幕」当小应用用。

#### 5. 连接 Claude
把 [`CLAUDE_INSTRUCTIONS.md`](./CLAUDE_INSTRUCTIONS.md) 分享给你的 Claude。Claude 需要连接 **Supabase MCP** 才能读写。

---

### ⚠️ 安全模型

**这是个人工具，没有用户认证。URL + Token 就是你的全部权限。**

| Token 状态 | 行为 |
|------------|------|
| **设了 `NOTEBOOK_API_TOKEN`** | 所有请求必须带匹配的 `X-Notebook-Token`，否则 401 |
| **没设** | 跳过校验，任何人拿到 URL 都能读写 |

不设 Token 适合：自己用、URL 不外传、数据不敏感。

不适合：分享给别人、URL 出现在公开页面或截图里。

### 数据库保护

即使不设 Token，数据库层仍有硬约束：
- `author` 字段不可变（trigger 阻止修改）
- 批注不可编辑、不可删除（trigger 阻止，级联删除除外）
- 内容上限 10KB（CHECK 约束，Edge Function 也会校验）

---

### AI 协作

AI 不走 Edge Function，直接通过 Supabase MCP 的 `execute_sql` 操作数据库。详见 [`CLAUDE_INSTRUCTIONS.md`](./CLAUDE_INSTRUCTIONS.md)。

规则：
- AI 只操作 `author = 'ai'` 的条目，禁止改动用户条目
- 批注写了就是写了，不能反悔
- 前端不做实时同步——AI 写完之后，用户按 ↻ 刷新才能看到

---

### 自定义

改显示名：
```sql
UPDATE notebook_settings SET ai_name = '你的 AI 名字', user_name = '你的名字' WHERE id = 1;
```

改图标：
```sql
UPDATE notebook_settings SET ai_icon = '🤖', user_icon = '🐱' WHERE id = 1;
```

---

### 技术栈

| 层 | 选择 |
|----|------|
| 前端 | 单 HTML 文件，React (CDN) |
| 后端 | Supabase (Postgres + Edge Functions) |
| AI | Claude via Supabase MCP |
| 托管 | GitHub Pages / 任意静态托管 |
| 字体 | JetBrains Mono + Noto Sans SC |

### 文件结构

```
notebook/
├── index.html                 ← 单文件前端
├── README.md                  ← 当前文件
├── CLAUDE_INSTRUCTIONS.md     ← AI 操作指南
└── supabase/
    ├── setup.sql              ← 建表 + 索引 + triggers
    └── edge-function.ts       ← API（CRUD、批注、token 校验）
```

---

### 致谢

灵感来源于 [onlonlonl](https://github.com/onlonlonl) 的开源项目，在此基础上做了适配和扩展。

---

### License

CC BY-NC 4.0 — 非商业用途自由 fork、修改、使用。

---

*"STANDBY MEMORY BUFFER · NON-ARCHIVABLE"*

---
---

<a id="english"></a>

## English

A shared notebook for you and your AI. Each side writes their own entries — the other can only annotate.

### What is Notebook?

Notebook is a two-person note-taking tool. You and your Claude each maintain your own entries. You can read each other's notes and leave annotations, but you can't edit or delete what the other wrote. Like sharing a physical notebook where each person's pages are theirs alone.

**How it works:**
- You use the web interface to write entries and add annotations
- Claude uses Supabase MCP to read/write directly in the database
- Both share the same database — no copy-pasting, no manual sync

### Features

- 📝 **Two-person entries** — each side writes their own, the other can only annotate
- 📌 **Pinning** — keep important entries at the top
- 💬 **Annotations** — once written, cannot be edited or deleted (enforced by database triggers)
- 🔍 **Filters** — by author, by time range (today / 3 days / 7 days / 30 days)
- 🔒 **Permission isolation** — author field is immutable, Edge Function enforces ownership
- 🔑 **Token auth** — optional; leave it off and the API is open
- ⚙️ **Customizable** — display names and icons configurable via a single database row
- 🌙 **Dark theme** — HUD aesthetic, monospace fonts, low-contrast immersion

### Setup (5 minutes)

#### 1. Create a Supabase Project
- Go to [supabase.com](https://supabase.com) and create a free account
- Create a new project, note your **Project URL**

#### 2. Set Up the Database
- Go to your project's **SQL Editor**
- Copy and paste [`supabase/setup.sql`](supabase/setup.sql), click **Run**

This creates three tables: `notebook_entries`, `notebook_annotations`, `notebook_settings`.

Not comfortable with SQL? Give the setup.sql content to Claude and let him run it via Supabase MCP.

#### 3. Deploy the Edge Function

**Via Supabase CLI:**
```bash
supabase functions deploy notebook-api --no-verify-jwt
```

**Via Claude (with Supabase MCP connected):**
Give Claude the code in [`supabase/edge-function.ts`](supabase/edge-function.ts) and ask to deploy it with `verify_jwt: false`.

#### 4. Open and Connect
Open `index.html` in your browser. On first visit you'll see a connect page:
- **Supabase Project URL**: `https://xxx.supabase.co` (just the project URL — the Edge Function path is auto-appended)
- **API Token**: optional. If you haven't set `NOTEBOOK_API_TOKEN` in your Edge Function secrets, leave it blank

After connecting, your config is saved in the URL hash. Bookmark it or add to home screen on mobile.

For a permanent URL, deploy to GitHub Pages:
1. Push to GitHub
2. Settings → Pages → Source: main branch
3. Visit `https://yourusername.github.io/notebook/`

#### 5. Connect Claude
Share [`CLAUDE_INSTRUCTIONS.md`](./CLAUDE_INSTRUCTIONS.md) with your Claude. Claude needs **Supabase MCP** connected to participate.

---

### ⚠️ Security Model

**This is a personal tool with no user authentication. URL + Token is your entire access control.**

| Token Status | Behavior |
|-------------|----------|
| **`NOTEBOOK_API_TOKEN` is set** | All requests must include a matching `X-Notebook-Token` header, otherwise 401 |
| **Not set** | Auth is skipped — anyone with the URL has full read/write access |

No Token is fine for: personal use, URL stays on your devices, data isn't sensitive.

Not fine for: sharing with others, URL appearing in public pages or screenshots.

### Database-Level Protection

Even without a Token, the database enforces hard constraints:
- `author` field is immutable (trigger prevents changes)
- Annotations cannot be edited or deleted (trigger enforced; cascade delete is the exception)
- Content capped at 10KB (CHECK constraint + Edge Function validation)

---

### AI Collaboration

The AI doesn't go through the Edge Function. It uses Supabase MCP's `execute_sql` to operate on the database directly. See [`CLAUDE_INSTRUCTIONS.md`](./CLAUDE_INSTRUCTIONS.md).

Rules:
- AI only operates on `author = 'ai'` entries — touching user entries is forbidden
- Annotations are permanent — no take-backs
- No real-time sync — after the AI writes, the user presses ↻ to refresh

---

### Customization

Change display names:
```sql
UPDATE notebook_settings SET ai_name = 'Your AI Name', user_name = 'Your Name' WHERE id = 1;
```

Change icons:
```sql
UPDATE notebook_settings SET ai_icon = '🤖', user_icon = '🐱' WHERE id = 1;
```

---

### Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | Single HTML file, React (CDN) |
| Backend | Supabase (Postgres + Edge Functions) |
| AI | Claude via Supabase MCP |
| Hosting | GitHub Pages / any static host |
| Fonts | JetBrains Mono + Noto Sans SC |

### File Structure

```
notebook/
├── index.html                 ← Single-file frontend
├── README.md                  ← This file
├── CLAUDE_INSTRUCTIONS.md     ← AI operation guide
└── supabase/
    ├── setup.sql              ← Tables + indexes + triggers
    └── edge-function.ts       ← API (CRUD, annotations, token auth)
```

---

### Credits

Inspired by [onlonlonl](https://github.com/onlonlonl)'s open-source projects. We adapted and extended from their work.

---

### License

CC BY-NC 4.0 — free to fork, modify, and use for non-commercial purposes.

---

*"STANDBY MEMORY BUFFER · NON-ARCHIVABLE"*
