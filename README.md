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

### 4. CodeGraph 工具集合 (`codegraph_*`)

通过 `extensions/codegraph/` 注册的 4 个工具（未来会扩展），基于 [CodeGraph](https://github.com/colbymchenry/codegraph) 本地代码知识图谱引擎。

需要先在项目中初始化 CodeGraph：

```bash
codegraph init
codegraph index
```

**提供工具：**

| 工具名称 | 对应 CLI | 用途 |
|----------|----------|------|
| `codegraph_search` | `codegraph query` | 按名称搜索符号（函数、类、变量等），支持 kind 过滤 |
| `codegraph_callers` | `codegraph callers` | 查找调用了某符号的所有函数/方法 |
| `codegraph_callees` | `codegraph callees` | 查找某函数/方法调用了哪些符号 |
| `codegraph_impact` | `codegraph impact` | 修改符号前的影响力分析（传递调用链） |
| `codegraph_files` | `codegraph files` | 查看索引中的文件结构（比 fs 扫描更快） |
| `codegraph_status` | `codegraph status` | 查看索引健康状态和统计 |
| `codegraph_affected` | `codegraph affected` | 查找受变更影响的测试文件 |
| `codegraph_sync` | `codegraph sync` | 增量同步索引（文件变更后使用） |
| `codegraph_init` | `codegraph init` | 初始化项目代码图索引 |

**调用参数：**

`codegraph_search`

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `query` | `string` | - | 符号名称（支持模糊匹配） |
| `kind` | `string` | - | 按类型过滤：function, class, method, variable, interface 等 |
| `limit` | `number` | `20` | 最大结果数 (max 50) |

`codegraph_callers` / `codegraph_callees`

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `symbol` | `string` | - | 符号名称（精确匹配） |
| `limit` | `number` | `20` | 最大结果数 (max 50) |

`codegraph_impact`

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `symbol` | `string` | - | 符号名称 |
| `depth` | `number` | `2` | 传递遍历深度 (1-10) |

`codegraph_files`

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `filter` | `string` | - | 过滤子目录（如 `extensions`） |
| `pattern` | `string` | - | Glob 模式过滤（如 `*.ts`） |

`codegraph_affected`

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `files` | `string[]` | - | 变更的文件路径列表 |
| `depth` | `number` | `5` | 传递遍历深度 (1-20) |
| `filter` | `string` | - | 自定义测试文件 glob 模式 |

`codegraph_init`

| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `verbose` | `boolean` | `false` | 显示详细索引日志 |

### 5. 自定义主题 (`z-theme`)

`themes/z-theme.json` 提供了一套深色主题配色方案，适用于 Pi TUI 界面。

## 目录结构

```
z-pi-agent/
├── extensions/
│   ├── change-context.ts      # 变更上下文工具扩展
│   ├── file-finder.ts         # 文件查找工具扩展
│   └── codegraph/             # CodeGraph 工具集合扩展
│       ├── index.ts           # 入口
│       ├── executor.ts        # CLI 执行引擎
│       └── tools/
│           ├── search.ts      # codegraph_search
│           ├── callers.ts     # codegraph_callers
│           ├── callees.ts     # codegraph_callees
│           ├── impact.ts      # codegraph_impact
│           ├── files.ts       # codegraph_files
│           ├── status.ts      # codegraph_status
│           ├── affected.ts    # codegraph_affected
│           ├── sync.ts        # codegraph_sync
│           └── init.ts        # codegraph_init
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

2. **代码图查询**：在 Pi 对话中询问代码结构相关问题时，系统会自动调用 `codegraph_*` 工具来搜索符号、分析调用链和评估修改影响。

3. **应用主题**：在 Pi 配置中指定主题为 `z-theme` 即可应用自定义深色主题。