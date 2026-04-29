# Notebook · AI 操作指南

双人共享笔记本。User 通过前端操作，AI 通过 Supabase MCP 操作数据库。各自维护自己的条目，对方只能批注。

**Project ID:** `YOUR_PROJECT_ID

> **⚠️ 关键规则：所有 UPDATE / DELETE 语句必须带 `AND author = 'ai'` 条件。禁止操作 author='user' 的条目。违反此规则会破坏数据完整性。**

## Tables

### notebook_entries

双方的条目。

| Column | Type | Description |
| --- | --- | --- |
| id | bigint | Auto-generated |
| author | text | 'ai' or 'user'（不可变） |
| content | text | 条目内容（≤10KB） |
| pinned | boolean | 是否置顶 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间（trigger 自动维护） |

### notebook_annotations

批注。写了就不能改、不能删（trigger 强制）。

| Column | Type | Description |
| --- | --- | --- |
| id | UUID | Auto-generated |
| entry_id | bigint | 关联的条目 ID |
| author | text | 'ai' or 'user' |
| content | text | 批注内容（≤10KB） |
| created_at | timestamptz | 创建时间 |

### notebook_settings

显示名配置（单行）。

| Column | Type | Description |
| --- | --- | --- |
| id | int | Always 1 |
| ai_name | text | AI 显示名（默认 'Lori'） |
| user_name | text | User 显示名（默认 '猫猫'） |
| ai_icon | text | AI 图标 |
| user_icon | text | User 图标 |

## Operations

### 查看所有条目

```sql
SELECT * FROM notebook_entries ORDER BY pinned DESC, created_at DESC;
```

### 新增条目

```sql
INSERT INTO notebook_entries (author, content, pinned) VALUES ('ai', '内容', false);
```

### 编辑自己的条目（必须带 author = 'ai'）

```sql
UPDATE notebook_entries SET content = '新内容' WHERE id = N AND author = 'ai';
```

### 删除自己的条目（必须带 author = 'ai'）

> ⚠️ DELETE 不可恢复，执行前请确认。

```sql
DELETE FROM notebook_entries WHERE id = N AND author = 'ai';
```

### Pin / Unpin（必须带 author = 'ai'）

```sql
UPDATE notebook_entries SET pinned = true WHERE id = N AND author = 'ai';
```

### 加批注（可以给任何条目加）

```sql
INSERT INTO notebook_annotations (entry_id, author, content) VALUES (N, 'ai', '批注内容');
```

### 查看批注

```sql
SELECT * FROM notebook_annotations WHERE entry_id = N ORDER BY created_at;
```

### 读取配置

```sql
SELECT * FROM notebook_settings WHERE id = 1;
```

## Rules

* AI 只操作 `author = 'ai'` 的条目，禁止改动 user 条目
* 批注写了就是写了，不能编辑、不能删除
* `updated_at` 由 trigger 自动维护，SQL 中不需要手动设置
* `author` 字段不可变（trigger 阻止修改）
* 前端不做实时同步——AI 写完后，用户按 ↻ 刷新才能看到
