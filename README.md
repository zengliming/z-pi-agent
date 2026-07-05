# z-pi-agent

Pi 编码助手扩展包，提供代码变更评估、主题定制等功能。

## 功能特性

### 1. 代码变更上下文工具 (`change_context`)

通过 `extensions/change-context.ts` 注册的工具，支持：

- 收集未暂存或已暂存的 Git 变更上下文
- 识别配置文件变更（CI/CD、环境变量、Docker 等）
- 标记大型生成文件（lock、snap、svg、json）
- 前置校验：自动检测 Git 是否安装及当前目录是否为 Git 仓库，未满足条件时给出明确提示

**调用参数：**

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `stagedOnly` | `boolean` | `false` | 是否仅收集已暂存的变更 |

### 2. 变更评估技能 (`change-assessment`)

通过 `skills/change-assessment` 提供的技能，用于：

- 评估当前工作区代码变更的影响范围
- 识别风险文件和需要重点复核的内容
- 生成 PR 描述和提交前自查建议

**输出格式：**

```text
## 改了什么
## 影响范围
## 风险点
## 建议复核
```

### 3. 文件查找工具 (`file_finder`)

通过 `extensions/file-finder.ts` 注册的工具，支持：

- 按文件名模式（glob）搜索
- 按文件内容（正则）搜索
- 列出目录内容
- 跨平台：Unix 下使用原生工具（find/rg/ls），Windows 下使用 Node.js fs

**调用参数：**

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `pattern` | `string` | - | 搜索模式：name 模式用 glob，content 模式用正则，list 模式用路径 |
| `searchType` | `string` | `name` | 搜索类型：`name` / `content` / `list` |
| `directory` | `string` | cwd | 搜索目录 |
| `fileTypes` | `string` | - | 文件类型过滤，逗号分隔，如 `.ts,.js,.json` |
| `maxResults` | `number` | `50` | 最大结果数 (1-500) |
| `maxDepth` | `number` | `5` | 最大目录深度 (1-20) |
| `caseSensitive` | `boolean` | `false` | 是否区分大小写 |
| `ignoreDirs` | `string` | `node_modules,.git,dist,build,.next` | 忽略的目录 |

### 4. 自定义主题 (`z-theme`)

`themes/z-theme.json` 提供了一套深色主题配色方案，适用于 Pi TUI 界面。

## 目录结构

```
z-pi-agent/
├── extensions/
│   ├── change-context.ts      # 变更上下文工具扩展
│   └── file-finder.ts         # 文件查找工具扩展
├── skills/
│   └── change-assessment/
│       └── SKILL.md            # 变更评估技能定义
├── prompts/
│   └── change-assessment.md   # 变更评估提示词
├── themes/
│   └── z-theme.json           # 自定义主题
├── AGENTS.md                   # AI 助手行为规则
├── package.json
└── README.md
```

## 提交规则

**每次提交（commit）必须更新 README.md。**

项目通过 `AGENTS.md` 定义了 AI 助手的行为规则：在提交代码前，AI 助手会自动检查变更内容，判断 README.md 是否需要同步更新（如新增功能、调整目录结构等），确保 README.md 始终反映项目最新状态。

## 安装使用

### 环境要求

- Node.js >= 20.6.0
- Git

### 安装

```bash
npm install
```

### 配置

在 Pi 配置文件中引用本扩展包，Pi 会自动加载 `extensions/`、`skills/`、`prompts/` 和 `themes/` 目录下的内容。

## 使用方式

1. **评估代码变更**：在 Pi 对话中输入评估变更相关指令，系统会自动触发 `change-assessment` 技能，调用 `change_context` 工具获取变更上下文并输出评估报告。

2. **应用主题**：在 Pi 配置中指定主题为 `z-theme` 即可应用自定义深色主题。