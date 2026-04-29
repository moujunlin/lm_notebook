# Notebook — 双人共享笔记本

和家机一起记笔记本吧，除开各式各样的记忆系统，智能召回，不知道各位user和各user的家机，有没有什么时候想自己写的笔记，备忘录，这就是独立于memory的笔记本。
并且你的笔记本只属于你，User 和 家机各自维护自己的条目，对方只能批注。
具体实现灵感来源另一位老师onlonlonl的开源项目，大家也可以去看看非常好的功能们！

---

## 角色

- `user` — 各位user（前端操作）
- `ai` — 家机（通过 Supabase MCP 操作数据库）

显示名可在 `notebook_settings` 表里改（默认是家机和我啦 `Lori` / `猫猫`）。

---

## 部署

### 1. Supabase 数据库

跑一次建表脚本：

```bash
psql -h <your-supabase-host> -U postgres -d postgres -f supabase/setup.sql
```

或者在 Supabase Dashboard → SQL Editor 里直接粘贴 `supabase/setup.sql` 执行。

会建好三张表：
- `notebook_entries` — 条目
- `notebook_annotations` — 批注
- `notebook_settings` — 显示名 / 图标设置

这一步不会的user们别慌！反正Claude是可以直接用superbase的connector，然后让他帮忙操作所有的，我试过了sonnet就能完美完成。

### 2. Edge Function

部署 `supabase/edge-function.ts` 到 Supabase Edge Functions：

```bash
supabase functions deploy notebook-api --no-verify-jwt
```

### 3. 前端

`index.html` 是单文件 React，静态托管即可（GitHub Pages / Cloudflare Pages / 任何 CDN）。

第一次打开会显示连接页，输入：
- **Supabase 项目 URL**：`https://xxx.supabase.co`（去supabase个人的project里面复制project url即可，不需要带 `/functions/v1/notebook-api`，前端会自动拼）
- **API Token**（可选，见下面安全说明。不在supabase里设置token，空着即可。）

输完后点击连接即可进入notebook，之后保存显示的url就可以在任一浏览器访问啦，也可以在手机上添加至桌面（伪装成小APP^_^）

---

## 安全模型

### Token 校验

Edge Function 通过环境变量 `NOTEBOOK_API_TOKEN` 控制访问：

| 状态 | 行为 |
|------|------|
| **设了 TOKEN** | 所有请求必须带 `X-Notebook-Token` header 匹配，否则 401 |
| **没设 TOKEN** | 跳过校验，**Edge Function 完全公开** |

### ⚠️ 不设 Token 的风险

不配 `NOTEBOOK_API_TOKEN` 意味着：**任何拿到你 Supabase 项目 URL 的人都能读、写、删除你的笔记本。**

适合：
- 自己 fork、URL 只在自己设备之间传
- 实验性使用、数据无所谓

**不适合：**
- 分享 URL 给朋友（朋友能改你笔记本）
- URL 出现在公开页面 / GitHub / 截图里
- 笔记本里放任何敏感信息

> 如果你想多人共享，给每个人发不同的 URL+Token 组合是更好的做法（虽然这个工具没设计成多用户，但 token 至少能挡住 URL 被无意泄露的情况）。

---

## AI 协作

AI 不走 Edge Function，直接通过 Supabase MCP 的 `execute_sql` 操作数据库。详见 [`CLAUDE_INSTRUCTIONS.md`](./CLAUDE_INSTRUCTIONS.md)。

操作铁律：
- AI 只操作 `author = 'ai'` 的条目，禁止改动用户条目
- 批注一旦写入不可编辑、不可删除（数据库 trigger 强制）
- `author` 字段不可变（数据库 trigger 强制）

---

## 文件结构

```
notebook/
├── index.html                 ← 单文件前端
├── README.md                  ← 当前文件
├── CLAUDE_INSTRUCTIONS.md     ← AI 操作指南
├── supabase/
│   ├── setup.sql              ← 三张表 + 索引 + triggers + RLS
│   └── edge-function.ts       ← API（CRUD、批注、token 校验）
└── tests/
    ├── contract/              ← 契约测试
    └── integration/           ← API 集成测试
```

---

## 数据流

1. **用户写条目** → 前端 POST `/entries` → Edge Function 写 `notebook_entries`（author 强制为 `'user'`）
2. **AI 写条目** → 通过 MCP `execute_sql` 直接 INSERT（author 为 `'ai'`）
3. **批注** → 双方都可批注对方的条目（同样走各自的写入通道）
4. **查看** → 前端 GET `/entries` 拉列表，展开时按需拉 detail；AI 直接 SQL 读

前端**不做实时同步**——AI 通过 MCP 操作后，用户需要手动按刷新按钮（↻）才能看到。这是设计内的取舍。

---

## 配置

### 改显示名

```sql
UPDATE notebook_settings
SET ai_name = 'Your AI Name', user_name = 'Your Name'
WHERE id = 1;
```

### 改图标（可选）

```sql
UPDATE notebook_settings
SET ai_icon = '🤖', user_icon = '🐱'
WHERE id = 1;
```

### 单条内容上限

数据库层硬限制 10KB（`octet_length(content) <= 10240`）。Edge Function 也会做一次校验返回 400。

---

## License

CC BY-NC 4.0 — 非商业用途自由 fork、修改、使用。

---

*"STANDBY MEMORY BUFFER · NON-ARCHIVABLE"*
