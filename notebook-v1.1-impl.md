# Notebook v1.1 实现文档

基于上线后 UX 反馈（`notebook-ux-fixes.md`）+ 三轮 code review 整理。共三优先级：

- **P0**：根基改动（state 模型重构）
- **P1**：结构与样式
- **P2**：文案

按顺序实现。P0 不能跳过——P1 中的"批注提交后保持展开"依赖 P0 完成。

---

## P0 · 根基改动

### P0-1 写入操作改本地 state 更新，不走 loadAll

**现状**：所有写入（saveEntry / deleteEntry / patchEntry / addAnnotation）成功后调用 `loadAll()` 重新拉全量数据。`loadAll` 会触发 `setLoading(true)`，导致 `{!loading && filtered.map(...)}` 整段不渲染——所有 EntryCard unmount 再 remount，体验上是闪一下，且子组件 state（如 NoteSection 的 expanded、annotations）全部丢失。

**目标**：写入操作只更新本地 React state，不触发全量刷新。`loadAll()` 只保留给手动刷新按钮 ↻。

**实现**：

| 操作 | 本地更新 |
|------|---------|
| `saveEntry` | POST 返回新 entry → `setEntries(prev => sortEntries([{...newEntry, annotation_count: 0}, ...prev]))` |
| `deleteEntry` | DELETE 成功 → `setEntries(prev => prev.filter(e => e.id !== id))` |
| `patchEntry` | PATCH 返回 updated entry → `setEntries(prev => sortEntries(prev.map(e => e.id === id ? updated : e)))` |
| `addAnnotation` | POST 返回新 annotation → 父级更新 `annotation_count`，并把新 annotation 通过返回值给 NoteSection 本地 `setAnnotations(prev => [...prev, newAnnotation])` |

**辅助函数**：

```js
function sortEntries(arr) {
  return [...arr].sort((a, b) => {
    if (a.pinned !== b.pinned) return b.pinned - a.pinned;
    return new Date(b.created_at) - new Date(a.created_at);
  });
}
```

**三个易踩的坑（必须处理）**：

1. **新条目缺 `annotation_count` 字段**：Edge Function 的 `POST /entries` 返回的是原始行，没有 `annotation_count`（这字段是 list 端点 join 出来的）。前端 unshift 时必须显式补 `annotation_count: 0`，否则 `entry.annotation_count > 0` 判断会读到 undefined。

2. **写入后必须重排序**：默认排序是 `pinned DESC, created_at DESC`。
   - 新条目直接 unshift 会盖在置顶之上，顺序错乱
   - pin 切换不重排会让条目原地不动（应该跳到顶或落回时间序）
   - 统一用 `sortEntries`，所有 mutation 后都过一次

3. **NoteSection 懒加载判断要改**：当前 `toggle()` 用 `annotations.length === 0 && annotation_count > 0` 判断要不要拉 detail。本地更新后会出现：服务端 5 条用户没展开 → 用户加 1 条 → 本地 `annotations=[新的1条]`、`annotation_count=6`。再展开时长度非 0 不会触发拉取，旧 5 条永远看不见。
   - 改成 `annotations.length < entry.annotation_count`

### P0-2 批注提交后保持展开

**现状**：提交批注后 `expanded` 重置。根因不是父级重渲染（`key={entry.id}` 稳定），而是 `loadAll` → `setLoading(true)` → EntryCard unmount → NoteSection 内部 state 全失。

**实现**：P0-1 完成后，提交不再走 loadAll，问题自然解决。在 `NoteSection.submit` 末尾统一加一行 `setExpanded(true)`，无论原本 wasEmpty 与否，确保新加的批注立即可见。

---

## P1 · 结构与样式

### P1-3 二级筛选：按时间

**目标**：在原有"按人"筛选下方新增"按时间"筛选，与"按人"正交叠加。

**布局**：

```
┌────────────────────────────────────────────────┐
│  [全部] [📌] [Lori] [猫猫]                     │  ← 一级（按人）
│  [全部] [本日] [近三日] [近七日] [近三十日]    │  ← 二级（按时间）
└────────────────────────────────────────────────┘
```

**视觉层级**：
- 一级 default 色 `#7a8599`（即 P1-7 提亮后的颜色）
- 二级 default 色 `#4a5568`（保留原暗色，比一级再暗一档表达从属）
- 两级 active 状态都用 `#c8cdd8`
- 二级字号比一级小 1px

**默认值**：二级默认"全部"——不主动隐藏数据，由用户决定要不要筛。

**Pin 不豁免**：选了时间档（如"本日"）只显示该时间段内的条目。pin 不会因为是 pin 就强制显示。用户想看 pin 自己点 📌。

**localStorage 持久化**：
- 二级（时间）筛选 **记住** 用户上次选择
- 一级（人）筛选 **不持久化**，每次打开默认"全部"

```js
const [dateFilter, setDateFilter] = useState(
  () => localStorage.getItem('notebook.dateFilter') || 'all'
);
useEffect(() => {
  localStorage.setItem('notebook.dateFilter', dateFilter);
}, [dateFilter]);
```

**时间档实现**（按自然日，跨午夜不闪屏）：

```js
function dateFilterPass(entry, filter) {
  if (filter === 'all') return true;
  const days = { today: 1, '3d': 3, '7d': 7, '30d': 30 }[filter];
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - (days - 1));
  return new Date(entry.created_at) >= cutoff;
}
```

"近三日"读作"今天和前两天"。

### P1-4 刷新按钮移到 header 区域

把 ↻ 从筛选栏移到 header 右侧。筛选栏只保留筛选功能。

实现：header 第一行改 flex `justify-content: space-between`，左侧 NOTEBOOK 标题，右侧 ↻ 按钮。"Lori × 猫猫"和 "STANDBY MEMORY BUFFER" 副标继续居中。

### P1-5 编辑模式按钮容器换 class

**现状**：`.entry-actions` 同时被用于：
- header 里的 EDIT/DEL/PIN 一组小按钮
- 编辑模式下的 SAVE/CANCEL

二者要不同的 `justify-content`，复用同一 class 会互相干扰。

**修法**：编辑模式那个容器（index.html line 423 附近）改成 `<div className="edit-actions">`，CSS 单独写：

```css
.edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}
```

### P1-6 主次按钮颜色提亮

- **主操作（保存）**：`#b89a6a`（用户金，跟 user author color 一致）
- **次操作（取消）**：`#7a8599`（中灰）

> 注：主操作选用户金而非 AI 蓝，理由是保存/编辑都是**用户**的动作，跟视觉语言"AI 蓝 / 用户金"一致。如果 lori 设计上有别的想法，请 confirm。

涉及位置：
- 编辑模式的 SAVE → user 金
- 编辑模式的 CANCEL → 中灰
- 新增条目区的 SAVE → 已经是 `#b89a6a`，保持
- 批注的 SAVE → user 金
- 连接页的 CONNECT → 保持现有 AI 蓝（独立主题）

### P1-7 一级筛选按钮提亮

`.filters button` 默认色从 `#4a5568` 提到 `#7a8599`，active 仍 `#c8cdd8`。

---

## P2 · 文案

### P2-8 按钮和提示中文化

| 现状 | 目标 |
|------|------|
| SAVE | 保存 |
| CANCEL | 取消 |
| EDIT | 编辑 |
| DEL | 删除 |
| PIN（按 entry.pinned 动态） | 置顶 / 取消置顶 |
| CONNECT | 连接 |
| Add annotation... | 写批注... |
| Write something... | 写点什么... |
| LOADING... | 加载中... |
| NO ENTRIES | 暂无条目 |
| {N} ANNOTATIONS | {N} 条批注 |
| ALL（一级筛选） | 全部 |
| ALL（二级筛选） | 全部 |
| 📌（一级筛选） | 保留图标，无文字 |

**保留英文**：
- 标题 NOTEBOOK
- 副标 STANDBY MEMORY BUFFER
- 页脚 NON-ARCHIVABLE
- 连接页的 "Supabase Project URL" 和 "API Token"（技术术语）

**注意**：`Add annotation...` 是 `<input placeholder>`，在 index.html 中**有两处**（line 511 和 523），两处都要改。

### P2-9 一级筛选用 settings 显示名

筛选按钮 "AI" / "USER" 的文字改用 settings 的 `ai_name` / `user_name`：

```jsx
<button onClick={...}>{settings?.ai_name || 'AI'}</button>
<button onClick={...}>{settings?.user_name || 'User'}</button>
```

settings 还没加载完时 fallback 到 `'AI'` / `'User'`（与作者标签的 fallback 一致）。

---

## 实现顺序

1. **P0** 先做（state 模型变化最大，会触碰所有写入路径）
2. **P1** 再做（CSS + 布局，互不依赖可并行）
3. **P2** 最后（纯字符串替换，最稳）

## 自测清单

**P0 完成后**：
- [ ] 新增条目能正确插到顶部，且置顶条目仍在最上
- [ ] pin 切换后条目跳到正确位置（顶部或时间序）
- [ ] 删除立即消失，不闪屏
- [ ] 批注提交后展开状态保留，新批注立即可见
- [ ] 已加载若干批注的 entry 切到别的 entry 再切回来，annotations 不丢

**P1 完成后**：
- [ ] 一级二级筛选可叠加（如"近七日 + Lori" = Lori 这周写的）
- [ ] 关掉浏览器再打开，时间筛选记住、人筛选还原"全部"
- [ ] 跨午夜不闪屏（凌晨 12:01 时"本日"仍能看到 0:30 写的条目）
- [ ] 选了"本日"，三个月前的 pin 不显示

**P2 完成后**：
- [ ] 不会有任何残留英文按钮（NOTEBOOK / STANDBY 等保留项除外）
- [ ] settings 表里改 ai_name 后，筛选按钮文字立刻跟着变

---

*整理：Cowork 评审 → Kimi 实现 → 猫猫 验收*
*基于：notebook-ux-fixes.md + 三轮 review 讨论*
