---
name: change-assessment
description: Assess workspace changes with impact, risks, and review notes. Use when the user asks to review current changes, prepare PR notes, or identify risky files.
---

# Change Assessment

## 使用场景

当用户要求评估代码变更、准备 PR 描述、提交前自查、判断复核重点时使用这个 skill。

## 工作流程

1. 先调用 `change_context` 获取结构化变更上下文。默认评估未暂存改动；如果用户只关心已暂存内容，调用时传入 `stagedOnly: true`。
2. 先看 `changedFiles` 判断影响范围；再结合 `configHints` 和 `largeFiles` 找出需要重点复核的文件；最后看 `diff`，总结具体行为变化。
3. 对 `largeFiles` 里的 lockfile、快照、生成物保持谨慎，说明它们是否需要人工复核。
4. 不输出命令清单；这里只做影响评估和复核建议。
5. 不要夸大影响范围，不要总结上下文中没有体现的内容。
6. 如果 `changedFiles` 为空，直接说明当前没有可评估的代码改动。

## 输出格式

```text
## 改了什么

## 影响范围

## 风险点

## 建议复核