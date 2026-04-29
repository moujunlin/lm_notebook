# Notebook 团队协作工作流

## 角色分工

| 角色 | 负责人 | 职责 |
|------|--------|------|
| **产品/架构** | 猫猫 + Lori | 初步设计、架构决策、需求文档（如 `notebook.design.v3.md`、`notebook-v1.1-impl.md`） |
| **Main Coder** | Kimi | 代码实现（`index.html`、`supabase/edge-function.ts`、`supabase/setup.sql` 等） |
| **Tester** | Codex | 编写和维护测试用例（`tests/contract/*.test.mjs`、`tests/integration/*.test.mjs`） |
| **Reviewer** | Cowork | Code review、需求细化、实现文档整理（如 `notebook-v1.1-impl.md`） |

## TDD 开发流程

1. **需求确定** → 猫猫/Lori 输出设计文档/需求
2. **测试先行** → 交给 Codex 根据需求写测试（全红状态）
3. **代码实现** → Kimi 按测试实现功能，跑测试至全绿
4. **Code Review** → Cowork 评审，输出修复/改进意见
5. **迭代修复** → Kimi 根据评审修改，重复 3-4
6. **验收上线** → 测试全绿 + Cowork 通过 → Ship

## 铁律

- **Kimi 只改代码，不改测试。** 测试有问题通过猫猫转达给 Codex 修改。
- **Codex 只改测试，不改代码。** 代码有问题通过猫猫转达给 Kimi 修改。
- **测试与代码冲突时，以正确行为为准调整测试。** 评审人（Cowork）拥有最终裁决权。
- **任何需求变更必须经过评审人细化成实现文档后，再进入 TDD 流程。**
