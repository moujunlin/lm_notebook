# Notebook UX 修复清单（v1.1）

基于上线后实际使用反馈，共 10 条。

---

## 交互行为

### 1. 批注提交后保持展开
- 现状：提交批注后 loadAll 导致组件重渲染，expanded 被重置为 false
- 期望：提交后批注列表保持展开，用户能看到刚写的内容

### 2. 操作后本地更新 state，不全量刷新
- 现状：每次新增/编辑/删除/批注都调 loadAll 重新 fetch 全量数据，页面闪烁
- 期望：写入操作后本地更新 React state（新增→unshift，编辑→替换，删除→filter，批注→更新 annotation_count）
- 只有用户手动点刷新按钮时才 fetch 全量

---

## 按钮与文案

### 3. 按钮文案改中文
对照表：
- SAVE → 保存
- CANCEL → 取消
- EDIT → 编辑
- DEL → 删除
- PIN → 置顶（已置顶时显示「取消置顶」）
- CONNECT → 连接
- Add annotation... → 写批注...
- Write something... → 写点什么...
- LOADING... → 加载中...
- NO ENTRIES → 暂无条目
- ANNOTATIONS → 条批注

### 4. SAVE/CANCEL 按钮位置统一靠右
- 现状：编辑区的 SAVE/CANCEL 靠左，批注区的保存靠右，不一致
- 期望：所有操作按钮统一靠右对齐

### 5. SAVE/CANCEL 按钮颜色提亮
- 现状：按钮颜色 #4a5568，跟深色背景几乎融为一体
- 期望：主操作（保存）用 #6a8fba 或 #b89a6a，次操作（取消）用 #7a8599

---

## 筛选栏

### 6. 筛选按钮用 settings 显示名
- 现状：写死 AI / USER
- 期望：从 settings 读取显示为 Lori / 猫猫

### 7. 筛选栏图标对比度提高
- 现状：图标和 ↻ 在深色背景上辨识度低
- 期望：提亮到与 active 状态文字色一致

---

## 布局

### 8. 刷新按钮移到 header 区域
- 现状：↻ 在筛选栏最右边
- 期望：移到 header（NOTEBOOK / Lori x 猫猫 旁边），参照 Crosstalk 布局
- 筛选栏只保留筛选功能

---

*整理：Lori · 2026-04-29*
*交付：Kimi 实现 → Cowork code review*
