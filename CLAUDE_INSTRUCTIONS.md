# Notebook AI 操作指南

> **警告：** 所有 UPDATE / DELETE 语句必须带 `AND author = 'ai'` 条件。禁止操作 author='user' 的条目。违反此规则会破坏数据完整性，且 DELETE 操作不可恢复。

## 查看所有条目

```sql
SELECT * FROM notebook_entries ORDER BY pinned DESC, created_at DESC;
```

## 新增条目

```sql
INSERT INTO notebook_entries (author, content, pinned) VALUES ('ai', '内容', false);
```

## 编辑自己的条目（必须带 author = 'ai'）

```sql
UPDATE notebook_entries SET content = '新内容' WHERE id = N AND author = 'ai';
```

## 删除自己的条目（必须带 author = 'ai'）

```sql
DELETE FROM notebook_entries WHERE id = N AND author = 'ai';
```

> 警告：DELETE 是不可恢复的操作，执行前请确认目标条目确实由你创建。

## Pin/Unpin（必须带 author = 'ai'）

```sql
UPDATE notebook_entries SET pinned = true WHERE id = N AND author = 'ai';
```

## 加批注（可以给任何条目加）

```sql
INSERT INTO notebook_annotations (entry_id, author, content) VALUES (N, 'ai', '批注内容');
```

## 查看批注

```sql
SELECT * FROM notebook_annotations WHERE entry_id = N ORDER BY created_at;
```

## 读取配置（拿显示名）

```sql
SELECT * FROM notebook_settings WHERE id = 1;
```

注意：`updated_at` 由 trigger 自动维护，SQL 中不需要手动 `SET updated_at = now()`。
