# Notebook Backlog

## Performance: 加批注触发 3 次 API 调用

**现状：**
`NoteSection.submit()` → POST `/annotations` → `addAnnotation` 内部调 `loadAll()`（GET `/entries` + GET `/settings`）→ `submit()` 末尾再 GET `/entries/:id`。

**优化方向：**
让 `addAnnotation` 在 App 层提交完返回新的 annotation 对象，由 `NoteSection` 直接 `setAnnotations(prev => [...prev, newAnnotation])` 拼接，省掉最后的 detail 拉取。

**优先级：** 低（personal tool，当前量级无感知）
