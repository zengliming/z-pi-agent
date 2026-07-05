# z-pi-agent 项目规则

## 提交规则

**每次提交代码前，必须检查 README.md 是否需要更新。**

当用户要求提交代码（git commit）时，你需要：

1. 先查看当前暂存区或工作区的变更内容（使用 `git diff --cached` 或 `git diff`）
2. 判断这些变更是否需要在 README.md 中体现，例如：
   - 新增功能或扩展 → 需要在 README 中补充说明
   - 修改目录结构 → 需要更新 README 中的目录结构部分
   - 新增文件（如脚本、配置） → 需要更新 README 中的目录结构
   - 纯 bug 修复、内部重构 → 可酌情不更新
3. 如果需要更新 README，先更新 README.md，再执行 commit
4. 如果 README 已经是最新的，直接执行 commit

## 目录结构

```
z-pi-agent/
├── extensions/       # Pi 扩展
├── skills/           # 技能定义
├── prompts/          # 提示词模板
├── themes/           # 主题
├── AGENTS.md          # AI 助手行为规则
├── package.json
└── README.md
```