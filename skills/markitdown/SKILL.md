---
name: markitdown
description: "Read and analyze document files (.xlsx, .pdf, .docx, .pptx, .csv, .html, .epub, .json, .xml, .zip) and YouTube URLs. Converts files to Markdown before reading. Use this skill for reading or analyzing files. For .xlsx use this skill instead of the xlsx skill when reading content."
---

# MarkItDown

当用户需要读取、分析、总结或提取文档内容时，使用本 skill 将文件转换为 Markdown，再读取分析。

> **与 xlsx skill 的区别：** 本 skill 用于读取/理解文档内容；xlsx skill 用于编辑/创建/格式化电子表格。

## 支持的格式

PDF、Word、Excel、PowerPoint、HTML、CSV、JSON、XML、EPUB、ZIP、图片、音频、YouTube URL

## 前置检查

**第一步：检查 Python 是否安装**

```bash
python3 --version || python --version
```

未安装则提示用户安装 Python 3.10+：https://www.python.org/downloads/

**第二步：运行环境安装脚本**

```bash
cd <skill目录> && python3 scripts/setup.py --install
```

`<skill目录>` 为本 SKILL.md 所在目录的绝对路径。如果路径含 Windows 盘符（如 `E:\...`）且当前 shell 为 bash/WSL，先转为 `/mnt/...` 格式（`E:\a\b` → `/mnt/e/a/b`，`\` 换 `/`）。

## 工作流程

1. 确定目标文件（用户指定路径则直接用，否则在 cwd 下搜索）
2. 执行 `python3 --version || python --version` 检查 Python
3. 执行 `cd <skill目录> && python3 scripts/setup.py --install`
4. 执行 `cd <skill目录> && python3 scripts/convert.py <文件绝对路径>`，脚本输出临时 `.md` 路径
5. 用 `read` 工具读取输出的 `.md` 路径，分析并展示结果
6. 删除临时 `.md` 文件

## 注意事项

- 大文件转换可能较慢，请耐心等待。